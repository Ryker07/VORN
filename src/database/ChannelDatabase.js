/**
 * Vorn Database — Channel Database Manager
 * Advanced Discord channel-based database with smart rate limit handling
 */

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const DataSerializer = require('./DataSerializer');

class ChannelDatabase {
    constructor(client, config) {
        this.client = client;
        this.databaseServerId = config.databaseServerId;
        this.databaseCategoryId = config.databaseCategoryId;

        // Cache for performance
        this.channelCache = new Map();
        this.dataCache = new Map();
        this.messageCache = new Map();

        // Write queue for rate limit optimization
        this.writeQueue = new Map();
        this.flushInterval = null;

        // Initialize flush cycle
        this.startFlushCycle();
    }

    /**
     * Start the periodic flush cycle for batched writes
     */
    startFlushCycle() {
        // Flush queued writes every 2 seconds
        this.flushInterval = setInterval(() => this.flushWrites(), 2000);
    }

    /**
     * Stop the flush cycle
     */
    stopFlushCycle() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
    }

    /**
     * Get the database guild
     * @returns {Promise<Guild>}
     */
    async getDatabaseGuild() {
        return await this.client.guilds.fetch(this.databaseServerId);
    }

    /**
     * Get or create a data channel for a specific server
     * @param {string} serverId - The server ID to get/create channel for
     * @returns {Promise<TextChannel>}
     */
    async getOrCreateChannel(serverId) {
        // Check cache first
        if (this.channelCache.has(serverId)) {
            return this.channelCache.get(serverId);
        }

        const guild = await this.getDatabaseGuild();
        const category = await guild.channels.fetch(this.databaseCategoryId);

        // Find existing channel
        const existingChannel = guild.channels.cache.find(
            ch => ch.name === serverId && ch.parentId === this.databaseCategoryId
        );

        if (existingChannel) {
            this.channelCache.set(serverId, existingChannel);
            return existingChannel;
        }

        // Create new channel
        const newChannel = await guild.channels.create({
            name: serverId,
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                }
            ]
        });

        this.channelCache.set(serverId, newChannel);
        return newChannel;
    }

    /**
     * Load all data from a server's channel
     * @param {string} serverId - Server ID
     * @returns {Promise<Object>}
     */
    async loadServerData(serverId) {
        // Check cache
        if (this.dataCache.has(serverId)) {
            return this.dataCache.get(serverId);
        }

        const channel = await this.getOrCreateChannel(serverId);
        const messages = await channel.messages.fetch({ limit: 100 });

        const data = {};
        const messageRefs = new Map(); // Key -> [{ id, content_obj }]
        const rawParts = new Map();    // Key -> [raw_parts]

        // Process messages (oldest first)
        const sortedMessages = [...messages.values()].reverse();

        for (const message of sortedMessages) {
            if (message.author.id !== this.client.user.id) continue;

            const raw = DataSerializer.parseRaw(message.content);
            if (raw && raw.k) {
                // Store ref
                if (!messageRefs.has(raw.k)) messageRefs.set(raw.k, []);
                messageRefs.get(raw.k).push({
                    id: message.id,
                    // index for multipart, 0 for single
                    index: raw.i || 0 
                });

                // Store part
                if (!rawParts.has(raw.k)) rawParts.set(raw.k, []);
                rawParts.get(raw.k).push(raw);
            }
        }

        // Reassemble data
        for (const [key, parts] of rawParts.entries()) {
            const record = DataSerializer.reassemble(parts);
            if (record) {
                data[key] = record.value;
            }
        }

        // Cache data and message references (sorted by index)
        const flatRefs = [];
        for (const [key, refs] of messageRefs.entries()) {
            // Sort refs by index to ensure order matches chunks
            refs.sort((a, b) => a.index - b.index);
            flatRefs.push({
                key: key,
                ids: refs.map(r => r.id) // Array of IDs for this key
            });
        }

        this.dataCache.set(serverId, data);
        this.messageCache.set(serverId, flatRefs);

        return data;
    }

    /**
     * Smart read — Get a value with caching
     * @param {string} serverId - Server ID
     * @param {string} key - Data key
     * @returns {Promise<any>}
     */
    async get(serverId, key) {
        const data = await this.loadServerData(serverId);
        return data[key];
    }

    /**
     * Smart write — Queue a value for batched writing
     * @param {string} serverId - Server ID
     * @param {string} key - Data key
     * @param {any} value - Data value
     */
    async set(serverId, key, value) {
        // Update local cache immediately
        if (!this.dataCache.has(serverId)) {
            await this.loadServerData(serverId);
        }

        const data = this.dataCache.get(serverId) || {};
        data[key] = value;
        this.dataCache.set(serverId, data);

        // Queue for batched write
        if (!this.writeQueue.has(serverId)) {
            this.writeQueue.set(serverId, new Map());
        }
        this.writeQueue.get(serverId).set(key, value);
    }

    /**
     * Delete a value
     * @param {string} serverId - Server ID
     * @param {string} key - Data key
     */
    async delete(serverId, key) {
        const data = await this.loadServerData(serverId);
        delete data[key];
        this.dataCache.set(serverId, data);

        // Find and delete ALL messages containing this key
        const messageRefEntry = (this.messageCache.get(serverId) || []).find(r => r.key === key);

        if (messageRefEntry && messageRefEntry.ids) {
            try {
                const channel = await this.getOrCreateChannel(serverId);
                // Bulk delete if multiple, or single delete
                if (messageRefEntry.ids.length >= 2) {
                    await channel.bulkDelete(messageRefEntry.ids).catch(() => {});
                } else {
                    const msg = await channel.messages.fetch(messageRefEntry.ids[0]).catch(() => null);
                    if(msg) await msg.delete().catch(() => {});
                }

                // Update message cache
                const updatedRefs = (this.messageCache.get(serverId) || []).filter(r => r.key !== key);
                this.messageCache.set(serverId, updatedRefs);
            } catch (error) {
                console.error(`[Vorn DB] Failed to delete messages for ${key}: ${error.message}`);
            }
        }
    }

    /**
     * Flush queued writes to Discord
     * Uses smart editing to minimize API calls
     */
    async flushWrites() {
        for (const [serverId, updates] of this.writeQueue.entries()) {
            if (updates.size === 0) continue;

            try {
                const channel = await this.getOrCreateChannel(serverId);
                const allRefs = this.messageCache.get(serverId) || [];

                for (const [key, value] of updates.entries()) {
                    // Get chunks (might be 1 or many)
                    const chunks = DataSerializer.serializeRecord(key, value);
                    
                    // Find existing messages for this key
                    const refEntry = allRefs.find(r => r.key === key);
                    const existingIds = refEntry ? refEntry.ids : [];
                    
                    const newIds = []; // Track IDs for the updated cache

                    // 1. Update existing messages (Reuse IDs)
                    for (let i = 0; i < chunks.length; i++) {
                        const content = chunks[i];
                        
                        if (i < existingIds.length) {
                            // Reuse existing message (Edit)
                            const msgId = existingIds[i];
                            try {
                                const msg = await channel.messages.fetch(msgId);
                                if (msg.content !== content) {
                                    await msg.edit(content);
                                }
                                newIds.push(msgId);
                            } catch {
                                // Message missing? Create new
                                const newMsg = await channel.send(content);
                                newIds.push(newMsg.id);
                            }
                        } else {
                            // No existing message? Create new
                            const newMsg = await channel.send(content);
                            newIds.push(newMsg.id);
                        }
                    }

                    // 2. Delete excess messages (if new data is smaller)
                    if (existingIds.length > chunks.length) {
                        const excessIds = existingIds.slice(chunks.length);
                        if (excessIds.length > 0) {
                            await channel.bulkDelete(excessIds).catch(() => {
                                // Fallback for old messages
                                excessIds.forEach(id => channel.messages.delete(id).catch(() => {}));
                            });
                        }
                    }

                    // 3. Update Ref Cache
                    if (refEntry) {
                        refEntry.ids = newIds;
                    } else {
                        allRefs.push({ key, ids: newIds });
                    }
                }

                this.messageCache.set(serverId, allRefs);
            } catch (error) {
                console.error(`[Vorn DB] Flush error for ${serverId}: ${error.message}`);
            }

            // Clear processed updates
            updates.clear();
        }
    }

    /**
     * Force flush all pending writes immediately
     */
    async forceFlush() {
        await this.flushWrites();
    }

    /**
     * Get all data for a server
     * @param {string} serverId - Server ID
     * @returns {Promise<Object>}
     */
    async getAll(serverId) {
        return await this.loadServerData(serverId);
    }

    /**
     * Check if a key exists
     * @param {string} serverId - Server ID
     * @param {string} key - Data key
     * @returns {Promise<boolean>}
     */
    async has(serverId, key) {
        const data = await this.loadServerData(serverId);
        return key in data;
    }

    /**
     * Clear all data for a server
     * @param {string} serverId - Server ID
     */
    async clear(serverId) {
        try {
            const channel = await this.getOrCreateChannel(serverId);
            const messages = await channel.messages.fetch({ limit: 100 });

            // Batch delete bot messages
            const botMessages = messages.filter(m => m.author.id === this.client.user.id);
            if (botMessages.size > 0) {
                await channel.bulkDelete(botMessages);
            }

            // Clear caches
            this.dataCache.delete(serverId);
            this.messageCache.delete(serverId);
            this.writeQueue.delete(serverId);
        } catch (error) {
            console.error(`[Vorn DB] Clear error for ${serverId}: ${error.message}`);
        }
    }

    /**
     * Get database statistics
     * @returns {Object}
     */
    getStats() {
        return {
            cachedServers: this.dataCache.size,
            cachedChannels: this.channelCache.size,
            pendingWrites: [...this.writeQueue.values()].reduce((sum, map) => sum + map.size, 0)
        };
    }
}

module.exports = ChannelDatabase;
