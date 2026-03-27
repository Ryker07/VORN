/**
 * Vorn — Giveaway Manager
 * Full-featured giveaway engine with requirements, bonus entries,
 * pause/resume, scheduling, drop mode, and custom embeds
 */

const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const VornEmbed = require('../utils/embedBuilder');

class GiveawayManager {
    constructor(client) {
        this.client = client;
        this.checkTimer = null;

        // Start periodic check loop
        this.startCheckLoop();
    }

    // ═══════════════════════════════════════════════════════════════
    // CONFIG
    // ═══════════════════════════════════════════════════════════════

    async getGiveaways(guildId) {
        const config = await this.client.db.get(guildId, 'giveaways') || {};
        if (!config.giveaways) config.giveaways = [];
        if (!config.globalBlacklistUserIds) config.globalBlacklistUserIds = [];
        if (!config.globalBlacklistRoleIds) config.globalBlacklistRoleIds = [];
        return config;
    }

    async setConfig(guildId, config) {
        await this.client.db.set(guildId, 'giveaways', config);
    }

    // ═══════════════════════════════════════════════════════════════
    // GIVEAWAY CREATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Create a new giveaway
     * @param {Interaction} interaction
     * @param {Object} data 
     */
    async createGiveaway(interaction, data) {
        const {
            channel, prize, duration, winners,
            reqRoleIds = [],
            minAccountAge = null,
            minMemberAge = null,
            bonusRoles = [],
            dropMode = false,
            dropCount = null,
            embedColor = null,
            embedDescription = null,
            startTimestamp = null,
            blacklistUserIds = [],
            blacklistRoleIds = [],
            bypassRoleIds = [],
            voiceRequirement = false,
            bannerUrl = null,
            sponsorText = null,
            pingRoleId = null
        } = data;

        const endTimestamp = startTimestamp
            ? startTimestamp + duration
            : Date.now() + duration;

        const isScheduled = startTimestamp && startTimestamp > Date.now();

        // Build embed
        const embed = VornEmbed.create()
            .setTitle(`🎉 ${prize}`);

        if (embedColor) embed.setColor(embedColor);
        if (bannerUrl) embed.setImage(bannerUrl);

        const descLines = [];

        if (isScheduled) {
            descLines.push(`Starts: <t:${Math.floor(startTimestamp / 1000)}:R>`);
            descLines.push(`Ends: <t:${Math.floor(endTimestamp / 1000)}:R>`);
        } else if (dropMode) {
            descLines.push(`**DROP** ─ First **${dropCount || winners}** to join win!`);
        } else {
            descLines.push(`Ends: <t:${Math.floor(endTimestamp / 1000)}:R>`);
        }

        const hostDisplay = sponsorText ? sponsorText : `<@${interaction.user.id}>`;
        descLines.push(`Hosted by: ${hostDisplay}`);
        descLines.push(`Winners: **${winners}**`);

        if (embedDescription) descLines.push('', embedDescription);

        // Show requirements
        const reqs = [];
        if (voiceRequirement) reqs.push(`🎙️ Must be in a Voice Channel`);
        if (reqRoleIds.length > 0) reqs.push(`Role: ${reqRoleIds.map(r => `<@&${r}>`).join(' or ')}`);
        if (minAccountAge) reqs.push(`Account age: ${minAccountAge}d+`);
        if (minMemberAge) reqs.push(`Server time: ${minMemberAge}d+`);
        if (bypassRoleIds.length > 0) reqs.push(`Bypass Roles: ${bypassRoleIds.map(r => `<@&${r}>`).join(', ')}`);

        if (reqs.length > 0) {
            descLines.push('', '**Requirements**');
            reqs.forEach(r => descLines.push(`> ${r}`));
        }

        // Show bonus entries
        if (bonusRoles.length > 0) {
            descLines.push('', '**Bonus Entries**');
            bonusRoles.forEach(b => descLines.push(`> <@&${b.roleId}>: +${b.bonusEntries} entries`));
        }

        descLines.push('', '**Click 🎉 to join!**');
        descLines.push(`-# Entries: 0`);

        embed.setDescription(descLines.join('\n'));

        const button = new ButtonBuilder()
            .setCustomId('gw_join')
            .setEmoji('🎉')
            .setStyle(ButtonStyle.Primary)
            .setLabel(isScheduled ? 'Waiting...' : 'Join')
            .setDisabled(isScheduled);

        const row = new ActionRowBuilder().addComponents(button);
        const message = await channel.send({ embeds: [embed], components: [row] });

        const giveaway = {
            messageId: message.id,
            channelId: channel.id,
            guildId: interaction.guild.id,
            prize,
            winners,
            endTimestamp,
            startTimestamp: startTimestamp || Date.now(),
            hostId: interaction.user.id,
            entries: [],
            ended: false,
            paused: false,

            // Requirements
            reqRoleIds,
            minAccountAge,
            minMemberAge,
            blacklistUserIds,
            blacklistRoleIds,
            bypassRoleIds,
            voiceRequirement,

            // Bonus
            bonusRoles,

            // Drop mode
            dropMode,
            dropCount: dropCount || winners,

            // Premium Visuals
            embedColor,
            embedDescription,
            bannerUrl,
            sponsorText,
            pingRoleId
        };

        const config = await this.getGiveaways(interaction.guild.id);
        config.giveaways.push(giveaway);
        await this.setConfig(interaction.guild.id, config);

        if (pingRoleId && !isScheduled) {
            await channel.send({ content: `<@&${pingRoleId}>` }).then(m => setTimeout(() => m.delete().catch(() => null), 2000));
        }

        return message;
    }

