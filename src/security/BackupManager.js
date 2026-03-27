/**
 * Vorn — Backup Manager
 * Server structure backup using file attachments
 */

const { ChannelType, PermissionsBitField, AttachmentBuilder } = require('discord.js');

class BackupManager {
    constructor(client) {
        this.client = client;
    }

    /**
     * Get the backup channel for a server
     */
    async getBackupChannel(guildId) {
        return await this.client.db.getOrCreateChannel(guildId);
    }

    /**
     * Create a complete server backup
     * @param {Guild} guild 
     * @returns {Object} Backup data
     */
    async createBackup(guild) {
        const backup = {
            timestamp: Date.now(),
            serverId: guild.id,
            serverName: guild.name,
            categories: [],
            textChannels: [],
            voiceChannels: [],
            roles: []
        };

        // Backup roles (exclude @everyone and managed roles)
        guild.roles.cache.forEach(role => {
            if (role.name === '@everyone' || role.managed) return;

            backup.roles.push({
                id: role.id,
                name: role.name,
                color: role.color,
                hoist: role.hoist,
                position: role.position,
                permissions: role.permissions.bitfield.toString(),
                mentionable: role.mentionable
            });
        });

        // Backup channels
        guild.channels.cache.forEach(channel => {
            const permissionOverwrites = [];
            channel.permissionOverwrites.cache.forEach(perm => {
                permissionOverwrites.push({
                    id: perm.id,
                    type: perm.type,
                    allow: perm.allow.bitfield.toString(),
                    deny: perm.deny.bitfield.toString()
                });
            });

            const baseData = {
                id: channel.id,
                name: channel.name,
                parentId: channel.parentId,
                position: channel.position,
                permissions: permissionOverwrites
            };

            switch (channel.type) {
                case ChannelType.GuildCategory:
                    backup.categories.push(baseData);
                    break;

                case ChannelType.GuildText:
                case ChannelType.GuildAnnouncement:
                    backup.textChannels.push({
                        ...baseData,
                        topic: channel.topic || '',
                        nsfw: channel.nsfw,
                        slowmode: channel.rateLimitPerUser || 0,
                        type: channel.type
                    });
                    break;

                case ChannelType.GuildVoice:
                case ChannelType.GuildStageVoice:
                    backup.voiceChannels.push({
                        ...baseData,
                        bitrate: channel.bitrate,
                        userLimit: channel.userLimit,
                        type: channel.type
                    });
                    break;
            }
        });

        // Sort by position
        backup.categories.sort((a, b) => a.position - b.position);
        backup.textChannels.sort((a, b) => a.position - b.position);
        backup.voiceChannels.sort((a, b) => a.position - b.position);
        backup.roles.sort((a, b) => b.position - a.position);

        // Store as file attachment
        await this.saveBackupFile(guild.id, backup);

        return backup;
    }

    /**
     * Save backup as .txt file attachment
     */
    async saveBackupFile(guildId, backup) {
        const channel = await this.getBackupChannel(guildId);

        // Delete old backup message if exists
        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            const oldBackup = messages.find(m =>
                m.author.id === this.client.user.id &&
                m.attachments.some(a => a.name === 'backup.txt')
            );
            if (oldBackup) await oldBackup.delete();
        } catch { }

