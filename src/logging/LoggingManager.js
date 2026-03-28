/**
 * Vorn — Logging Manager
 * Full audit logging system with per-category channels, ignore lists, and rich embeds
 */

const { EmbedBuilder } = require('discord.js');

// All available log categories
const CATEGORIES = {
    messages: { label: 'Messages', description: 'Edits, deletes, bulk deletes, pins' },
    members: { label: 'Members', description: 'Join, leave, nickname, role changes, avatar' },
    moderation: { label: 'Moderation', description: 'Bans, unbans, timeouts, kicks' },
    roles: { label: 'Roles', description: 'Create, delete, permission/name/color changes' },
    channels: { label: 'Channels', description: 'Create, delete, topic/name/permission changes' },
    voice: { label: 'Voice', description: 'Join, leave, move, mute, deafen, stream' },
    server: { label: 'Server', description: 'Name, icon, settings, boost changes' },
    invites: { label: 'Invites', description: 'Invite create, delete, usage' },
    threads: { label: 'Threads', description: 'Thread create, delete, archive' },
    emojis: { label: 'Emojis', description: 'Emoji and sticker changes' }
};

const COLORS = {
    create: '#2b2d31',
    delete: '#2b2d31',
    update: '#2b2d31',
    info: '#2b2d31',
    warning: '#ED4245', // Kept red for severe alerts
    neutral: '#2b2d31'
};

class LoggingManager {
    constructor(client) {
        this.client = client;
        this.CATEGORIES = CATEGORIES;
        this.COLORS = COLORS;

        // Debounce cache for bulk operations
        this.bulkDeleteCache = new Map();
    }

    // ═══════════════════════════════════════════════════════════════
    // CONFIG
    // ═══════════════════════════════════════════════════════════════

    async getConfig(guildId) {
        const stored = await this.client.db.get(guildId, 'logging_config') || {};

        return {
            enabled: stored.enabled ?? false,

            // Default channel for all logs
            defaultChannelId: stored.defaultChannelId || null,

            // Per-category channel overrides
            channels: stored.channels || {},

            // Enabled categories
            categories: {
                messages: stored.categories?.messages ?? true,
                members: stored.categories?.members ?? true,
                moderation: stored.categories?.moderation ?? true,
                roles: stored.categories?.roles ?? true,
                channels: stored.categories?.channels ?? true,
                voice: stored.categories?.voice ?? true,
                server: stored.categories?.server ?? true,
                invites: stored.categories?.invites ?? false,
                threads: stored.categories?.threads ?? false,
                emojis: stored.categories?.emojis ?? false
            },

            // Ignore lists
            ignoredChannels: stored.ignoredChannels || [],
            ignoredRoles: stored.ignoredRoles || [],
            ignoredUsers: stored.ignoredUsers || [],

            // Options
            logBots: stored.logBots ?? false,
            showAuditLogActor: stored.showAuditLogActor ?? true
        };
    }

    async setConfig(guildId, config) {
        await this.client.db.set(guildId, 'logging_config', config);
    }

    // ═══════════════════════════════════════════════════════════════
    // CORE LOGGING
    // ═══════════════════════════════════════════════════════════════

