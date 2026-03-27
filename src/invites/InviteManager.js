/**
 * Vorn — Invite Tracker Manager
 * Advanced invite tracking with rewards, leaderboards, fake detection, and logging
 */

const VornEmbed = require('../utils/embedBuilder');

class InviteManager {
    constructor(client) {
        this.client = client;

        // Map<guildId, Map<code, uses>>
        this.inviteCache = new Map();

        // Map<guildId, Map<memberId, joinData>> — temporary store for recent joins
        this.recentJoins = new Map();

        this.setupInviteCache();
    }

    /**
     * Cache all guild invites on ready
     */
    async setupInviteCache() {
        for (const [guildId, guild] of this.client.guilds.cache) {
            try {
                const invites = await guild.invites.fetch();
                this.inviteCache.set(guildId, new Map(invites.map(i => [i.code, i.uses])));
            } catch {
                // No permission to fetch invites
            }
        }
        console.log('[Vorn] Invite cache initialized');
    }

    /**
     * Update cache when an invite is created
     */
    handleInviteCreate(invite) {
        const guildInvites = this.inviteCache.get(invite.guild.id) || new Map();
        guildInvites.set(invite.code, invite.uses);
        this.inviteCache.set(invite.guild.id, guildInvites);
    }

    /**
     * Update cache when an invite is deleted
     */
    handleInviteDelete(invite) {
        const guildInvites = this.inviteCache.get(invite.guild.id);
        if (guildInvites) {
            guildInvites.delete(invite.code);
        }
    }

    /**
     * Compare cached vs current invites to find which was used
     */
    async findUsedInvite(guild) {
        try {
            const cachedInvites = this.inviteCache.get(guild.id);
            if (!cachedInvites) return null;

            const newInvites = await guild.invites.fetch();
            let usedInvite = null;

            for (const [code, invite] of newInvites) {
                const oldUses = cachedInvites.get(code) || 0;
                if (invite.uses > oldUses) {
                    usedInvite = invite;
                    break;
                }
            }

            // Update cache
            this.inviteCache.set(guild.id, new Map(newInvites.map(i => [i.code, i.uses])));

            return usedInvite;
        } catch {
            return null;
        }
    }

