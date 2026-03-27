/**
 * Vorn — Anti-Raid Manager
 * Detection, rate limiting, lockdown, logging, and alerts
 */

const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

class AntiRaidManager {
    constructor(client) {
        this.client = client;

        // In-memory rate trackers
        this.joinTracker = new Map(); // guildId -> [timestamps]
        this.messageTracker = new Map(); // `${guildId}-${userId}` -> [timestamps]

        // Lockdown state (persistent across restart)
        this.checkLockdowns();
    }

    /**
     * Check and restore lockdowns on startup
     */
    async checkLockdowns() {
        // Wait for client to be ready
        if (!this.client.isReady()) {
            this.client.once('ready', () => this.checkLockdowns());
            return;
        }

        for (const [guildId] of this.client.guilds.cache) {
            try {
                const config = await this.getConfig(guildId);
                if (config.lockdown.active) {
                    const remaining = config.lockdown.until - Date.now();
                    if (remaining > 0) {
                        // Schedule unlock
                        const guild = this.client.guilds.cache.get(guildId);
                        if (guild) {
                            setTimeout(() => this.deactivateLockdown(guild), remaining);
                            console.log(`[Vorn AntiRaid] Restored lockdown for ${guild.name}, ${Math.round(remaining / 60000)}m remaining`);
                        }
                    } else {
                        // Lockdown expired while bot was offline, unlock now
                        const guild = this.client.guilds.cache.get(guildId);
                        if (guild) await this.deactivateLockdown(guild);
                    }
                }
            } catch (e) {
                // Ignore
            }
        }
    }

    /**
     * Get Anti-Raid config
     */
    async getConfig(guildId) {
        const config = await this.client.db.get(guildId, 'antiraid_config') || {};

        return {
            enabled: config.enabled ?? false,
            lockdown: config.lockdown ?? { active: false, until: null },

            // Logging & Alerts
            logChannelId: config.logChannelId ?? null,
            alertRoleId: config.alertRoleId ?? null,

            // Quarantine
            quarantineRoleId: config.quarantineRoleId ?? null,

            // Whitelist
            whitelist: config.whitelist ?? [],

            // Lockdown settings
            lockdownAction: config.lockdownAction ?? 'quarantine', // What to do with joins during lockdown: kick, ban, quarantine
            lockdownDuration: config.lockdownDuration ?? 10, // Default minutes

            // Modules
            modules: {
                join_rate: {
                    enabled: config.modules?.join_rate?.enabled ?? true,
                    limit: config.modules?.join_rate?.limit ?? 10,
                    time: config.modules?.join_rate?.time ?? 30000,
                    action: config.modules?.join_rate?.action ?? 'lockdown'
                },
                account_age: {
                    enabled: config.modules?.account_age?.enabled ?? false,
                    minAge: config.modules?.account_age?.minAge ?? 7,
                    action: config.modules?.account_age?.action ?? 'kick'
                },
                no_avatar: {
                    enabled: config.modules?.no_avatar?.enabled ?? false,
                    action: config.modules?.no_avatar?.action ?? 'kick'
                },
                message_flood: {
                    enabled: config.modules?.message_flood?.enabled ?? true,
                    limit: config.modules?.message_flood?.limit ?? 5,
                    time: config.modules?.message_flood?.time ?? 3000,
                    action: config.modules?.message_flood?.action ?? 'timeout'
                },
                mention_spam: {
                    enabled: config.modules?.mention_spam?.enabled ?? true,
                    limit: config.modules?.mention_spam?.limit ?? 10,
                    action: config.modules?.mention_spam?.action ?? 'timeout'
                }
            },

            ...config
        };
    }

    /**
     * Save config
     */
    async setConfig(guildId, config) {
        await this.client.db.set(guildId, 'antiraid_config', config);
    }

    /**
     * Check if user is whitelisted
     */
    async isWhitelisted(guildId, userId) {
        const config = await this.getConfig(guildId);
        return config.whitelist.includes(userId);
    }