        // Create file attachment
        const jsonString = JSON.stringify(backup, null, 2);
        const buffer = Buffer.from(jsonString, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: 'backup.txt' });

        // Send as file
        await channel.send({
            content: `Backup: ${new Date(backup.timestamp).toISOString()}`,
            files: [attachment]
        });
    }

    /**
     * Get existing backup from file
     * @param {string} guildId 
     * @returns {Object|null}
     */
    async getBackup(guildId) {
        try {
            const channel = await this.getBackupChannel(guildId);
            const messages = await channel.messages.fetch({ limit: 50 });

            const backupMsg = messages.find(m =>
                m.author.id === this.client.user.id &&
                m.attachments.some(a => a.name === 'backup.txt')
            );

            if (!backupMsg) return null;

            const attachment = backupMsg.attachments.find(a => a.name === 'backup.txt');
            const response = await fetch(attachment.url);
            const text = await response.text();

            return JSON.parse(text);
        } catch (error) {
            console.error(`[BackupManager] Failed to load backup: ${error.message}`);
            return null;
        }
    }

    /**
     * Check if backup needs refresh (older than 30 days)
     */
    needsRefresh(backup) {
        if (!backup) return true;
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        return (Date.now() - backup.timestamp) > thirtyDays;
    }

    /**
     * Compare current server state with backup
     */
    async compareMissing(guild, backup) {
        const missing = {
            categories: [],
            textChannels: [],
            voiceChannels: [],
            roles: []
        };

        for (const role of backup.roles) {
            if (!guild.roles.cache.has(role.id)) {
                missing.roles.push(role);
            }
        }

        for (const cat of backup.categories) {
            if (!guild.channels.cache.has(cat.id)) {
                missing.categories.push(cat);
            }
        }

        for (const ch of backup.textChannels) {
            if (!guild.channels.cache.has(ch.id)) {
                missing.textChannels.push(ch);
            }
        }

        for (const ch of backup.voiceChannels) {
            if (!guild.channels.cache.has(ch.id)) {
                missing.voiceChannels.push(ch);
            }
        }

        return missing;
    }

    /**
     * Restore missing items from backup
     */
    async restoreMissing(guild, missing, backup) {
        const results = {
            roles: { success: 0, failed: 0 },
            categories: { success: 0, failed: 0 },
            textChannels: { success: 0, failed: 0 },
            voiceChannels: { success: 0, failed: 0 }
        };

        const roleIdMap = new Map();

        // Restore roles first
        for (const role of missing.roles) {
            try {
                const newRole = await guild.roles.create({
                    name: role.name,
                    color: role.color,
                    hoist: role.hoist,
                    permissions: BigInt(role.permissions),
                    mentionable: role.mentionable,
                    reason: 'Vorn Auto-Recovery'
                });
                roleIdMap.set(role.id, newRole.id);
                results.roles.success++;
            } catch {
                results.roles.failed++;
            }
        }

        // Map existing roles
        backup.roles.forEach(r => {
            if (guild.roles.cache.has(r.id)) {
                roleIdMap.set(r.id, r.id);
            }
        });

        // Restore categories
        const categoryIdMap = new Map();
        for (const cat of missing.categories) {
            try {
                const perms = this.mapPermissions(cat.permissions, roleIdMap, guild);
                const newCat = await guild.channels.create({
                    name: cat.name,
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: perms,
                    reason: 'Vorn Auto-Recovery'
                });
                categoryIdMap.set(cat.id, newCat.id);
                results.categories.success++;
            } catch {
                results.categories.failed++;
            }
        }

        // Map existing categories
        backup.categories.forEach(c => {
            if (guild.channels.cache.has(c.id)) {
                categoryIdMap.set(c.id, c.id);
            }
        });

        // Restore text channels
        for (const ch of missing.textChannels) {
            try {
                const perms = this.mapPermissions(ch.permissions, roleIdMap, guild);
                const parentId = categoryIdMap.get(ch.parentId) || null;

                await guild.channels.create({
                    name: ch.name,
                    type: ch.type || ChannelType.GuildText,
                    parent: parentId,
                    topic: ch.topic,
                    nsfw: ch.nsfw,
                    rateLimitPerUser: ch.slowmode,
                    permissionOverwrites: perms,
                    reason: 'Vorn Auto-Recovery'
                });
                results.textChannels.success++;
            } catch {
                results.textChannels.failed++;
            }
        }

        // Restore voice channels
        for (const ch of missing.voiceChannels) {
            try {
                const perms = this.mapPermissions(ch.permissions, roleIdMap, guild);
                const parentId = categoryIdMap.get(ch.parentId) || null;

                await guild.channels.create({
                    name: ch.name,
                    type: ch.type || ChannelType.GuildVoice,
                    parent: parentId,
                    bitrate: Math.min(ch.bitrate, guild.maximumBitrate),
                    userLimit: ch.userLimit,
                    permissionOverwrites: perms,
                    reason: 'Vorn Auto-Recovery'
                });
                results.voiceChannels.success++;
            } catch {
                results.voiceChannels.failed++;
            }
        }

        return results;
    }

    /**
     * Map old permission overwrites to new IDs
     */
    mapPermissions(permissions, roleIdMap, guild) {
        return permissions.map(perm => {
            const newId = roleIdMap.get(perm.id) || perm.id;

            if (perm.type === 0 && !guild.roles.cache.has(newId) && !roleIdMap.has(perm.id)) {
                return null;
            }

            return {
                id: newId,
                type: perm.type,
                allow: BigInt(perm.allow),
                deny: BigInt(perm.deny)
            };
        }).filter(Boolean);
    }

    /**
     * Quick restore a single deleted channel
     */
    async quickRestoreChannel(guild, channelId) {
        const backup = await this.getBackup(guild.id);
        if (!backup) return null;

        const allChannels = [...backup.categories, ...backup.textChannels, ...backup.voiceChannels];
        const channelData = allChannels.find(c => c.id === channelId);

        if (!channelData) return null;

        try {
            let parentId = null;
            if (channelData.parentId && guild.channels.cache.has(channelData.parentId)) {
                parentId = channelData.parentId;
            }

            let type = ChannelType.GuildText;
            if (backup.categories.some(c => c.id === channelId)) {
                type = ChannelType.GuildCategory;
            } else if (backup.voiceChannels.some(c => c.id === channelId)) {
                type = channelData.type || ChannelType.GuildVoice;
            } else if (channelData.type) {
                type = channelData.type;
            }

            const options = {
                name: channelData.name,
                type,
                reason: 'Vorn Auto-Recovery'
            };

            if (type !== ChannelType.GuildCategory) {
                options.parent = parentId;
            }

            if (type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement) {
                options.topic = channelData.topic;
                options.nsfw = channelData.nsfw;
                options.rateLimitPerUser = channelData.slowmode;
            }

            if (type === ChannelType.GuildVoice || type === ChannelType.GuildStageVoice) {
                options.bitrate = Math.min(channelData.bitrate, guild.maximumBitrate);
                options.userLimit = channelData.userLimit;
            }

            return await guild.channels.create(options);
        } catch (error) {
            console.error(`[BackupManager] Quick restore failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Quick restore a single deleted role
     */
    async quickRestoreRole(guild, roleId) {
        const backup = await this.getBackup(guild.id);
        if (!backup) return null;

        const roleData = backup.roles.find(r => r.id === roleId);
        if (!roleData) return null;

        try {
            return await guild.roles.create({
                name: roleData.name,
                color: roleData.color,
                hoist: roleData.hoist,
                permissions: BigInt(roleData.permissions),
                mentionable: roleData.mentionable,
                reason: 'Vorn Auto-Recovery'
            });
        } catch (error) {
            console.error(`[BackupManager] Quick restore role failed: ${error.message}`);
            return null;
        }
    }
}

module.exports = BackupManager;