    // ═══════════════════════════════════════════════════════════════
    // JOIN / LEAVE
    // ═══════════════════════════════════════════════════════════════

    /**
     * Handle a user joining or leaving a giveaway
     */
    async joinGiveaway(interaction, messageId) {
        const config = await this.getGiveaways(interaction.guild.id);
        const giveaway = config.giveaways.find(g => g.messageId === messageId && !g.ended);

        if (!giveaway) return { success: false, message: 'Giveaway not found or already ended.' };
        if (giveaway.paused) return { success: false, message: 'This giveaway is currently paused.' };

        // Check if scheduled and not yet started
        if (giveaway.startTimestamp > Date.now()) {
            return { success: false, message: 'This giveaway hasn\'t started yet!' };
        }

        const userId = interaction.user.id;

        // Check blacklists (giveaway-specific + global)
        const globalConfig = config;
        const allBlacklistUsers = [...(giveaway.blacklistUserIds || []), ...(globalConfig.globalBlacklistUserIds || [])];
        const allBlacklistRoles = [...(giveaway.blacklistRoleIds || []), ...(globalConfig.globalBlacklistRoleIds || [])];

        if (allBlacklistUsers.includes(userId)) {
            return { success: false, message: 'You are blacklisted from this giveaway.' };
        }

        // Check role blacklist
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member && allBlacklistRoles.length > 0) {
            if (allBlacklistRoles.some(rId => member.roles.cache.has(rId))) {
                return { success: false, message: 'You are blacklisted from this giveaway.' };
            }
        }

        // Toggle join/leave
        const existingIndex = giveaway.entries.indexOf(userId);
        if (existingIndex !== -1) {
            // Leave — remove ALL entries for this user (includes bonus)
            giveaway.entries = giveaway.entries.filter(id => id !== userId);
            await this.setConfig(interaction.guild.id, config);
            await this.updateGiveawayEmbed(interaction.guild, giveaway);
            return { success: true, action: 'leave' };
        }

        // --- Validate requirements ---
        if (!member) return { success: false, message: 'Could not verify your server membership.' };

        // Check if user has bypass role
        const hasBypass = giveaway.bypassRoleIds && giveaway.bypassRoleIds.some(rId => member.roles.cache.has(rId));

        if (!hasBypass) {
            // Voice Requirement
            if (giveaway.voiceRequirement && !member.voice.channelId) {
                return { success: false, message: '🎙️ You must be connected to a Voice Channel to join this giveaway.' };
            }

            // Role requirements (ANY match)
            if (giveaway.reqRoleIds && giveaway.reqRoleIds.length > 0) {
                const hasRole = giveaway.reqRoleIds.some(rId => member.roles.cache.has(rId));
                if (!hasRole) {
                    const roleNames = giveaway.reqRoleIds.map(r => `<@&${r}>`).join(' or ');
                    return { success: false, message: `You need one of these roles: ${roleNames}` };
                }
            }

            // Account age
            if (giveaway.minAccountAge) {
                const accountAge = (Date.now() - interaction.user.createdTimestamp) / 86400000;
                if (accountAge < giveaway.minAccountAge) {
                    return { success: false, message: `Your account must be at least ${giveaway.minAccountAge} days old.` };
                }
            }

            // Server time
            if (giveaway.minMemberAge) {
                const memberAge = (Date.now() - member.joinedTimestamp) / 86400000;
                if (memberAge < giveaway.minMemberAge) {
                    return { success: false, message: `You must be in the server for at least ${giveaway.minMemberAge} days.` };
                }
            }
        }