    /**
     * Log action to log channel
     */
    async log(guild, type, data) {
        const config = await this.getConfig(guild.id);
        if (!config.logChannelId) return;

        const logChannel = guild.channels.cache.get(config.logChannelId);
        if (!logChannel) return;

        try {
            let color, title, description;

            switch (type) {
                case 'RAID_DETECTED':
                    color = 0xED4245;
                    title = 'Raid Detected';
                    description = `**${data.count}** joins in **${data.time / 1000}s**\nAction: **${data.action}**`;
                    break;

                case 'LOCKDOWN_START':
                    color = 0xFEE75C;
                    title = 'Lockdown Activated';
                    description = `Duration: **${data.duration}** minutes\nTriggered by: ${data.triggeredBy}`;
                    break;

                case 'LOCKDOWN_END':
                    color = 0x57F287;
                    title = 'Lockdown Ended';
                    description = 'All channels unlocked';
                    break;

                case 'ACTION_TAKEN':
                    color = 0xEB459E;
                    title = 'Action Taken';
                    description = `**User:** <@${data.userId}> (${data.userId})\n**Action:** ${data.action}\n**Reason:** ${data.reason}`;
                    break;

                case 'QUARANTINE':
                    color = 0x5865F2;
                    title = 'User Quarantined';
                    description = `**User:** <@${data.userId}>\n**Reason:** ${data.reason}`;
                    break;

                default:
                    return;
            }

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(description)
                .setTimestamp();

            // Alert role ping for critical events
            let content = '';
            if (['RAID_DETECTED', 'LOCKDOWN_START'].includes(type) && config.alertRoleId) {
                content = `<@&${config.alertRoleId}>`;
            }

            await logChannel.send({ content: content || undefined, embeds: [embed] });
        } catch (e) {
            // Ignore log errors
        }
    }

    /**
     * Handle member join
     */
    async handleJoin(member) {
        const guild = member.guild;
        const config = await this.getConfig(guild.id);

        if (!config.enabled) return;
        if (await this.isWhitelisted(guild.id, member.id)) return;

        // If in lockdown, handle based on lockdownAction
        if (config.lockdown.active) {
            await this.handleLockdownJoin(member, config);
            return;
        }

        const modules = config.modules;

        // --- Account Age Check ---
        if (modules.account_age?.enabled) {
            const accountAge = Date.now() - member.user.createdTimestamp;
            const minAge = (modules.account_age.minAge || 7) * 24 * 60 * 60 * 1000;
            if (accountAge < minAge) {
                const days = Math.floor(accountAge / (24 * 60 * 60 * 1000));
                await this.executeAction(member, modules.account_age.action, `Account too new (${days}d old, min ${modules.account_age.minAge}d)`);
                return;
            }
        }

        // --- No Avatar Check ---
        if (modules.no_avatar?.enabled) {
            if (!member.user.avatar) {
                await this.executeAction(member, modules.no_avatar.action, 'No avatar');
                return;
            }
        }

        // --- Join Rate Check ---
        if (modules.join_rate?.enabled) {
            const now = Date.now();
            const key = guild.id;
            const tracker = this.joinTracker.get(key) || [];

            const timeWindow = modules.join_rate.time || 30000;
            const filtered = tracker.filter(t => now - t < timeWindow);
            filtered.push(now);
            this.joinTracker.set(key, filtered);

            if (filtered.length >= (modules.join_rate.limit || 10)) {
                // Raid detected!
                console.log(`[Vorn AntiRaid] Raid detected in ${guild.name}!`);
                this.joinTracker.set(key, []); // Reset

                await this.log(guild, 'RAID_DETECTED', {
                    count: filtered.length,
                    time: timeWindow,
                    action: modules.join_rate.action
                });

                if (modules.join_rate.action === 'lockdown') {
                    await this.activateLockdown(guild, config.lockdownDuration * 60 * 1000, 'Auto (Mass Join)');
                } else {
                    await this.executeAction(member, modules.join_rate.action, 'Mass join detected');
                }
            }
        }
    }

    /**
     * Handle join during lockdown
     */
    async handleLockdownJoin(member, config) {
        const action = config.lockdownAction || 'quarantine';
        await this.executeAction(member, action, 'Joined during lockdown');
    }

    /**
     * Handle message for spam detection
     */
    async handleMessage(message) {
        if (!message.guild || message.author.bot) return;

        const config = await this.getConfig(message.guild.id);
        if (!config.enabled) return;
        if (await this.isWhitelisted(message.guild.id, message.author.id)) return;

        const modules = config.modules;
        const member = message.member;
        if (!member) return;

        // Skip if member has admin/mod permissions
        if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        // --- Mention Spam ---
        if (modules.mention_spam?.enabled) {
            const mentionCount = message.mentions.users.size + message.mentions.roles.size;
            if (message.mentions.everyone) {
                await this.executeAction(member, modules.mention_spam.action, '@everyone/@here spam');
                try { await message.delete(); } catch {}
                return;
            }
            if (mentionCount >= (modules.mention_spam.limit || 10)) {
                await this.executeAction(member, modules.mention_spam.action, `Mention spam (${mentionCount} mentions)`);
                try { await message.delete(); } catch {}
                return;
            }
        }

        // --- Message Flood ---
        if (modules.message_flood?.enabled) {
            const now = Date.now();
            const key = `${message.guild.id}-${message.author.id}`;
            const tracker = this.messageTracker.get(key) || [];

            const timeWindow = modules.message_flood.time || 3000;
            const filtered = tracker.filter(t => now - t < timeWindow);
            filtered.push(now);
            this.messageTracker.set(key, filtered);

            if (filtered.length >= (modules.message_flood.limit || 5)) {
                this.messageTracker.set(key, []); // Reset
                await this.executeAction(member, modules.message_flood.action, `Message flood (${filtered.length} msgs in ${timeWindow / 1000}s)`);
            }
        }
    }