    /**
     * Handle member join — detect inviter, store data, update stats, check rewards
     */
    async handleJoin(member) {
        try {
            const config = await this.getConfig(member.guild.id);
            if (!config.enabled) return null;

            const usedInvite = await this.findUsedInvite(member.guild);
            if (!usedInvite || !usedInvite.inviter) return null;

            const inviterId = usedInvite.inviter.id;
            const data = await this.getData(member.guild.id);

            // Initialize inviter stats if needed
            if (!data.users[inviterId]) {
                data.users[inviterId] = { regular: 0, left: 0, fake: 0, bonus: 0 };
            }

            // Check if this is a fake invite
            const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / (24 * 60 * 60 * 1000));
            const isFake = accountAgeDays < config.fakeDays;

            // Store join record
            data.joins[member.id] = {
                inviterId,
                code: usedInvite.code,
                timestamp: Date.now(),
                fake: isFake
            };

            // Update stats
            if (isFake) {
                data.users[inviterId].fake++;
            } else {
                data.users[inviterId].regular++;
            }

            await this.setData(member.guild.id, data);

            // Store recent join for WelcomeManager
            const guildJoins = this.recentJoins.get(member.guild.id) || new Map();
            guildJoins.set(member.id, {
                inviter: usedInvite.inviter,
                inviterUses: this.getTotal(data.users[inviterId]),
                code: usedInvite.code,
                fake: isFake
            });
            this.recentJoins.set(member.guild.id, guildJoins);

            // Check rewards
            await this.checkRewards(member.guild, inviterId, data);

            // Log
            await this.log(member.guild, 'join', {
                member,
                inviter: usedInvite.inviter,
                code: usedInvite.code,
                total: this.getTotal(data.users[inviterId]),
                fake: isFake,
                accountAgeDays
            });

            return {
                inviter: usedInvite.inviter,
                inviterUses: this.getTotal(data.users[inviterId]),
                code: usedInvite.code,
                fake: isFake
            };
        } catch (error) {
            console.error(`[Vorn Invites] Join handling failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Handle member leave — update inviter stats
     */
    async handleLeave(member) {
        try {
            const config = await this.getConfig(member.guild.id);
            if (!config.enabled) return;

            const data = await this.getData(member.guild.id);
            const joinRecord = data.joins[member.id];
            if (!joinRecord) return;

            const inviterId = joinRecord.inviterId;
            if (!data.users[inviterId]) return;

            // Check if the leave was within fakeLeave minutes
            const minutesSinceJoin = (Date.now() - joinRecord.timestamp) / (60 * 1000);
            const isFakeLeave = minutesSinceJoin < config.fakeLeave;

            if (joinRecord.fake) {
                // Already counted as fake, no change needed
            } else if (isFakeLeave) {
                // Reclassify as fake
                data.users[inviterId].regular = Math.max(0, data.users[inviterId].regular - 1);
                data.users[inviterId].fake++;
                joinRecord.fake = true;
            } else {
                // Normal leave
                data.users[inviterId].regular = Math.max(0, data.users[inviterId].regular - 1);
                data.users[inviterId].left++;
            }

            // Remove join record
            delete data.joins[member.id];
            await this.setData(member.guild.id, data);

            // Check rewards (might need to remove roles)
            await this.checkRewards(member.guild, inviterId, data);

            // Log
            const inviter = await this.client.users.fetch(inviterId).catch(() => null);
            await this.log(member.guild, 'leave', {
                member,
                inviter,
                total: this.getTotal(data.users[inviterId]),
                fakeLeave: isFakeLeave
            });
        } catch (error) {
            console.error(`[Vorn Invites] Leave handling failed: ${error.message}`);
        }
    }

    /**
     * Get last join data for a member (used by WelcomeManager)
     */
    getLastJoin(guildId, memberId) {
        const guildJoins = this.recentJoins.get(guildId);
        if (!guildJoins) return null;

        const data = guildJoins.get(memberId);
        if (data) {
            // Clean up after retrieval (keep for 60 seconds max)
            setTimeout(() => {
                const joins = this.recentJoins.get(guildId);
                if (joins) joins.delete(memberId);
            }, 60000);
        }
        return data;
    }

    /**
     * Compute total invites for a user
     */
    getTotal(stats) {
        if (!stats) return 0;
        return stats.regular + stats.bonus - stats.fake;
    }

    /**
     * Get invite stats for a user
     */
    async getStats(guildId, userId) {
        const data = await this.getData(guildId);
        const stats = data.users[userId] || { regular: 0, left: 0, fake: 0, bonus: 0 };
        return {
            ...stats,
            total: this.getTotal(stats)
        };
    }

    /**
     * Get recent invites by a user (members they invited who are still in server)
     */
    async getRecentInvites(guildId, userId, limit = 5) {
        const data = await this.getData(guildId);
        const recent = [];

        for (const [memberId, joinData] of Object.entries(data.joins)) {
            if (joinData.inviterId === userId && !joinData.fake) {
                recent.push({ memberId, timestamp: joinData.timestamp });
            }
        }

        return recent
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Get sorted leaderboard
     */
    async getLeaderboard(guildId, page = 1) {
        const data = await this.getData(guildId);
        const perPage = 10;

        const sorted = Object.entries(data.users)
            .map(([userId, stats]) => ({
                userId,
                total: this.getTotal(stats),
                ...stats
            }))
            .filter(u => u.total > 0)
            .sort((a, b) => b.total - a.total);

        const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
        const safeePage = Math.min(Math.max(1, page), totalPages);
        const start = (safeePage - 1) * perPage;
        const entries = sorted.slice(start, start + perPage);

        return {
            entries,
            page: safeePage,
            totalPages,
            totalEntries: sorted.length
        };
    }

    /**
     * Get active invite codes for a user
     */
    async getCodes(guild, userId) {
        try {
            const invites = await guild.invites.fetch();
            return invites
                .filter(inv => inv.inviter?.id === userId)
                .map(inv => ({
                    code: inv.code,
                    uses: inv.uses,
                    maxUses: inv.maxUses,
                    expiresAt: inv.expiresTimestamp,
                    channel: inv.channel?.name || 'Unknown'
                }));
        } catch {
            return [];
        }
    }

    /**
     * Add bonus invites
     */
    async addBonus(guildId, userId, amount) {
        const data = await this.getData(guildId);
        if (!data.users[userId]) {
            data.users[userId] = { regular: 0, left: 0, fake: 0, bonus: 0 };
        }
        data.users[userId].bonus += amount;
        await this.setData(guildId, data);

        const guild = this.client.guilds.cache.get(guildId);
        if (guild) await this.checkRewards(guild, userId, data);

        return this.getTotal(data.users[userId]);
    }

    /**
     * Remove bonus invites
     */
    async removeBonus(guildId, userId, amount) {
        const data = await this.getData(guildId);
        if (!data.users[userId]) return 0;
        data.users[userId].bonus = Math.max(0, data.users[userId].bonus - amount);
        await this.setData(guildId, data);

        const guild = this.client.guilds.cache.get(guildId);
        if (guild) await this.checkRewards(guild, userId, data);

        return this.getTotal(data.users[userId]);
    }

    /**
     * Reset a user's invite stats
     */
    async resetUser(guildId, userId) {
        const data = await this.getData(guildId);
        delete data.users[userId];

        // Remove join records where this user was the inviter
        for (const [memberId, joinData] of Object.entries(data.joins)) {
            if (joinData.inviterId === userId) {
                delete data.joins[memberId];
            }
        }

        await this.setData(guildId, data);
    }

    /**
     * Reset all invite data for a guild
     */
    async resetAll(guildId) {
        await this.setData(guildId, { users: {}, joins: {} });
    }

    /**
     * Add an invite milestone reward
     */
    async addReward(guildId, count, roleId) {
        const config = await this.getConfig(guildId);
        config.rewards = config.rewards.filter(r => r.roleId !== roleId);
        config.rewards.push({ count, roleId });
        config.rewards.sort((a, b) => a.count - b.count);
        await this.setConfig(guildId, config);
    }

    /**
     * Remove an invite milestone reward
     */
    async removeReward(guildId, roleId) {
        const config = await this.getConfig(guildId);
        config.rewards = config.rewards.filter(r => r.roleId !== roleId);
        await this.setConfig(guildId, config);
    }

    /**
     * Check and assign/remove reward roles based on current total
     */
    async checkRewards(guild, userId, data) {
        try {
            const config = await this.getConfig(guild.id);
            if (config.rewards.length === 0) return;

            const stats = data.users[userId];
            if (!stats) return;

            const total = this.getTotal(stats);
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;

            for (const reward of config.rewards) {
                const role = guild.roles.cache.get(reward.roleId);
                if (!role) continue;

                if (role.position >= guild.members.me.roles.highest.position) continue;

                if (total >= reward.count) {
                    if (!member.roles.cache.has(reward.roleId)) {
                        await member.roles.add(role).catch(() => {});
                    }
                } else {
                    if (member.roles.cache.has(reward.roleId)) {
                        await member.roles.remove(role).catch(() => {});
                    }
                }
            }
        } catch (error) {
            console.error(`[Vorn Invites] Reward check failed: ${error.message}`);
        }
    }

    /**
     * Send log embed to configured channel
     */
    async log(guild, type, data) {
        try {
            const config = await this.getConfig(guild.id);
            if (!config.channelId) return;

            const channel = await guild.channels.fetch(config.channelId).catch(() => null);
            if (!channel) return;

            let embed;

            if (type === 'join') {
                const lines = [
                    `${data.member} joined`,
                    '',
                    VornEmbed.format.field('Invited by', `${data.inviter}`),
                    VornEmbed.format.field('Code', `\`${data.code}\``),
                    VornEmbed.format.field('Total', `${data.total} invites`)
                ];

