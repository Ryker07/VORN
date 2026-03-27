/**
 * Vorn — Moderation Manager
 * Full-featured moderation engine with auto-escalation, timed punishments,
 * warn decay, DM notifications, case search, and mod stats
 */

const VornEmbed = require('../utils/embedBuilder');
const { ChannelType } = require('discord.js');

class ModerationManager {
    constructor(client) {
        this.client = client;
        this.punishmentTimer = null;

        // Start the timed punishment loop
        this.startPunishmentLoop();
    }

    // ═══════════════════════════════════════════════════════════════
    // CONFIG
    // ═══════════════════════════════════════════════════════════════

    /**
     * Get moderation config for a guild with full defaults
     */
    async getConfig(guildId) {
        const config = await this.client.db.get(guildId, 'mod_config') || {};

        // Core
        if (!config.cases) config.cases = [];
        if (!config.warnings) config.warnings = {};
        if (!config.logChannelId) config.logChannelId = null;

        // Timed punishments (temp-ban, temp-mute tracking)
        if (!config.tempActions) config.tempActions = [];

        // Auto-escalation: { enabled, thresholds: { "3": "TIMEOUT:1h", "5": "TIMEOUT:1d", "7": "BAN" } }
        if (!config.escalation) config.escalation = { enabled: false, thresholds: {} };

        // Warn decay (days) — null = never decay
        if (config.warnDecayDays === undefined) config.warnDecayDays = null;

        // DM on moderation action
        if (config.dmOnAction === undefined) config.dmOnAction = true;

        return config;
    }

    /**
     * Set moderation config
     */
    async setConfig(guildId, config) {
        await this.client.db.set(guildId, 'mod_config', config);
    }

    // ═══════════════════════════════════════════════════════════════
    // CASES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Create a new moderation case
     * @param {Guild} guild
     * @param {string} type - Action type (BAN, KICK, TIMEOUT, WARN, etc.)
     * @param {User} target - The user being moderated
     * @param {User} moderator - The moderator
     * @param {string} reason
     * @param {Object} [extra] - { duration, auto }
     * @returns {number} Case ID
     */
    async createCase(guild, type, target, moderator, reason, extra = {}) {
        const config = await this.getConfig(guild.id);

        const caseId = (config.cases.length || 0) + 1;
        const newCase = {
            id: caseId,
            type: type.toUpperCase(),
            targetId: target.id,
            targetTag: target.tag || `${target.id}`,
            moderatorId: moderator.id,
            moderatorTag: moderator.tag || `${moderator.id}`,
            reason: reason || 'No reason provided',
            timestamp: Date.now(),
            duration: extra.duration || null,
            auto: extra.auto || false
        };

        config.cases.push(newCase);

        // Store warns separately for quick lookup
        if (type.toUpperCase() === 'WARN') {
            if (!config.warnings[target.id]) config.warnings[target.id] = [];
            config.warnings[target.id].push(newCase);
        }

        await this.setConfig(guild.id, config);

        // Log to channel
        await this.logCase(guild, newCase, config.logChannelId);

        // DM the user
        if (config.dmOnAction) {
            await this.notifyUser(target, guild, newCase);
        }

        return caseId;
    }

    /**
     * Delete a case by ID
     */
    async deleteCase(guildId, caseId) {
        const config = await this.getConfig(guildId);
        const index = config.cases.findIndex(c => c.id === caseId);
        if (index === -1) return false;

        const caseData = config.cases[index];
        config.cases.splice(index, 1);

        // Also remove from warnings if it was a warn
        if (caseData.type === 'WARN' && config.warnings[caseData.targetId]) {
            config.warnings[caseData.targetId] = config.warnings[caseData.targetId].filter(w => w.id !== caseId);
            if (config.warnings[caseData.targetId].length === 0) {
                delete config.warnings[caseData.targetId];
            }
        }

        await this.setConfig(guildId, config);
        return true;
    }

