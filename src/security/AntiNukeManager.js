/**
 * Vorn — Anti-Nuke Manager
 * Core security logic with per-module whitelist and customizable thresholds
 */

const { PermissionFlagsBits } = require('discord.js');

// All available protection modules
const MODULES = [
    'channel_create', 'channel_delete',
    'role_create', 'role_delete',
    'member_ban', 'member_kick', 'member_prune',
    'bot_add', 'webhook_create', 'guild_update'
];

// Default configuration for new servers
const DEFAULT_CONFIG = {
    enabled: false,
    modules: {
        channel_create: { enabled: true, limit: 3, time: 60, action: 'ban' },
        channel_delete: { enabled: true, limit: 3, time: 60, action: 'ban' },
        role_create: { enabled: true, limit: 3, time: 60, action: 'ban' },
        role_delete: { enabled: true, limit: 3, time: 60, action: 'ban' },
        member_ban: { enabled: true, limit: 3, time: 60, action: 'ban' },
        member_kick: { enabled: true, limit: 5, time: 60, action: 'ban' },
        member_prune: { enabled: true, limit: 1, time: 60, action: 'ban' },
        bot_add: { enabled: true, limit: 1, time: 60, action: 'kick' },
        webhook_create: { enabled: true, limit: 3, time: 60, action: 'ban' },
        guild_update: { enabled: true, limit: 1, time: 60, action: 'kick' }
    },
    whitelist: [],
    quarantineRoleId: null,
    autoRecovery: false
    // whitelist format: [{ userId: "123", modules: ["*"] }, { userId: "456", modules: ["channel_delete"] }]
};

class AntiNukeManager {
    constructor(client) {
        this.client = client;
        this.MODULES = MODULES;
        // Rate limit tracking: Map<"guildId-module-userId", { count, startTime }>
        this.limits = new Map();
    }

