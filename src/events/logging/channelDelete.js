const { Events, ChannelType } = require('discord.js');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel, client) {
        if (!channel.guild || !client.logging) return;

        if (channel.type === ChannelType.DM || channel.type === ChannelType.GroupDM) return;

        if (await client.logging.shouldIgnore(channel.guild.id, { channelId: channel.id })) return;

        const embed = client.logging.channelDeleteEmbed(channel);
        await client.logging.send(channel.guild, 'channels', embed);
    }
};
