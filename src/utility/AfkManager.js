/**
 * Vorn — AFK Manager
 * Handles AFK status, persistence, and mention tracking
 */

const { Collection } = require('discord.js');

class AfkManager {
    constructor(client) {
        this.client = client;
        // In-memory cache: guildId -> userId -> { reason, timestamp, mentions: [] }
        this.cache = new Collection();
    }

    /**
     * Get AFK data for a user
     */
    async getAfk(guildId, userId) {
        if (!this.cache.has(guildId)) {
            await this.loadGuild(guildId);
        }
        const guildData = this.cache.get(guildId);
        return guildData ? guildData.get(userId) : null;
    }

    /**
     * Set user as AFK
     */
    async setAfk(guildId, userId, reason) {
        if (!this.cache.has(guildId)) {
            await this.loadGuild(guildId);
        }

        const afkData = {
            reason: reason || 'AFK',
            timestamp: Date.now(),
            mentions: []
        };

        this.cache.get(guildId).set(userId, afkData);
        await this.saveGuild(guildId);
    }

    /**
     * Remove AFK status
     * @returns {Object|null} The AFK data (including mentions) if they were AFK
     */
    async removeAfk(guildId, userId) {
        if (!this.cache.has(guildId)) {
            await this.loadGuild(guildId);
        }

        const guildData = this.cache.get(guildId);
        if (!guildData.has(userId)) return null;

        const data = guildData.get(userId);
        guildData.delete(userId);
        await this.saveGuild(guildId);

        return data; // Return data so we can show summary
    }

    /**
     * Add a mention to the AFK user's backlog
     */
    async addMention(guildId, targetId, mentionData) {
        if (!this.cache.has(guildId)) {
            await this.loadGuild(guildId);
        }

        const guildData = this.cache.get(guildId);
        const userAfk = guildData.get(targetId);

        if (userAfk) {
            // Limit stored mentions to prevent abuse/bloat (e.g. max 10)
            if (userAfk.mentions.length < 10) {
                userAfk.mentions.push(mentionData);
                await this.saveGuild(guildId);
            }
        }
    }

    /**
     * Load guild data from DB
     */
    async loadGuild(guildId) {
        const data = await this.client.db.get(guildId, 'afk_data') || {};
        const map = new Collection();

        for (const [userId, afkInfo] of Object.entries(data)) {
            map.set(userId, afkInfo);
        }

        this.cache.set(guildId, map);
    }

    /**
     * Save guild data to DB
     */
    async saveGuild(guildId) {
        const guildData = this.cache.get(guildId);
        if (!guildData) return;

        const json = {};
        for (const [userId, data] of guildData) {
            json[userId] = data;
        }

        await this.client.db.set(guildId, 'afk_data', json);
    }
}

module.exports = AfkManager;
