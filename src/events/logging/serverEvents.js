/**
 * Vorn — Logging: Server Events
 * Tracks server setting changes, emoji/sticker updates, thread lifecycle
 */

module.exports = {
    name: 'logging_server',
    once: false,

    async register(client) {
        // Guild Update
        client.on('guildUpdate', async (oldGuild, newGuild) => {
            try {
                if (!client.logging) return;

                if (await client.logging.shouldIgnore(newGuild.id, {})) return;

                const changes = [];

                if (oldGuild.name !== newGuild.name) {
                    changes.push(`**Name** ─ \`${oldGuild.name}\` → \`${newGuild.name}\``);
                }
                if (oldGuild.icon !== newGuild.icon) {
                    changes.push(`**Icon** ─ Changed`);
                }
                if (oldGuild.banner !== newGuild.banner) {
                    changes.push(`**Banner** ─ Changed`);
                }
                if (oldGuild.splash !== newGuild.splash) {
                    changes.push(`**Splash** ─ Changed`);
                }
                if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
                    changes.push(`**Vanity URL** ─ \`${oldGuild.vanityURLCode || 'None'}\` → \`${newGuild.vanityURLCode || 'None'}\``);
                }
                if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
                    changes.push(`**Verification Level** ─ ${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`);
                }
                if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) {
                    changes.push(`**Content Filter** ─ ${oldGuild.explicitContentFilter} → ${newGuild.explicitContentFilter}`);
                }
                if (oldGuild.defaultMessageNotifications !== newGuild.defaultMessageNotifications) {
                    changes.push(`**Default Notifications** ─ ${oldGuild.defaultMessageNotifications} → ${newGuild.defaultMessageNotifications}`);
                }
                if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
                    changes.push(`**AFK Channel** ─ ${oldGuild.afkChannelId ? `<#${oldGuild.afkChannelId}>` : 'None'} → ${newGuild.afkChannelId ? `<#${newGuild.afkChannelId}>` : 'None'}`);
                }
                if (oldGuild.afkTimeout !== newGuild.afkTimeout) {
                    changes.push(`**AFK Timeout** ─ ${oldGuild.afkTimeout}s → ${newGuild.afkTimeout}s`);
                }
                if (oldGuild.systemChannelId !== newGuild.systemChannelId) {
                    changes.push(`**System Channel** ─ ${oldGuild.systemChannelId ? `<#${oldGuild.systemChannelId}>` : 'None'} → ${newGuild.systemChannelId ? `<#${newGuild.systemChannelId}>` : 'None'}`);
                }
                if (oldGuild.rulesChannelId !== newGuild.rulesChannelId) {
                    changes.push(`**Rules Channel** ─ ${oldGuild.rulesChannelId ? `<#${oldGuild.rulesChannelId}>` : 'None'} → ${newGuild.rulesChannelId ? `<#${newGuild.rulesChannelId}>` : 'None'}`);
                }
                if (oldGuild.premiumTier !== newGuild.premiumTier) {
                    changes.push(`**Boost Tier** ─ ${oldGuild.premiumTier} → ${newGuild.premiumTier}`);
                }
                if (oldGuild.premiumSubscriptionCount !== newGuild.premiumSubscriptionCount) {
                    changes.push(`**Boosts** ─ ${oldGuild.premiumSubscriptionCount} → ${newGuild.premiumSubscriptionCount}`);
                }
                if (oldGuild.ownerId !== newGuild.ownerId) {
                    changes.push(`**Owner** ─ <@${oldGuild.ownerId}> → <@${newGuild.ownerId}>`);
                }

                if (changes.length === 0) return;

                const embed = client.logging.serverUpdateEmbed(oldGuild, newGuild, changes);
                await client.logging.send(newGuild, 'server', embed);
            } catch { }
        });

        // Emoji Create
        client.on('emojiCreate', async (emoji) => {
            try {
                if (!client.logging) return;
                if (await client.logging.shouldIgnore(emoji.guild.id, {})) return;

                const embed = client.logging.emojiChangeEmbed(emoji, 'Created');
                await client.logging.send(emoji.guild, 'emojis', embed);
            } catch { }
        });

        // Emoji Delete
        client.on('emojiDelete', async (emoji) => {
            try {
                if (!client.logging) return;
                if (await client.logging.shouldIgnore(emoji.guild.id, {})) return;

                const embed = client.logging.emojiChangeEmbed(emoji, 'Deleted');
                await client.logging.send(emoji.guild, 'emojis', embed);
            } catch { }
        });

        // Emoji Update
        client.on('emojiUpdate', async (oldEmoji, newEmoji) => {
            try {
                if (!client.logging) return;
                if (await client.logging.shouldIgnore(newEmoji.guild.id, {})) return;

                if (oldEmoji.name === newEmoji.name) return;

                const embed = client.logging.createEmbed(client.logging.COLORS.update)
                    .setDescription([
                        `### Emoji Updated`,
                        '',
                        `**Name** ─ \`:${oldEmoji.name}:\` → \`:${newEmoji.name}:\``,
                        `**Preview** ─ ${newEmoji}`
                    ].join('\n'))
                    .setFooter({ text: `ID: ${newEmoji.id}` });

                await client.logging.send(newEmoji.guild, 'emojis', embed);
            } catch { }
        });

        // Thread Create
        client.on('threadCreate', async (thread) => {
            try {
                if (!client.logging || !thread.guild) return;
                if (await client.logging.shouldIgnore(thread.guild.id, {})) return;

                const embed = client.logging.threadCreateEmbed(thread);
                await client.logging.send(thread.guild, 'threads', embed);
            } catch { }
        });

        // Thread Delete
        client.on('threadDelete', async (thread) => {
            try {
                if (!client.logging || !thread.guild) return;
                if (await client.logging.shouldIgnore(thread.guild.id, {})) return;

                const embed = client.logging.threadDeleteEmbed(thread);
                await client.logging.send(thread.guild, 'threads', embed);
            } catch { }
        });

        // Invite Create (logging category)
        client.on('inviteCreate', async (invite) => {
            try {
                if (!client.logging || !invite.guild) return;
                if (await client.logging.shouldIgnore(invite.guild.id, {})) return;

                const embed = client.logging.inviteCreateEmbed(invite);
                await client.logging.send(invite.guild, 'invites', embed);
            } catch { }
        });

        // Invite Delete (logging category)
        client.on('inviteDelete', async (invite) => {
            try {
                if (!client.logging || !invite.guild) return;
                if (await client.logging.shouldIgnore(invite.guild.id, {})) return;

                const embed = client.logging.inviteDeleteEmbed(invite);
                await client.logging.send(invite.guild, 'invites', embed);
            } catch { }
        });
    }
};
