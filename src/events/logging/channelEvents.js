/**
 * Vorn — Logging: Channel Events
 * Tracks channel create, delete, and update (name, topic, permissions, slowmode, nsfw)
 */

module.exports = {
    name: 'logging_channels',
    once: false,

    async register(client) {
        // Channel Create
        client.on('channelCreate', async (channel) => {
            try {
                if (!client.logging || !channel.guild) return;

                if (await client.logging.shouldIgnore(channel.guild.id, {})) return;

                const embed = client.logging.channelCreateEmbed(channel);
                await client.logging.send(channel.guild, 'channels', embed);
            } catch { }
        });

        // Channel Delete
        client.on('channelDelete', async (channel) => {
            try {
                if (!client.logging || !channel.guild) return;

                if (await client.logging.shouldIgnore(channel.guild.id, {})) return;

                const embed = client.logging.channelDeleteEmbed(channel);
                await client.logging.send(channel.guild, 'channels', embed);
            } catch { }
        });

        // Channel Update
        client.on('channelUpdate', async (oldChannel, newChannel) => {
            try {
                if (!client.logging || !newChannel.guild) return;

                if (await client.logging.shouldIgnore(newChannel.guild.id, {
                    channelId: newChannel.id
                })) return;

                const changes = [];

                if (oldChannel.name !== newChannel.name) {
                    changes.push(`**Name** ─ \`${oldChannel.name}\` → \`${newChannel.name}\``);
                }

                if (oldChannel.topic !== newChannel.topic) {
                    changes.push(`**Topic** ─ \`${(oldChannel.topic || 'None').substring(0, 100)}\` → \`${(newChannel.topic || 'None').substring(0, 100)}\``);
                }

                if (oldChannel.nsfw !== newChannel.nsfw) {
                    changes.push(`**NSFW** ─ ${oldChannel.nsfw ? 'Yes' : 'No'} → ${newChannel.nsfw ? 'Yes' : 'No'}`);
                }

                if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
                    changes.push(`**Slowmode** ─ ${oldChannel.rateLimitPerUser || 0}s → ${newChannel.rateLimitPerUser || 0}s`);
                }

                if (oldChannel.parentId !== newChannel.parentId) {
                    const oldParent = oldChannel.parent?.name || 'None';
                    const newParent = newChannel.parent?.name || 'None';
                    changes.push(`**Category** ─ \`${oldParent}\` → \`${newParent}\``);
                }

                if (oldChannel.bitrate !== newChannel.bitrate) {
                    changes.push(`**Bitrate** ─ ${Math.floor((oldChannel.bitrate || 0) / 1000)}kbps → ${Math.floor((newChannel.bitrate || 0) / 1000)}kbps`);
                }

                if (oldChannel.userLimit !== newChannel.userLimit) {
                    changes.push(`**User Limit** ─ ${oldChannel.userLimit || 'None'} → ${newChannel.userLimit || 'None'}`);
                }

                // Permission overwrite changes
                const oldOverwrites = oldChannel.permissionOverwrites?.cache;
                const newOverwrites = newChannel.permissionOverwrites?.cache;

                if (oldOverwrites && newOverwrites) {
                    // Added overwrites
                    for (const [id, overwrite] of newOverwrites) {
                        if (!oldOverwrites.has(id)) {
                            const target = overwrite.type === 0
                                ? `<@&${id}>`
                                : `<@${id}>`;
                            changes.push(`**Permission Added** ─ ${target}`);
                        }
                    }

                    // Removed overwrites
                    for (const [id, overwrite] of oldOverwrites) {
                        if (!newOverwrites.has(id)) {
                            const target = overwrite.type === 0
                                ? `<@&${id}>`
                                : `<@${id}>`;
                            changes.push(`**Permission Removed** ─ ${target}`);
                        }
                    }

                    // Changed overwrites
                    for (const [id, newOw] of newOverwrites) {
                        const oldOw = oldOverwrites.get(id);
                        if (oldOw && (oldOw.allow.bitfield !== newOw.allow.bitfield || oldOw.deny.bitfield !== newOw.deny.bitfield)) {
                            const target = newOw.type === 0
                                ? `<@&${id}>`
                                : `<@${id}>`;
                            changes.push(`**Permission Updated** ─ ${target}`);
                        }
                    }
                }

                if (changes.length === 0) return;

                const embed = client.logging.channelUpdateEmbed(oldChannel, newChannel, changes);
                await client.logging.send(newChannel.guild, 'channels', embed);
            } catch { }
        });
    }
};