    /**
     * Execute action on member
     */
    async executeAction(member, action, reason) {
        const fullReason = `Anti-Raid: ${reason}`;
        const guild = member.guild;

        try {
            switch (action) {
                case 'kick':
                    if (member.kickable) {
                        await member.kick(fullReason);
                        await this.log(guild, 'ACTION_TAKEN', { userId: member.id, action: 'Kick', reason });
                    }
                    break;

                case 'ban':
                    if (member.bannable) {
                        await member.ban({ reason: fullReason, deleteMessageSeconds: 86400 });
                        await this.log(guild, 'ACTION_TAKEN', { userId: member.id, action: 'Ban', reason });
                    }
                    break;

                case 'timeout':
                    if (member.moderatable) {
                        await member.timeout(10 * 60 * 1000, fullReason); // 10 min timeout
                        await this.log(guild, 'ACTION_TAKEN', { userId: member.id, action: 'Timeout (10m)', reason });
                    }
                    break;

                case 'quarantine':
                    await this.quarantineUser(guild, member, reason);
                    break;

                case 'lockdown':
                    const config = await this.getConfig(guild.id);
                    await this.activateLockdown(guild, config.lockdownDuration * 60 * 1000, 'Auto');
                    break;
            }
        } catch (error) {
            console.error(`[Vorn AntiRaid] Action failed: ${error.message}`);
        }
    }

    /**
     * Quarantine a user
     */
    async quarantineUser(guild, member, reason) {
        const config = await this.getConfig(guild.id);
        let roleId = config.quarantineRoleId;
        let role;

        if (roleId) {
            role = guild.roles.cache.get(roleId);
        }

        // If role missing, try to find or create
        if (!role) {
            role = guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantined');
            if (!role) {
                try {
                    role = await guild.roles.create({
                        name: 'Quarantined',
                        color: '#2b2d31',
                        reason: 'Anti-Raid Quarantine Role',
                        permissions: []
                    });

                    // Deny permissions in all channels
                    for (const [, channel] of guild.channels.cache) {
                        if (channel.manageable) {
                            await channel.permissionOverwrites.create(role, {
                                ViewChannel: false,
                                SendMessages: false,
                                Speak: false,
                                Connect: false
                            }).catch(() => {});
                        }
                    }
                } catch (e) {
                    console.error(`[Vorn AntiRaid] Failed to create quarantine role: ${e.message}`);
                    return;
                }
            }

            config.quarantineRoleId = role.id;
            await this.setConfig(guild.id, config);
        }

        try {
            const oldRoles = member.roles.cache.filter(r => r.name !== '@everyone' && !r.managed && r.editable);
            await member.roles.remove(oldRoles, 'Quarantining user');
            await member.roles.add(role, `Anti-Raid: ${reason}`);

            await this.log(guild, 'QUARANTINE', { userId: member.id, reason });
            console.log(`[Vorn AntiRaid] Quarantined ${member.user.tag}: ${reason}`);
        } catch (error) {
            console.error(`[Vorn AntiRaid] Quarantine failed: ${error.message}`);
        }
    }

    /**
     * Activate lockdown
     */
    async activateLockdown(guild, duration, triggeredBy = 'Manual') {
        const config = await this.getConfig(guild.id);
        config.lockdown = { active: true, until: Date.now() + duration };
        await this.setConfig(guild.id, config);

        // Lock all text channels for @everyone
        for (const [, channel] of guild.channels.cache) {
            if (channel.isTextBased() && channel.permissionsFor(guild.roles.everyone)) {
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: false
                    });
                } catch {}
            }
        }

        await this.log(guild, 'LOCKDOWN_START', {
            duration: Math.round(duration / 60000),
            triggeredBy
        });

        console.log(`[Vorn AntiRaid] Lockdown in ${guild.name} for ${duration / 60000}m`);

        // Schedule unlock
        setTimeout(() => this.deactivateLockdown(guild), duration);
    }

    /**
     * Deactivate lockdown
     */
    async deactivateLockdown(guild) {
        const config = await this.getConfig(guild.id);
        config.lockdown = { active: false, until: null };
        await this.setConfig(guild.id, config);

        // Unlock channels
        for (const [, channel] of guild.channels.cache) {
            if (channel.isTextBased() && channel.permissionsFor(guild.roles.everyone)) {
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: null
                    });
                } catch {}
            }
        }

        await this.log(guild, 'LOCKDOWN_END', {});
        console.log(`[Vorn AntiRaid] Lockdown ended in ${guild.name}`);
    }
}

module.exports = AntiRaidManager;
