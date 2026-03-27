const { Events, ChannelType } = require('discord.js');

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel, client) {
        if (!channel.guild || !client.logging) return;

        if (channel.type === ChannelType.DM || channel.type === ChannelType.GroupDM) return;

        const embed = client.logging.channelCreateEmbed(channel);
        await client.logging.send(channel.guild, 'channels', embed);
    }
};