                if (data.fake) {
                    lines.push('');
                    lines.push(`**Flagged** ── Account age: ${data.accountAgeDays} days`);
                }

                embed = VornEmbed.create()
                    .setDescription(lines.join('\n'))
                    .setFooter({ text: `${data.member.user.tag} ── Join` });

            } else if (type === 'leave') {
                const lines = [
                    `${data.member} left`,
                    '',
                    VornEmbed.format.field('Invited by', data.inviter ? `${data.inviter}` : 'Unknown'),
                    VornEmbed.format.field('Inviter total', `${data.total} invites`)
                ];

                if (data.fakeLeave) {
                    lines.push('');
                    lines.push('**Flagged** ── Quick leave detected');
                }

                embed = VornEmbed.create()
                    .setDescription(lines.join('\n'))
                    .setFooter({ text: `${data.member.user.tag} ── Leave` });
            }

            if (embed) {
                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error(`[Vorn Invites] Log failed: ${error.message}`);
        }
    }

    /**
     * Get who invited a specific member
     */
    async getInviter(guildId, memberId) {
        const data = await this.getData(guildId);
        const joinRecord = data.joins[memberId];
        if (!joinRecord) return null;

        const inviter = await this.client.users.fetch(joinRecord.inviterId).catch(() => null);
        return inviter;
    }

    /**
     * Get config from database
     */
    async getConfig(guildId) {
        const stored = await this.client.db.get(guildId, 'invite_config') || {};
        return {
            enabled: false,
            channelId: null,
            fakeDays: 7,
            fakeLeave: 120,
            rewards: [],
            ...stored
        };
    }

    /**
     * Set config in database
     */
    async setConfig(guildId, config) {
        await this.client.db.set(guildId, 'invite_config', config);
    }

    /**
     * Get invite data from database
     */
    async getData(guildId) {
        const stored = await this.client.db.get(guildId, 'invite_data') || {};
        return {
            users: {},
            joins: {},
            ...stored
        };
    }

    /**
     * Set invite data in database
     */
    async setData(guildId, data) {
        await this.client.db.set(guildId, 'invite_data', data);
    }
}

module.exports = InviteManager;