        // Add base entry
        giveaway.entries.push(userId);

        // Add bonus entries
        if (giveaway.bonusRoles && giveaway.bonusRoles.length > 0) {
            for (const bonus of giveaway.bonusRoles) {
                if (member.roles.cache.has(bonus.roleId)) {
                    for (let i = 0; i < bonus.bonusEntries; i++) {
                        giveaway.entries.push(userId);
                    }
                }
            }
        }

        await this.setConfig(interaction.guild.id, config);

        // Drop mode: check if enough entries
        if (giveaway.dropMode) {
            const uniqueEntries = [...new Set(giveaway.entries)];
            if (uniqueEntries.length >= giveaway.dropCount) {
                // Auto-end the drop giveaway
                setTimeout(() => this.endGiveaway(interaction.guild.id, giveaway.messageId), 500);
            }
        }

        await this.updateGiveawayEmbed(interaction.guild, giveaway);
        return { success: true, action: 'join' };
    }

    // ═══════════════════════════════════════════════════════════════
    // PAUSE / RESUME
    // ═══════════════════════════════════════════════════════════════

    async pauseGiveaway(guildId, messageId) {
        const config = await this.getGiveaways(guildId);
        const giveaway = config.giveaways.find(g => g.messageId === messageId && !g.ended);
        if (!giveaway) return { success: false, error: 'Giveaway not found.' };
        if (giveaway.paused) return { success: false, error: 'Already paused.' };

        giveaway.paused = true;
        // Store remaining time so we can resume later
        giveaway.pausedAt = Date.now();
        giveaway.timeRemaining = giveaway.endTimestamp - Date.now();

        await this.setConfig(guildId, config);
        await this.updateGiveawayEmbed(this.client.guilds.cache.get(guildId), giveaway);

        return { success: true };
    }

    async resumeGiveaway(guildId, messageId) {
        const config = await this.getGiveaways(guildId);
        const giveaway = config.giveaways.find(g => g.messageId === messageId && !g.ended);
        if (!giveaway) return { success: false, error: 'Giveaway not found.' };
        if (!giveaway.paused) return { success: false, error: 'Not paused.' };

        giveaway.paused = false;
        giveaway.endTimestamp = Date.now() + (giveaway.timeRemaining || 60000);
        delete giveaway.pausedAt;
        delete giveaway.timeRemaining;

        await this.setConfig(guildId, config);
        await this.updateGiveawayEmbed(this.client.guilds.cache.get(guildId), giveaway);

        return { success: true };
    }

    // ═══════════════════════════════════════════════════════════════
    // END / REROLL / DELETE
    // ═══════════════════════════════════════════════════════════════

    async endGiveaway(guildId, messageId) {
        const config = await this.getGiveaways(guildId);
        const giveaway = config.giveaways.find(g => g.messageId === messageId && !g.ended);
        if (!giveaway) return null;

        giveaway.ended = true;
        const winners = this.pickWinners(giveaway.entries, giveaway.winners);

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return null;

        const channel = guild.channels.cache.get(giveaway.channelId);
        if (!channel) return null;

        try {
            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (message) {
                const winnerMentions = winners.length > 0
                    ? winners.map(w => `<@${w}>`).join(', ')
                    : 'No valid entries';

                const hostDisplay = giveaway.sponsorText ? giveaway.sponsorText : `<@${giveaway.hostId}>`;

                const embed = VornEmbed.create()
                    .setTitle(`🎉 ${giveaway.prize}`)
                    .setDescription([
                        `**Winners:** ${winnerMentions}`,
                        `**Hosted by:** ${hostDisplay}`,
                        '',
                        `-# Ended · ${[...new Set(giveaway.entries)].length} entries`
                    ].join('\n'));

                if (giveaway.embedColor) embed.setColor(giveaway.embedColor);
                if (giveaway.bannerUrl) embed.setImage(giveaway.bannerUrl);

                const disabledButton = new ButtonBuilder()
                    .setCustomId('gw_join')
                    .setEmoji('🎉')
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel('Ended')
                    .setDisabled(true);

                await message.edit({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(disabledButton)]
                });

                if (winners.length > 0) {
                    const winMsg = await channel.send({
                        content: `🎉 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`
                    });

                    // DM winners
                    for (const w of winners) {
                        try {
                            const user = await this.client.users.fetch(w);
                            if (user) {
                                await user.send({
                                    embeds: [VornEmbed.success(
                                        `You won a giveaway in **${guild.name}**!`,
                                        `Prize: **${giveaway.prize}**\n[Jump to Giveaway](${message.url})`
                                    )]
                                });
                            }
                        } catch (err) { }
                    }
                } else {
                    await channel.send({
                        embeds: [VornEmbed.info('Giveaway', `No valid entries for **${giveaway.prize}**`)]
                    });
                }
            }
        } catch (e) {
            console.error(`[Giveaway] Failed to end giveaway: ${e.message}`);
        }

        await this.setConfig(guildId, config);
        return winners;
    }

    async rerollGiveaway(guildId, messageId, count = 1) {
        const config = await this.getGiveaways(guildId);
        const giveaway = config.giveaways.find(g => g.messageId === messageId);
        if (!giveaway || !giveaway.ended) return null;

        const winners = this.pickWinners(giveaway.entries, count);

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return null;

        const channel = guild.channels.cache.get(giveaway.channelId);
        if (!channel) return null;

        if (winners.length > 0) {
            const mentions = winners.map(w => `<@${w}>`).join(', ');
            await channel.send({
                content: `🎉 Reroll! New winner(s): ${mentions} for **${giveaway.prize}**!`
            });
        }

        return winners;
    }

    async deleteGiveaway(guildId, messageId) {
        const config = await this.getGiveaways(guildId);
        const idx = config.giveaways.findIndex(g => g.messageId === messageId);
        if (idx === -1) return false;

        const giveaway = config.giveaways[idx];

        try {
            const guild = this.client.guilds.cache.get(guildId);
            const channel = guild?.channels.cache.get(giveaway.channelId);
            const message = await channel?.messages.fetch(messageId).catch(() => null);
            if (message) await message.delete();
        } catch { }

        config.giveaways.splice(idx, 1);
        await this.setConfig(guildId, config);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPER METHODS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Pick random winners from entries (weighted but win only once)
     */
    pickWinners(entries, count) {
        if (entries.length === 0) return [];

        const winners = [];
        const pool = [...entries];

        for (let i = 0; i < count && pool.length > 0; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            const winner = pool[idx];
            winners.push(winner);
            // Remove ALL entries for this winner (ensures they only win once)
            for (let j = pool.length - 1; j >= 0; j--) {
                if (pool[j] === winner) pool.splice(j, 1);
            }
        }

        return winners;
    }

    /**
     * Update the giveaway embed with current entry count and status
     */
    async updateGiveawayEmbed(guild, giveaway) {
        try {
            const channel = guild.channels.cache.get(giveaway.channelId);
            if (!channel) return;
            const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
            if (!message) return;

            const uniqueEntries = [...new Set(giveaway.entries)].length;

            const descLines = [];

            if (giveaway.paused) {
                descLines.push('⏸️ **PAUSED**');
            } else if (giveaway.dropMode) {
                descLines.push(`**DROP** ─ First **${giveaway.dropCount}** to join win!`);
            } else {
                descLines.push(`Ends: <t:${Math.floor(giveaway.endTimestamp / 1000)}:R>`);
            }

            const hostDisplay = giveaway.sponsorText ? giveaway.sponsorText : `<@${giveaway.hostId}>`;
            descLines.push(`Hosted by: ${hostDisplay}`);
            descLines.push(`Winners: **${giveaway.winners}**`);

            if (giveaway.embedDescription) descLines.push('', giveaway.embedDescription);

            // Requirements
            const reqs = [];
            if (giveaway.voiceRequirement) reqs.push(`🎙️ Must be in a Voice Channel`);
            if (giveaway.reqRoleIds?.length > 0) reqs.push(`Role: ${giveaway.reqRoleIds.map(r => `<@&${r}>`).join(' or ')}`);
            if (giveaway.minAccountAge) reqs.push(`Account age: ${giveaway.minAccountAge}d+`);
            if (giveaway.minMemberAge) reqs.push(`Server time: ${giveaway.minMemberAge}d+`);
            if (giveaway.bypassRoleIds?.length > 0) reqs.push(`Bypass Roles: ${giveaway.bypassRoleIds.map(r => `<@&${r}>`).join(', ')}`);

            if (reqs.length > 0) {
                descLines.push('', '**Requirements**');
                reqs.forEach(r => descLines.push(`> ${r}`));
            }

            // Bonus entries
            if (giveaway.bonusRoles?.length > 0) {
                descLines.push('', '**Bonus Entries**');
                giveaway.bonusRoles.forEach(b => descLines.push(`> <@&${b.roleId}>: +${b.bonusEntries} entries`));
            }

            descLines.push('', '**Click 🎉 to join!**');
            descLines.push(`-# Entries: ${uniqueEntries}`);

            const embed = VornEmbed.create()
                .setTitle(`🎉 ${giveaway.prize}`)
                .setDescription(descLines.join('\n'));

            if (giveaway.embedColor) embed.setColor(giveaway.embedColor);
            if (giveaway.bannerUrl) embed.setImage(giveaway.bannerUrl);

            const button = new ButtonBuilder()
                .setCustomId('gw_join')
                .setEmoji('🎉')
                .setStyle(giveaway.paused ? ButtonStyle.Secondary : ButtonStyle.Primary)
                .setLabel(giveaway.paused ? 'Paused' : 'Join')
                .setDisabled(giveaway.paused);

            await message.edit({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(button)]
            });
        } catch { }
    }

    /**
     * Clean ended giveaways from a guild
     */
    async cleanGiveaways(guildId) {
        const config = await this.getGiveaways(guildId);
        const before = config.giveaways.length;
        config.giveaways = config.giveaways.filter(g => !g.ended);
        await this.setConfig(guildId, config);
        return before - config.giveaways.length;
    }

    /**
     * List all giveaways for a guild
     */
    async listGiveaways(guildId) {
        const config = await this.getGiveaways(guildId);
        return config.giveaways;
    }

    // ═══════════════════════════════════════════════════════════════
    // CHECK LOOP
    // ═══════════════════════════════════════════════════════════════

    // Public start method (called from index.js)
    start() {
        // Constructor already calls startCheckLoop, this is a safe re-entry
        if (!this.checkTimer) this.startCheckLoop();
    }

    startCheckLoop() {
        this.checkTimer = setInterval(() => this.checkGiveaways(), 15000);
        setTimeout(() => this.checkGiveaways(), 5000);
    }

    async checkGiveaways() {
        const now = Date.now();

        for (const [guildId] of this.client.guilds.cache) {
            try {
                const config = await this.getGiveaways(guildId);
                let updated = false;

                for (const giveaway of config.giveaways) {
                    if (giveaway.ended || giveaway.paused || giveaway.dropMode) continue;

                    // Check for scheduled giveaways that should now activate
                    if (giveaway.startTimestamp && giveaway.startTimestamp <= now && !giveaway._activated) {
                        giveaway._activated = true;
                        updated = true;
                        const guild = this.client.guilds.cache.get(guildId);
                        if (guild) {
                            await this.updateGiveawayEmbed(guild, giveaway);
                            if (giveaway.pingRoleId) {
                                const channel = guild.channels.cache.get(giveaway.channelId);
                                if (channel) {
                                    await channel.send({ content: `<@&${giveaway.pingRoleId}>` }).then(m => setTimeout(() => m.delete().catch(() => null), 2000));
                                }
                            }
                        }
                    }

                    // Check for giveaways that should end
                    if (now >= giveaway.endTimestamp) {
                        await this.endGiveaway(guildId, giveaway.messageId);
                    }
                }

                if (updated) await this.setConfig(guildId, config);
            } catch { }
        }
    }

    /**
     * Find a giveaway by message ID across all guilds
     */
    async findGiveaway(guildId, messageId) {
        const config = await this.getGiveaways(guildId);
        return config.giveaways.find(g => g.messageId === messageId) || null;
    }
}

module.exports = GiveawayManager;
