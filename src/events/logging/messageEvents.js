/**
 * Vorn — Logging: Message Events
 * Tracks message edits, deletes, bulk deletes
 */

module.exports = {
    name: 'logging_messages',
    once: false,

    async register(client) {
        // Message Delete
        client.on('messageDelete', async (message) => {
            try {
                if (!message.guild || !client.logging) return;
                if (message.partial) return;
                if (!message.author) return;

                // Check ignore
                if (!message.author.bot || await client.logging.shouldLogBots(message.guild.id)) {
                    if (message.author.bot && !await client.logging.shouldLogBots(message.guild.id)) return;
                }
                if (message.author.bot && !await client.logging.shouldLogBots(message.guild.id)) return;

                if (await client.logging.shouldIgnore(message.guild.id, {
                    channelId: message.channel.id,
                    userId: message.author.id
                })) return;

                // Skip if no real content
                if (!message.content && message.attachments.size === 0 && message.embeds.length === 0) return;

                const embed = client.logging.messageDeleteEmbed(message);
                await client.logging.send(message.guild, 'messages', embed);
            } catch { }
        });

        // Message Edit
        client.on('messageUpdate', async (oldMessage, newMessage) => {
            try {
                if (!newMessage.guild || !client.logging) return;
                if (oldMessage.partial || newMessage.partial) return;
                if (!newMessage.author) return;

                if (newMessage.author.bot && !await client.logging.shouldLogBots(newMessage.guild.id)) return;

                if (await client.logging.shouldIgnore(newMessage.guild.id, {
                    channelId: newMessage.channel.id,
                    userId: newMessage.author.id
                })) return;

                // Only log content changes
                if (oldMessage.content === newMessage.content) return;

                const embed = client.logging.messageEditEmbed(oldMessage, newMessage);
                await client.logging.send(newMessage.guild, 'messages', embed);
            } catch { }
        });

        // Bulk Delete
        client.on('messageDeleteBulk', async (messages, channel) => {
            try {
                if (!channel.guild || !client.logging) return;

                if (await client.logging.shouldIgnore(channel.guild.id, {
                    channelId: channel.id
                })) return;

                const embed = client.logging.messageBulkDeleteEmbed(messages, channel);
                await client.logging.send(channel.guild, 'messages', embed);
            } catch { }
        });
    }
};