    /**
     * Search/filter cases
     * @param {string} guildId
     * @param {Object} filters - { userId, moderatorId, type, before, after }
     * @param {number} page - 1-indexed
     * @param {number} perPage
     * @returns {{ cases: Array, total: number, page: number, totalPages: number }}
     */
    async searchCases(guildId, filters = {}, page = 1, perPage = 10) {
        const config = await this.getConfig(guildId);
        let results = [...config.cases];

        if (filters.userId) results = results.filter(c => c.targetId === filters.userId);
        if (filters.moderatorId) results = results.filter(c => c.moderatorId === filters.moderatorId);
        if (filters.type) results = results.filter(c => c.type === filters.type.toUpperCase());
        if (filters.before) results = results.filter(c => c.timestamp < filters.before);
        if (filters.after) results = results.filter(c => c.timestamp > filters.after);

        // Sort newest first
        results.sort((a, b) => b.timestamp - a.timestamp);

        const total = results.length;
        const totalPages = Math.ceil(total / perPage) || 1;
        const safePage = Math.max(1, Math.min(page, totalPages));
        const start = (safePage - 1) * perPage;

        return {
            cases: results.slice(start, start + perPage),
            total,
            page: safePage,
            totalPages
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // WARNINGS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Get all warnings for a user (including decayed)
     */
    async getWarnings(guildId, userId) {
        const config = await this.getConfig(guildId);
        return config.warnings[userId] || [];
    }

    /**
     * Get ACTIVE warnings only (excluding decayed ones)
     */
    async getActiveWarnings(guildId, userId) {
        const config = await this.getConfig(guildId);
        const warnings = config.warnings[userId] || [];

        if (!config.warnDecayDays || config.warnDecayDays <= 0) {
            return warnings; // No decay — all are active
        }

        const decayMs = config.warnDecayDays * 24 * 60 * 60 * 1000;
        const now = Date.now();
        return warnings.filter(w => (now - w.timestamp) < decayMs);
    }

    /**
     * Remove a single warning by case ID
     */
    async removeWarning(guildId, userId, caseId) {
        const config = await this.getConfig(guildId);
        if (!config.warnings[userId]) return false;

        const index = config.warnings[userId].findIndex(w => w.id === caseId);
        if (index === -1) return false;

        config.warnings[userId].splice(index, 1);
        if (config.warnings[userId].length === 0) {
            delete config.warnings[userId];
        }

        await this.setConfig(guildId, config);
        return true;
    }

    /**
     * Clear all warnings for a user
     */
    async clearWarnings(guildId, userId) {
        const config = await this.getConfig(guildId);
        if (config.warnings[userId]) {
            delete config.warnings[userId];
            await this.setConfig(guildId, config);
            return true;
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTO-ESCALATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Check if a user has hit a warn threshold and auto-escalate
     * Called after every warn add
     * @returns {{ escalated: boolean, action?: string, caseId?: number }}
     */
    async checkEscalation(guild, target, moderator) {
        const config = await this.getConfig(guild.id);
        if (!config.escalation.enabled) return { escalated: false };

        const activeWarns = await this.getActiveWarnings(guild.id, target.id);
        const warnCount = activeWarns.length;

        // Find the highest matching threshold
        const thresholdKeys = Object.keys(config.escalation.thresholds)
            .map(Number)
            .sort((a, b) => b - a); // Descending

        for (const threshold of thresholdKeys) {
            if (warnCount >= threshold) {
                const action = config.escalation.thresholds[threshold.toString()];
                const result = await this.executeEscalation(guild, target, moderator, action, warnCount);
                return result;
            }
        }

        return { escalated: false };
    }

    /**
     * Execute an escalation action
     * Format: "TIMEOUT:1h", "BAN", "KICK", "TIMEOUT:1d"
     */
    async executeEscalation(guild, target, moderator, actionStr, warnCount) {
        const [actionType, durationStr] = actionStr.split(':');
        const reason = `Auto-escalation: ${warnCount} warnings reached`;

        try {
            const member = await guild.members.fetch(target.id).catch(() => null);
            if (!member) return { escalated: false };

            if (actionType === 'TIMEOUT' && durationStr) {
                const ms = this.parseDuration(durationStr);
                if (ms && member.moderatable) {
                    await member.timeout(ms, reason);
                    const caseId = await this.createCase(guild, 'TIMEOUT', target, moderator, reason, { duration: durationStr, auto: true });
                    return { escalated: true, action: `TIMEOUT (${durationStr})`, caseId };
                }
            } else if (actionType === 'BAN') {
                if (member.bannable) {
                    await guild.members.ban(target.id, { reason });
                    const caseId = await this.createCase(guild, 'BAN', target, moderator, reason, { auto: true });
                    return { escalated: true, action: 'BAN', caseId };
                }
            } else if (actionType === 'KICK') {
                if (member.kickable) {
                    await member.kick(reason);
                    const caseId = await this.createCase(guild, 'KICK', target, moderator, reason, { auto: true });
                    return { escalated: true, action: 'KICK', caseId };
                }
            }
        } catch (e) {
            console.error(`[Moderation] Escalation failed: ${e.message}`);
        }

        return { escalated: false };
    }

    // ═══════════════════════════════════════════════════════════════
    // TIMED PUNISHMENTS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Register a timed punishment (temp-ban)
     */
    async addTempAction(guildId, targetId, type, expiresAt) {
        const config = await this.getConfig(guildId);
        config.tempActions.push({ targetId, type, expiresAt, guildId });
        await this.setConfig(guildId, config);
    }

    /**
     * Start the punishment expiry loop (checks every 60s)
     */
    startPunishmentLoop() {
        this.punishmentTimer = setInterval(() => this.processTempActions(), 60 * 1000);
        // Run immediately on startup after a short delay for bot to be ready
        setTimeout(() => this.processTempActions(), 10000);
    }

    /**
     * Process expired timed punishments
     */
    async processTempActions() {
        const now = Date.now();

        for (const [guildId] of this.client.guilds.cache) {
            try {
                const config = await this.getConfig(guildId);
                if (!config.tempActions || config.tempActions.length === 0) continue;

                const expired = config.tempActions.filter(a => now >= a.expiresAt);
                const remaining = config.tempActions.filter(a => now < a.expiresAt);

                if (expired.length === 0) continue;

                const guild = this.client.guilds.cache.get(guildId);
                if (!guild) continue;

                for (const action of expired) {
                    try {
                        if (action.type === 'TEMPBAN') {
                            await guild.members.unban(action.targetId, 'Temp-ban expired').catch(() => { });
                            console.log(`[Moderation] Auto-unbanned ${action.targetId} in ${guild.name}`);
                        }
                    } catch (e) {
                        console.error(`[Moderation] Failed to process expired action: ${e.message}`);
                    }
                }

                config.tempActions = remaining;
                await this.setConfig(guildId, config);
            } catch { }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // LOGGING & NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Send case log to the configured log channel
     */
    async logCase(guild, caseData, logChannelId) {
        if (!logChannelId) return;

        const channel = guild.channels.cache.get(logChannelId);
        if (!channel || !channel.isTextBased()) return;

        const colorMap = {
            BAN: '#ff0000',
            UNBAN: '#00ff00',
            KICK: '#ffa500',
            TIMEOUT: '#ffff00',
            UNTIMEOUT: '#00ff00',
            WARN: '#ffcc00',
            MUTE: '#ffff00',
            SOFTBAN: '#ff6600',
            PURGE: '#0000ff',
            TEMPBAN: '#ff3333'
        };

        const autoTag = caseData.auto ? ' `[AUTO]`' : '';
        const durationTag = caseData.duration ? ` (${caseData.duration})` : '';

        const embed = VornEmbed.create()
            .setColor(colorMap[caseData.type] || '#2b2d31')
            .setDescription([
                `### Case #${caseData.id} | ${caseData.type}${durationTag}${autoTag}`,
                '',
                `**User** ─ <@${caseData.targetId}> \`[${caseData.targetId}]\``,
                `**Moderator** ─ <@${caseData.moderatorId}>`,
                `**Reason** ─ ${caseData.reason}`,
                '',
                `- <t:${Math.floor(caseData.timestamp / 1000)}:R>`
            ].join('\n'));

        channel.send({ embeds: [embed] }).catch(() => { });
    }

    /**
     * DM the moderated user about the action
     */
    async notifyUser(user, guild, caseData) {
        try {
            const actionNames = {
                BAN: '🔨 Banned',
                TEMPBAN: '🔨 Temporarily Banned',
                KICK: '👢 Kicked',
                TIMEOUT: '🔇 Timed Out',
                WARN: '⚠️ Warned',
                SOFTBAN: '🔨 Softbanned',
                MUTE: '🔇 Muted'
            };

            const actionName = actionNames[caseData.type] || caseData.type;
            const durationLine = caseData.duration ? `\n**Duration** ─ ${caseData.duration}` : '';

            const embed = VornEmbed.create()
                .setDescription([
                    `### ${actionName}`,
                    '',
                    `**Server** ─ ${guild.name}`,
                    `**Reason** ─ ${caseData.reason}${durationLine}`,
                    `**Case** ─ #${caseData.id}`,
                    '',
                    `-# <t:${Math.floor(caseData.timestamp / 1000)}:F>`
                ].join('\n'));

            await user.send({ embeds: [embed] });
        } catch {
            // User has DMs closed — non-blocking
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // MOD STATS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Get moderation statistics
     * @param {string} guildId
     * @param {string} [moderatorId] - Optional: stats for specific mod
     */
    async getModStats(guildId, moderatorId) {
        const config = await this.getConfig(guildId);
        let cases = config.cases;

        if (moderatorId) {
            cases = cases.filter(c => c.moderatorId === moderatorId);
        }

        const stats = {
            total: cases.length,
            byType: {},
            byModerator: {},
            last7Days: 0,
            last30Days: 0
        };

        const now = Date.now();
        const day7 = 7 * 24 * 60 * 60 * 1000;
        const day30 = 30 * 24 * 60 * 60 * 1000;

        for (const c of cases) {
            // By type
            stats.byType[c.type] = (stats.byType[c.type] || 0) + 1;

            // By moderator
            if (!stats.byModerator[c.moderatorId]) {
                stats.byModerator[c.moderatorId] = { tag: c.moderatorTag, count: 0 };
            }
            stats.byModerator[c.moderatorId].count++;

            // Time ranges
            if ((now - c.timestamp) < day7) stats.last7Days++;
            if ((now - c.timestamp) < day30) stats.last30Days++;
        }

        // Top moderators (sorted)
        stats.topModerators = Object.entries(stats.byModerator)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([id, data]) => ({ id, tag: data.tag, count: data.count }));

        return stats;
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Parse a duration string like "1h", "30m", "7d" to milliseconds
     */
    parseDuration(str) {
        if (!str) return null;
        const match = str.match(/^(\d+)([smhd])$/);
        if (!match) return null;
        const val = parseInt(match[1]);
        const unit = match[2];
        const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
        return val * multipliers[unit];
    }
}

module.exports = ModerationManager;
