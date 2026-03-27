const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageBulkDelete,
    async execute(messages, channel, client) {
        if (!channel.guild || !client.logging || messages.size === 0) return;

        if (await client.logging.shouldIgnore(channel.guild.id, { channelId: channel.id })) return;

        const embed = client.logging.messageBulkDeleteEmbed(messages, channel);
        await client.logging.send(channel.guild, 'messages', embed);
    }
};