    /**
     * Get server configuration (with defaults merged)
     */
    async getConfig(guildId) {
        const stored = await this.client.db.get(guildId, 'antinuke_config');
        if (!stored) {
            return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
        // Merge with defaults for any missing modules
        const config = { ...DEFAULT_CONFIG, ...stored };
        config.modules = { ...DEFAULT_CONFIG.modules, ...stored.modules };
        config.whitelist = stored.whitelist || [];
        return config;
    }

    /**
     * Save server configuration
     */
    async setConfig(guildId, config) {
        await this.client.db.set(guildId, 'antinuke_config', config);
    }

    /**
     * Check if user is whitelisted for a specific module
     * @param {Array} whitelist - Server's whitelist array
     * @param {string} userId - User ID to check
     * @param {string} module - Module to check
     * @returns {boolean}
     */
    isWhitelisted(whitelist, userId, module) {
        if (!Array.isArray(whitelist)) return false; // Safety check
        const entry = whitelist.find(w => w.userId === userId);
        if (!entry) return false;
        // "*" means all modules
        if (entry.modules.includes('*')) return true;
        return entry.modules.includes(module);
    }

    /**
     * Check if user is whitelisted (Guild ID wrapper)
     */
    async isWhitelistedByGuild(guildId, userId, module = '*') {
        const config = await this.getConfig(guildId);
        return this.isWhitelisted(config.whitelist, userId, module);
    }

    /**
     * Handle an action and check if it violates limits
     * @param {Guild} guild 
     * @param {User} user 
     * @param {string} module 
     * @returns {Promise<boolean>} - True if user was punished
     */
    async handleAction(guild, user, module) {
        // Ignore self
        if (user.id === this.client.user.id) return false;

        const config = await this.getConfig(guild.id);

        // System disabled?
        if (!config.enabled) return false;

        // Server owner always bypasses
        if (user.id === guild.ownerId) return false;

        // Check per-module whitelist
        if (this.isWhitelisted(config.whitelist, user.id, module)) return false;

        // Module disabled?
        const modConfig = config.modules[module];
        if (!modConfig || !modConfig.enabled) return false;

        // Rate limit check
        const now = Date.now();
        const key = `${guild.id}-${module}-${user.id}`;

        let record = this.limits.get(key);

        if (!record || (now - record.startTime > modConfig.time * 1000)) {
            // Start new window
            record = { count: 1, startTime: now };
            this.limits.set(key, record);

            // Auto cleanup after time window
            setTimeout(() => this.limits.delete(key), modConfig.time * 1000);
        } else {
            record.count++;
        }

        // Check violation
        if (record.count > modConfig.limit) {
            await this.punish(guild, user, modConfig.action, `Anti-Nuke: ${module} limit exceeded (${record.count}/${modConfig.limit})`);
            return true;
        }

        return false;
    }

    /**
     * Execute punishment
     */
    async punish(guild, user, action, reason) {
        try {
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            // Check permissions
            const me = guild.members.me;
            if (!me) return;
            if (me.roles.highest.position <= member.roles.highest.position) return;

            switch (action) {
                case 'ban':
                    if (member.bannable) {
                        await member.ban({ reason });
                        console.log(`[AntiNuke] Banned ${user.tag} in ${guild.name}: ${reason}`);
                    }
                    break;
                case 'kick':
                    if (member.kickable) {
                        await member.kick(reason);
                        console.log(`[AntiNuke] Kicked ${user.tag} in ${guild.name}: ${reason}`);
                    }
                    break;
                case 'strip':
                    const roles = member.roles.cache.filter(r => r.name !== '@everyone' && r.editable);
                    if (roles.size > 0) {
                        await member.roles.remove(roles, reason);
                        console.log(`[AntiNuke] Stripped roles from ${user.tag} in ${guild.name}: ${reason}`);
                    }
                    break;
                case 'quarantine':
                    await this.quarantineUser(guild, member, reason);
                    break;
            }
        } catch (error) {
            console.error(`[AntiNuke] Punish failed: ${error.message}`);
        }
    }

    /**
     * Quarantine a user (Strip roles + Add Quarantine Role)
     */
    async quarantineUser(guild, member, reason) {
        const config = await this.getConfig(guild.id);
        let roleId = config.quarantineRoleId;
        let role;

        if (roleId) {
            role = guild.roles.cache.get(roleId);
        }

        // If role missing or invalid, try to find one or create one
        if (!role) {
            role = guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantined' || r.name.toLowerCase() === 'muted');
            if (!role) {
                try {
                    role = await guild.roles.create({
                        name: 'Quarantined',
                        color: '#000001', // Dark color
                        reason: 'Anti-Nuke Quarantine Role Auto-Create',
                        permissions: []
                    });
                    
                    // Deny permissions in all channels
                    guild.channels.cache.forEach(async (channel) => {
                        if(channel.manageable) {
                            await channel.permissionOverwrites.create(role, {
                                ViewChannel: false,
                                SendMessages: false,
                                Speak: false,
                                Connect: false
                            });
                        }
                    });

                } catch (e) {
                    console.error(`[AntiNuke] Failed to create quarantine role: ${e.message}`);
                    return;
                }
            }
            
            // Save new role ID
            config.quarantineRoleId = role.id;
            await this.setConfig(guild.id, config);
        }

        // Apply role and strip others
        try {
            const oldRoles = member.roles.cache.filter(r => r.name !== '@everyone' && !r.managed && r.editable);
            await member.roles.remove(oldRoles, 'Quarantining user');
            await member.roles.add(role, reason);
            console.log(`[AntiNuke] Quarantined ${member.user.tag} in ${guild.name}: ${reason}`);
        } catch (error) {
            console.error(`[AntiNuke] Quarantine failed: ${error.message}`);
        }
    }

    /**
     * Add user to whitelist
     */
    async addToWhitelist(guildId, userId, modules) {
        const config = await this.getConfig(guildId);

        // Remove existing entry if any
        config.whitelist = config.whitelist.filter(w => w.userId !== userId);

        // Add new entry
        config.whitelist.push({ userId, modules });

        await this.setConfig(guildId, config);
    }

    /**
     * Remove user from whitelist
     */
    async removeFromWhitelist(guildId, userId) {
        const config = await this.getConfig(guildId);
        config.whitelist = config.whitelist.filter(w => w.userId !== userId);
        await this.setConfig(guildId, config);
    }

    /**
     * Get whitelist for display
     */
    async getWhitelist(guildId) {
        const config = await this.getConfig(guildId);
        return config.whitelist;
    }
}

module.exports = AntiNukeManager;