    /**
     * Send a log embed to the appropriate channel
     * @param {Guild} guild
     * @param {string} category - Log category (messages, members, etc.)
     * @param {EmbedBuilder} embed
     */
    async send(guild, category, embed) {
        try {
            const config = await this.getConfig(guild.id);

            if (!config.enabled) return;
            if (!config.categories[category]) return;

            const channelId = config.channels[category] || config.defaultChannelId;
            if (!channelId) return;

            const channel = guild.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased()) return;

            await channel.send({ embeds: [embed] }).catch(() => {});
        } catch {
            // Silently fail — logging should never break the bot
        }
    }

    /**
     * Check if an entity should be ignored
     */
    async shouldIgnore(guildId, { channelId, userId, roleIds } = {}) {
        const config = await this.getConfig(guildId);

        if (!config.enabled) return true;

        if (channelId && config.ignoredChannels.includes(channelId)) return true;
        if (userId && config.ignoredUsers.includes(userId)) return true;
        if (roleIds && roleIds.some(r => config.ignoredRoles.includes(r))) return true;

        return false;
    }

    /**
     * Check if bots should be logged
     */
    async shouldLogBots(guildId) {
        const config = await this.getConfig(guildId);
        return config.logBots;
    }

    // ═══════════════════════════════════════════════════════════════
    // EMBED BUILDERS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Create a base log embed
     */
    createEmbed(color = COLORS.neutral) {
        return new EmbedBuilder()
            .setColor(color)
            .setTimestamp();
    }

    // --- MESSAGE LOGS ---

    messageDeleteEmbed(message) {
        const embed = this.createEmbed(COLORS.delete)
            .setAuthor({ name: message.author?.tag || 'Unknown', iconURL: message.author?.displayAvatarURL() })
            .setDescription([
                `### Message Deleted`,
                '',
                `**Channel** ─ <#${message.channel.id}>`,
                '',
                `**Content**`,
                `> ${(message.content || '*No text*').substring(0, 900).split('\n').join('\n> ')}`,
            ].join('\n'))
            .setFooter({ text: `Author: ${message.author?.id || 'Unknown'} · Message: ${message.id}` });

        if (message.attachments.size > 0) {
            embed.addFields({
                name: 'Attachments',
                value: message.attachments.map(a => `[${a.name}](${a.url})`).join('\n').substring(0, 1024)
            });
        }

        return embed;
    }

    messageEditEmbed(oldMessage, newMessage) {
        const before = (oldMessage.content || '*Empty*').substring(0, 450);
        const after = (newMessage.content || '*Empty*').substring(0, 450);

        return this.createEmbed(COLORS.update)
            .setAuthor({ name: newMessage.author?.tag || 'Unknown', iconURL: newMessage.author?.displayAvatarURL() })
            .setDescription([
                `### Message Edited`,
                '',
                `**Channel** ─ <#${newMessage.channel.id}> · [Jump](${newMessage.url})`,
                '',
                `**Before**`,
                `> ${before.split('\n').join('\n> ')}`,
                '',
                `**After**`,
                `> ${after.split('\n').join('\n> ')}`
            ].join('\n'))
            .setFooter({ text: `Author: ${newMessage.author?.id || 'Unknown'} · Message: ${newMessage.id}` });
    }

    messageBulkDeleteEmbed(messages, channel) {
        const count = messages.size;
        const authors = [...new Set(messages.map(m => m.author?.tag).filter(Boolean))];

        return this.createEmbed(COLORS.delete)
            .setDescription([
                `### Bulk Delete`,
                '',
                `**Channel** ─ <#${channel.id}>`,
                `**Count** ─ ${count} messages`,
                `**Authors** ─ ${authors.slice(0, 10).join(', ')}${authors.length > 10 ? ` +${authors.length - 10} more` : ''}`
            ].join('\n'))
            .setFooter({ text: `Channel: ${channel.id}` });
    }

    // --- MEMBER LOGS ---

    memberJoinEmbed(member) {
        const created = Math.floor(member.user.createdTimestamp / 1000);
        const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (24 * 60 * 60 * 1000));
        const isNew = accountAge < 7;

        return this.createEmbed(isNew ? COLORS.warning : COLORS.create)
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setDescription([
                `### Member Joined`,
                '',
                `**User** ─ ${member} \`[${member.id}]\``,
                `**Account** ─ <t:${created}:R> (${accountAge}d old)`,
                `**Member #** ─ ${member.guild.memberCount}`,
                isNew ? '\n**Warning** ─ New account' : ''
            ].join('\n'))
            .setFooter({ text: `ID: ${member.id}` });
    }

    memberLeaveEmbed(member) {
        const joined = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
        const roles = member.roles.cache
            .filter(r => r.name !== '@everyone')
            .sort((a, b) => b.position - a.position)
            .map(r => `<@&${r.id}>`)
            .slice(0, 15);

        const lines = [
            `### Member Left`,
            '',
            `**User** ─ ${member.user.tag} \`[${member.id}]\``
        ];

        if (joined) {
            lines.push(`**Joined** ─ <t:${joined}:R>`);
        }

        if (roles.length > 0) {
            lines.push(`**Roles** ─ ${roles.join(' ')}`);
        }

        return this.createEmbed(COLORS.delete)
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setDescription(lines.join('\n'))
            .setFooter({ text: `ID: ${member.id}` });
    }

    memberUpdateEmbed(oldMember, newMember, changes) {
        const lines = [
            `### Member Updated`,
            '',
            `**User** ─ ${newMember} \`[${newMember.id}]\``,
            ''
        ];

        for (const change of changes) {
            lines.push(change);
        }

        return this.createEmbed(COLORS.update)
            .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
            .setDescription(lines.join('\n'))
            .setFooter({ text: `ID: ${newMember.id}` });
    }

    memberBanEmbed(ban, actor = null) {
        const lines = [
            `### Member Banned`,
            '',
            `**User** ─ ${ban.user.tag} \`[${ban.user.id}]\``,
            `**Reason** ─ ${ban.reason || 'No reason provided'}`
        ];

        if (actor) {
            lines.push(`**Moderator** ─ ${actor.tag}`);
        }

        return this.createEmbed(COLORS.delete)
            .setAuthor({ name: ban.user.tag, iconURL: ban.user.displayAvatarURL() })
            .setDescription(lines.join('\n'))
            .setFooter({ text: `ID: ${ban.user.id}` });
    }

    memberUnbanEmbed(ban, actor = null) {
        const lines = [
            `### Member Unbanned`,
            '',
            `**User** ─ ${ban.user.tag} \`[${ban.user.id}]\``
        ];

        if (actor) {
            lines.push(`**Moderator** ─ ${actor.tag}`);
        }

        return this.createEmbed(COLORS.create)
            .setAuthor({ name: ban.user.tag, iconURL: ban.user.displayAvatarURL() })
            .setDescription(lines.join('\n'))
            .setFooter({ text: `ID: ${ban.user.id}` });
    }

    memberTimeoutEmbed(member, duration, actor = null) {
        const lines = [
            `### Member Timed Out`,
            '',
            `**User** ─ ${member} \`[${member.id}]\``,
            `**Duration** ─ ${duration || 'Unknown'}`
        ];

        if (actor) {
            lines.push(`**Moderator** ─ ${actor.tag}`);
        }

        return this.createEmbed(COLORS.warning)
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setDescription(lines.join('\n'))
            .setFooter({ text: `ID: ${member.id}` });
    }

    // --- ROLE LOGS ---

    roleCreateEmbed(role) {
        return this.createEmbed(COLORS.create)
            .setDescription([
                `### Role Created`,
                '',
                `**Name** ─ ${role.name}`,
                `**Color** ─ ${role.hexColor}`,
                `**Hoisted** ─ ${role.hoist ? 'Yes' : 'No'}`,
                `**Mentionable** ─ ${role.mentionable ? 'Yes' : 'No'}`,
                `**Position** ─ ${role.position}`
            ].join('\n'))
            .setFooter({ text: `ID: ${role.id}` });
    }

    roleDeleteEmbed(role) {
        return this.createEmbed(COLORS.delete)
            .setDescription([
                `### Role Deleted`,
                '',
                `**Name** ─ ${role.name}`,
                `**Color** ─ ${role.hexColor}`,
                `**Members** ─ ${role.members?.size ?? 'Unknown'}`
            ].join('\n'))
            .setFooter({ text: `ID: ${role.id}` });
    }

    roleUpdateEmbed(oldRole, newRole, changes) {
        const lines = [
            `### Role Updated`,
            '',
            `**Role** ─ <@&${newRole.id}> \`${newRole.name}\``,
            ''
        ];

        for (const change of changes) {
            lines.push(change);
        }

        return this.createEmbed(COLORS.update)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `ID: ${newRole.id}` });
    }

    // --- CHANNEL LOGS ---

    channelCreateEmbed(channel) {
        const typeNames = {
            0: 'Text', 2: 'Voice', 4: 'Category', 5: 'Announcement',
            10: 'News Thread', 11: 'Public Thread', 12: 'Private Thread',
            13: 'Stage', 15: 'Forum', 16: 'Media'
        };

        return this.createEmbed(COLORS.create)
            .setDescription([
                `### Channel Created`,
                '',
                `**Name** ─ <#${channel.id}> \`${channel.name}\``,
                `**Type** ─ ${typeNames[channel.type] || 'Unknown'}`,
                channel.parent ? `**Category** ─ ${channel.parent.name}` : ''
            ].filter(Boolean).join('\n'))
            .setFooter({ text: `ID: ${channel.id}` });
    }

    channelDeleteEmbed(channel) {
        const typeNames = {
            0: 'Text', 2: 'Voice', 4: 'Category', 5: 'Announcement',
            10: 'News Thread', 11: 'Public Thread', 12: 'Private Thread',
            13: 'Stage', 15: 'Forum', 16: 'Media'
        };

        return this.createEmbed(COLORS.delete)
            .setDescription([
                `### Channel Deleted`,
                '',
                `**Name** ─ \`#${channel.name}\``,
                `**Type** ─ ${typeNames[channel.type] || 'Unknown'}`,
                channel.parent ? `**Category** ─ ${channel.parent.name}` : ''
            ].filter(Boolean).join('\n'))
            .setFooter({ text: `ID: ${channel.id}` });
    }

    channelUpdateEmbed(oldChannel, newChannel, changes) {
        const lines = [
            `### Channel Updated`,
            '',
            `**Channel** ─ <#${newChannel.id}> \`${newChannel.name}\``,
            ''
        ];

        for (const change of changes) {
            lines.push(change);
        }

        return this.createEmbed(COLORS.update)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `ID: ${newChannel.id}` });
    }

    // --- VOICE LOGS ---

    voiceStateEmbed(member, action, details = {}) {
        const lines = [
            `### Voice ${action}`,
            '',
            `**User** ─ ${member} \`${member.user.tag}\``
        ];

        if (details.channel) {
            lines.push(`**Channel** ─ <#${details.channel.id}>`);
        }
        if (details.oldChannel && details.newChannel) {
            lines.push(`**From** ─ <#${details.oldChannel.id}>`);
            lines.push(`**To** ─ <#${details.newChannel.id}>`);
        }

        const color = action === 'Join' ? COLORS.create
            : action === 'Leave' ? COLORS.delete
            : COLORS.update;

        return this.createEmbed(color)
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setDescription(lines.join('\n'))
            .setFooter({ text: `ID: ${member.id}` });
    }

    // --- SERVER LOGS ---

    serverUpdateEmbed(oldGuild, newGuild, changes) {
        const lines = [
            `### Server Updated`,
            ''
        ];

        for (const change of changes) {
            lines.push(change);
        }

        return this.createEmbed(COLORS.update)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `ID: ${newGuild.id}` });
    }

    // --- INVITE LOGS ---

    inviteCreateEmbed(invite) {
        const lines = [
            `### Invite Created`,
            '',
            `**Code** ─ \`${invite.code}\``,
            `**Creator** ─ ${invite.inviter ? `${invite.inviter.tag}` : 'Unknown'}`,
            `**Channel** ─ <#${invite.channel?.id}>`,
            `**Max Uses** ─ ${invite.maxUses || 'Unlimited'}`,
            `**Expires** ─ ${invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>` : 'Never'}`
        ];

        return this.createEmbed(COLORS.create)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Code: ${invite.code}` });
    }

    inviteDeleteEmbed(invite) {
        return this.createEmbed(COLORS.delete)
            .setDescription([
                `### Invite Deleted`,
                '',
                `**Code** ─ \`${invite.code}\``,
                `**Channel** ─ <#${invite.channel?.id}>`,
                `**Uses** ─ ${invite.uses || 0}`
            ].join('\n'))
            .setFooter({ text: `Code: ${invite.code}` });
    }

    // --- THREAD LOGS ---

    threadCreateEmbed(thread) {
        return this.createEmbed(COLORS.create)
            .setDescription([
                `### Thread Created`,
                '',
                `**Name** ─ <#${thread.id}> \`${thread.name}\``,
                `**Parent** ─ <#${thread.parentId}>`,
                `**Creator** ─ <@${thread.ownerId}>`
            ].join('\n'))
            .setFooter({ text: `ID: ${thread.id}` });
    }

    threadDeleteEmbed(thread) {
        return this.createEmbed(COLORS.delete)
            .setDescription([
                `### Thread Deleted`,
                '',
                `**Name** ─ \`${thread.name}\``,
                `**Parent** ─ <#${thread.parentId}>`
            ].join('\n'))
            .setFooter({ text: `ID: ${thread.id}` });
    }

    // --- EMOJI LOGS ---

    emojiChangeEmbed(emoji, action) {
        const color = action === 'Created' ? COLORS.create : action === 'Deleted' ? COLORS.delete : COLORS.update;

        return this.createEmbed(color)
            .setDescription([
                `### Emoji ${action}`,
                '',
                `**Name** ─ \`:${emoji.name}:\``,
                action !== 'Deleted' ? `**Preview** ─ ${emoji}` : '',
                `**Animated** ─ ${emoji.animated ? 'Yes' : 'No'}`
            ].filter(Boolean).join('\n'))
            .setFooter({ text: `ID: ${emoji.id}` });
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Try to get the actor from audit log for a specific action
     */
    async getAuditActor(guild, actionType, targetId, config) {
        if (!config?.showAuditLogActor) return null;

        try {
            const auditLogs = await guild.fetchAuditLogs({ type: actionType, limit: 5 });
            const entry = auditLogs.entries.find(e =>
                e.target?.id === targetId &&
                (Date.now() - e.createdTimestamp) < 5000
            );
            return entry?.executor || null;
        } catch {
            return null;
        }
    }

    /**
     * Format a duration in ms to a human-readable string
     */
    formatDuration(ms) {
        if (!ms || ms < 0) return 'Unknown';
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        const d = Math.floor(h / 24);
        if (d > 0) return `${d}d ${h % 24}h`;
        if (h > 0) return `${h}h ${m % 60}m`;
        if (m > 0) return `${m}m`;
        return `${s}s`;
    }
}

module.exports = LoggingManager;
