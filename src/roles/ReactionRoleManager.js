/**
 * Vorn — Reaction Role Manager (Enhanced)
 * Advanced panel management with multiple types, modes, temp roles,
 * role requirements, limits, cooldowns, analytics, and logging
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const VornEmbed = require('../utils/embedBuilder');

class ReactionRoleManager {
    constructor(client) {
        this.client = client;

        // Cooldown tracker: `${guildId}-${userId}` -> timestamp
        this.cooldowns = new Map();

        // Temp role expiry loop
        this.tempRoleInterval = setInterval(() => this.processTempRoles(), 60 * 1000);
        setTimeout(() => this.processTempRoles(), 15000);
    }

    /**
     * Get reaction role config
     */
    async getConfig(guildId) {
        const config = await this.client.db.get(guildId, 'reactionrole_config') || {};
        if (!config.panels) config.panels = [];
        if (!config.analytics) config.analytics = {};
        if (!config.tempRoles) config.tempRoles = [];
        if (!config.logChannelId) config.logChannelId = null;
        if (!config.globalCooldown) config.globalCooldown = 0;
        if (!config.dmConfirmation) config.dmConfirmation = false;
        return config;
    }

    /**
     * Save config
     */
    async setConfig(guildId, config) {
        await this.client.db.set(guildId, 'reactionrole_config', config);
    }

    /**
     * Create a new panel
     */
    async createPanel(channel, options) {
        const {
            type, mode, title, description, roles,
            color, image, footer, thumbnail,
            maxRoles, requiredRoleId, cooldown
        } = options;

        const embed = VornEmbed.create()
            .setTitle(title || 'Role Selection')
            .setDescription(description || 'Select your roles below.');

        if (color) {
            try { embed.setColor(color); } catch {}
        }
        if (image) embed.setImage(image);
        if (thumbnail) embed.setThumbnail(thumbnail);
        if (footer) embed.setFooter({ text: footer });

        // Add role list to embed description if SELECT type
        if (type === 'SELECT' && roles.length > 0) {
            const roleList = roles.map(r => {
                const emoji = r.emoji ? `${r.emoji} ` : '';
                return `${emoji}<@&${r.roleId}>${r.description ? ` ─ ${r.description}` : ''}`;
            }).join('\n');

            const descLines = [description || 'Select your roles below.', '', roleList];
            embed.setDescription(descLines.join('\n'));
        }

        let components = [];
        const panelId = Date.now().toString();

        if (type === 'BUTTON') {
            for (let i = 0; i < roles.length; i += 5) {
                const row = new ActionRowBuilder();
                const chunk = roles.slice(i, i + 5);

                for (const role of chunk) {
                    const button = new ButtonBuilder()
                        .setCustomId(`rr_btn_${role.roleId}`)
                        .setLabel(role.label || role.roleName)
                        .setStyle(this.getButtonStyle(role.style));

                    if (role.emoji) button.setEmoji(role.emoji);
                    row.addComponents(button);
                }
                components.push(row);
            }
        } else if (type === 'SELECT') {
            const select = new StringSelectMenuBuilder()
                .setCustomId(`rr_sel_${panelId}`)
                .setPlaceholder('Select roles...')
                .setMinValues(0)
                .setMaxValues(maxRoles || roles.length);

            for (const role of roles) {
                const option = {
                    label: role.label || role.roleName,
                    value: role.roleId,
                    description: role.description || undefined
                };
                if (role.emoji) option.emoji = role.emoji;
                select.addOptions(option);
            }

            components.push(new ActionRowBuilder().addComponents(select));
        }

        const message = await channel.send({ embeds: [embed], components });

        // Save panel
        const config = await this.getConfig(channel.guild.id);
        config.panels.push({
            id: panelId,
            messageId: message.id,
            channelId: channel.id,
            type,
            mode: mode || 'normal',
            roles,
            embed: { title, description, color, image, footer, thumbnail },
            // New features
            maxRoles: maxRoles || null,
            requiredRoleId: requiredRoleId || null,
            cooldown: cooldown || 0,
            tempDuration: null
        });
        await this.setConfig(channel.guild.id, config);

        return message;
    }

    /**
     * Handle button interaction
     */
    async handleButton(interaction) {
        const roleId = interaction.customId.replace('rr_btn_', '');
        const member = interaction.member;
        const guild = interaction.guild;

        const config = await this.getConfig(guild.id);
        const panel = config.panels.find(p => p.messageId === interaction.message.id);

        if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });

        // Check cooldown
        const cooldownCheck = this.checkCooldown(guild.id, member.id, panel.cooldown || config.globalCooldown);
        if (cooldownCheck) {
            return interaction.reply({ content: `Please wait **${cooldownCheck}s** before changing roles again.`, ephemeral: true });
        }

        // Check required role
        if (panel.requiredRoleId && !member.roles.cache.has(panel.requiredRoleId)) {
            return interaction.reply({ content: `You need <@&${panel.requiredRoleId}> to use this panel.`, ephemeral: true });
        }

        const hasRole = member.roles.cache.has(roleId);
        const mode = panel.mode;

        try {
            let action = '';

            if (mode === 'verify') {
                if (!hasRole) {
                    await member.roles.add(roleId);
                    action = 'added';
                } else {
                    return interaction.reply({ content: 'You already have this role.', ephemeral: true });
                }
            } else if (mode === 'reversed') {
                if (hasRole) {
                    await member.roles.remove(roleId);
                    action = 'removed';
                } else {
                    return interaction.reply({ content: 'You don\'t have this role.', ephemeral: true });
                }
            } else if (mode === 'unique') {
                // Check max roles
                if (!hasRole && panel.maxRoles) {
                    const currentPanelRoles = panel.roles.filter(r => member.roles.cache.has(r.roleId)).length;
                    if (currentPanelRoles >= panel.maxRoles) {
                        // In unique mode, we remove others anyway, so this is fine
                    }
                }

                for (const r of panel.roles) {
                    if (r.roleId !== roleId && member.roles.cache.has(r.roleId)) {
                        await member.roles.remove(r.roleId);
                    }
                }
                await member.roles.add(roleId);
                action = 'set';
            } else {
                // Normal toggle
                if (hasRole) {
                    await member.roles.remove(roleId);
                    action = 'removed';
                } else {
                    // Check max roles limit
                    if (panel.maxRoles) {
                        const currentPanelRoles = panel.roles.filter(r => member.roles.cache.has(r.roleId)).length;
                        if (currentPanelRoles >= panel.maxRoles) {
                            return interaction.reply({ content: `You can only have **${panel.maxRoles}** role(s) from this panel.`, ephemeral: true });
                        }
                    }
                    await member.roles.add(roleId);
                    action = 'added';
                }
            }

            // Set cooldown
            this.setCooldown(guild.id, member.id, panel.cooldown || config.globalCooldown);

            // Handle temp roles
            if (panel.tempDuration && action === 'added') {
                await this.addTempRole(guild.id, member.id, roleId, panel.tempDuration);
            }

            // Track analytics
            await this.trackAnalytics(guild.id, roleId, action);

            // Log
            await this.logRoleChange(guild.id, member, roleId, action, panel);

            // DM confirmation
            if (config.dmConfirmation) {
                this.sendDMConfirmation(member, roleId, action, guild.name).catch(() => {});
            }

            const roleName = panel.roles.find(r => r.roleId === roleId)?.label || 'Role';
            const actionText = action === 'added' ? 'added' : action === 'removed' ? 'removed' : 'set';
            return interaction.reply({ content: `**${roleName}** ${actionText}.`, ephemeral: true });

        } catch (error) {
            return interaction.reply({ content: `Failed: ${error.message}`, ephemeral: true });
        }
    }

    /**
     * Handle select menu interaction
     */
    async handleSelect(interaction) {
        const panelId = interaction.customId.replace('rr_sel_', '');
        const member = interaction.member;
        const guild = interaction.guild;
        const selectedRoleIds = interaction.values;

        const config = await this.getConfig(guild.id);
        const panel = config.panels.find(p => p.id === panelId);

        if (!panel) return interaction.reply({ content: 'Panel not found.', ephemeral: true });

        // Check cooldown
        const cooldownCheck = this.checkCooldown(guild.id, member.id, panel.cooldown || config.globalCooldown);
        if (cooldownCheck) {
            return interaction.reply({ content: `Please wait **${cooldownCheck}s** before changing roles again.`, ephemeral: true });
        }

        // Check required role
        if (panel.requiredRoleId && !member.roles.cache.has(panel.requiredRoleId)) {
            return interaction.reply({ content: `You need <@&${panel.requiredRoleId}> to use this panel.`, ephemeral: true });
        }

        // Check max roles
        if (panel.maxRoles && selectedRoleIds.length > panel.maxRoles) {
            return interaction.reply({ content: `You can only select up to **${panel.maxRoles}** role(s).`, ephemeral: true });
        }

        try {
            const added = [];
            const removed = [];

            for (const role of panel.roles) {
                const hasRole = member.roles.cache.has(role.roleId);
                const isSelected = selectedRoleIds.includes(role.roleId);

                if (panel.mode === 'verify') {
                    if (isSelected && !hasRole) {
                        await member.roles.add(role.roleId);
                        added.push(role.label || role.roleName);
                    }
                } else if (panel.mode === 'reversed') {
                    if (isSelected && hasRole) {
                        await member.roles.remove(role.roleId);
                        removed.push(role.label || role.roleName);
                    }
                } else {
                    if (isSelected && !hasRole) {
                        await member.roles.add(role.roleId);
                        added.push(role.label || role.roleName);

                        if (panel.tempDuration) {
                            await this.addTempRole(guild.id, member.id, role.roleId, panel.tempDuration);
                        }
                    } else if (!isSelected && hasRole) {
                        await member.roles.remove(role.roleId);
                        removed.push(role.label || role.roleName);
                    }
                }
            }

            // Set cooldown
            this.setCooldown(guild.id, member.id, panel.cooldown || config.globalCooldown);

            // Track analytics
            for (const roleId of selectedRoleIds) {
                await this.trackAnalytics(guild.id, roleId, 'added');
            }

            // Log
            if (added.length > 0 || removed.length > 0) {
                const changes = [];
                if (added.length > 0) changes.push(`Added: ${added.join(', ')}`);
                if (removed.length > 0) changes.push(`Removed: ${removed.join(', ')}`);
                await this.logRoleChange(guild.id, member, null, changes.join(' | '), panel);
            }

            if (config.dmConfirmation && (added.length > 0 || removed.length > 0)) {
                const lines = [];
                if (added.length > 0) lines.push(`Added: **${added.join(', ')}**`);
                if (removed.length > 0) lines.push(`Removed: **${removed.join(', ')}**`);
                member.send({ embeds: [VornEmbed.create().setDescription(`Roles updated in **${guild.name}**\n${lines.join('\n')}`)] }).catch(() => {});
            }

            return interaction.reply({ content: 'Roles updated.', ephemeral: true });
        } catch (error) {
            return interaction.reply({ content: `Failed: ${error.message}`, ephemeral: true });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // COOLDOWNS
    // ═══════════════════════════════════════════════════════════════

    checkCooldown(guildId, userId, cooldownSeconds) {
        if (!cooldownSeconds || cooldownSeconds <= 0) return null;

        const key = `${guildId}-${userId}`;
        const lastUse = this.cooldowns.get(key);

        if (lastUse) {
            const elapsed = (Date.now() - lastUse) / 1000;
            if (elapsed < cooldownSeconds) {
                return Math.ceil(cooldownSeconds - elapsed);
            }
        }
        return null;
    }

    setCooldown(guildId, userId, cooldownSeconds) {
        if (!cooldownSeconds || cooldownSeconds <= 0) return;
        const key = `${guildId}-${userId}`;
        this.cooldowns.set(key, Date.now());
        setTimeout(() => this.cooldowns.delete(key), cooldownSeconds * 1000);
    }

    // ═══════════════════════════════════════════════════════════════
    // TEMP ROLES
    // ═══════════════════════════════════════════════════════════════

    async addTempRole(guildId, userId, roleId, durationMs) {
        const config = await this.getConfig(guildId);
        config.tempRoles.push({
            userId,
            roleId,
            guildId,
            expiresAt: Date.now() + durationMs
        });
        await this.setConfig(guildId, config);
    }

    async processTempRoles() {
        const now = Date.now();

        for (const [guildId] of this.client.guilds.cache) {
            try {
                const config = await this.getConfig(guildId);
                if (!config.tempRoles || config.tempRoles.length === 0) continue;

                const expired = config.tempRoles.filter(t => now >= t.expiresAt);
                const remaining = config.tempRoles.filter(t => now < t.expiresAt);

                if (expired.length === 0) continue;

                const guild = this.client.guilds.cache.get(guildId);
                if (!guild) continue;

                for (const temp of expired) {
                    try {
                        const member = await guild.members.fetch(temp.userId).catch(() => null);
                        if (member && member.roles.cache.has(temp.roleId)) {
                            await member.roles.remove(temp.roleId, 'Temp role expired');
                            console.log(`[Vorn] Temp role ${temp.roleId} removed from ${temp.userId}`);
                        }
                    } catch {}
                }

                config.tempRoles = remaining;
                await this.setConfig(guildId, config);
            } catch {}
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ANALYTICS
    // ═══════════════════════════════════════════════════════════════

    async trackAnalytics(guildId, roleId, action) {
        try {
            const config = await this.getConfig(guildId);
            if (!config.analytics[roleId]) {
                config.analytics[roleId] = { adds: 0, removes: 0 };
            }

            if (action === 'added' || action === 'set') {
                config.analytics[roleId].adds++;
            } else if (action === 'removed') {
                config.analytics[roleId].removes++;
            }

            await this.setConfig(guildId, config);
        } catch {}
    }

    async getAnalytics(guildId) {
        const config = await this.getConfig(guildId);
        return config.analytics;
    }

    // ═══════════════════════════════════════════════════════════════
    // LOGGING
    // ═══════════════════════════════════════════════════════════════

    async logRoleChange(guildId, member, roleId, action, panel) {
        try {
            const config = await this.getConfig(guildId);
            if (!config.logChannelId) return;

            const channel = this.client.channels.cache.get(config.logChannelId);
            if (!channel) return;

            const roleMention = roleId ? `<@&${roleId}>` : 'Multiple';
            const embed = VornEmbed.create()
                .setDescription([
                    `### Role Change`,
                    '',
                    `**User** ─ ${member} \`${member.user.tag}\``,
                    `**Role** ─ ${roleMention}`,
                    `**Action** ─ ${action}`,
                    `**Panel** ─ ${panel.embed?.title || 'Unknown'}`
                ].join('\n'))
                .setFooter({ text: `ID: ${member.id}` });

            await channel.send({ embeds: [embed] }).catch(() => {});
        } catch {}
    }

    // ═══════════════════════════════════════════════════════════════
    // DM CONFIRMATION
    // ═══════════════════════════════════════════════════════════════

    async sendDMConfirmation(member, roleId, action, guildName) {
        const actionText = action === 'added' ? 'added to' : action === 'removed' ? 'removed from' : 'updated in';
        const embed = VornEmbed.create()
            .setDescription(`<@&${roleId}> has been **${actionText}** you in **${guildName}**.`);

        await member.send({ embeds: [embed] });
    }

    // ═══════════════════════════════════════════════════════════════
    // PANEL MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    /**
     * Add role to existing panel
     */
    async addRoleToPanel(guildId, messageId, roleData) {
        const config = await this.getConfig(guildId);
        const panelIndex = config.panels.findIndex(p => p.messageId === messageId);

        if (panelIndex === -1) return false;

        config.panels[panelIndex].roles.push(roleData);
        await this.setConfig(guildId, config);

        await this.rebuildPanel(guildId, messageId);
        return true;
    }

    /**
     * Remove role from panel
     */
    async removeRoleFromPanel(guildId, messageId, roleId) {
        const config = await this.getConfig(guildId);
        const panelIndex = config.panels.findIndex(p => p.messageId === messageId);

        if (panelIndex === -1) return false;

        config.panels[panelIndex].roles = config.panels[panelIndex].roles.filter(r => r.roleId !== roleId);
        await this.setConfig(guildId, config);

        await this.rebuildPanel(guildId, messageId);
        return true;
    }

    /**
     * Delete panel
     */
    async deletePanel(guildId, messageId) {
        const config = await this.getConfig(guildId);
        const panel = config.panels.find(p => p.messageId === messageId);

        if (!panel) return false;

        try {
            const channel = await this.client.channels.fetch(panel.channelId);
            const message = await channel.messages.fetch(messageId);
            await message.delete();
        } catch { }

        config.panels = config.panels.filter(p => p.messageId !== messageId);
        await this.setConfig(guildId, config);
        return true;
    }

    /**
     * Duplicate a panel to a new channel
     */
    async duplicatePanel(guildId, messageId, targetChannel) {
        const config = await this.getConfig(guildId);
        const panel = config.panels.find(p => p.messageId === messageId);

        if (!panel) return null;

        return await this.createPanel(targetChannel, {
            type: panel.type,
            mode: panel.mode,
            title: panel.embed?.title,
            description: panel.embed?.description,
            roles: [...panel.roles],
            color: panel.embed?.color,
            image: panel.embed?.image,
            footer: panel.embed?.footer,
            thumbnail: panel.embed?.thumbnail,
            maxRoles: panel.maxRoles,
            requiredRoleId: panel.requiredRoleId,
            cooldown: panel.cooldown
        });
    }

    /**
     * Rebuild panel message
     */
    async rebuildPanel(guildId, messageId) {
        const config = await this.getConfig(guildId);
        const panel = config.panels.find(p => p.messageId === messageId);

        if (!panel) return;

        try {
            const channel = await this.client.channels.fetch(panel.channelId);
            const message = await channel.messages.fetch(messageId);

            let components = [];

            if (panel.type === 'BUTTON') {
                for (let i = 0; i < panel.roles.length; i += 5) {
                    const row = new ActionRowBuilder();
                    const chunk = panel.roles.slice(i, i + 5);

                    for (const role of chunk) {
                        const button = new ButtonBuilder()
                            .setCustomId(`rr_btn_${role.roleId}`)
                            .setLabel(role.label || 'Role')
                            .setStyle(this.getButtonStyle(role.style));

                        if (role.emoji) button.setEmoji(role.emoji);
                        row.addComponents(button);
                    }
                    components.push(row);
                }
            } else if (panel.type === 'SELECT') {
                const select = new StringSelectMenuBuilder()
                    .setCustomId(`rr_sel_${panel.id}`)
                    .setPlaceholder('Select roles...')
                    .setMinValues(0)
                    .setMaxValues(panel.maxRoles || panel.roles.length);

                for (const role of panel.roles) {
                    select.addOptions({
                        label: role.label || 'Role',
                        value: role.roleId,
                        description: role.description || undefined,
                        emoji: role.emoji || undefined
                    });
                }

                components.push(new ActionRowBuilder().addComponents(select));
            }

            const embed = VornEmbed.create()
                .setTitle(panel.embed?.title || 'Role Selection')
                .setDescription(panel.embed?.description || 'Select your roles below.');

            if (panel.embed?.color) {
                try { embed.setColor(panel.embed.color); } catch {}
            }
            if (panel.embed?.image) embed.setImage(panel.embed.image);
            if (panel.embed?.thumbnail) embed.setThumbnail(panel.embed.thumbnail);
            if (panel.embed?.footer) embed.setFooter({ text: panel.embed.footer });

            await message.edit({ embeds: [embed], components });
        } catch (error) {
            console.error(`[Vorn] Reaction role rebuild failed: ${error.message}`);
        }
    }

    /**
     * Get button style from string
     */
    getButtonStyle(style) {
        const styles = {
            'Primary': ButtonStyle.Primary,
            'Secondary': ButtonStyle.Secondary,
            'Success': ButtonStyle.Success,
            'Danger': ButtonStyle.Danger
        };
        return styles[style] || ButtonStyle.Primary;
    }
}

module.exports = ReactionRoleManager;
