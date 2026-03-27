const { Events, ChannelType } = require('discord.js');

module.exports = {
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel, client) {
        if (!newChannel.guild || !client.logging) return;

        if (newChannel.type === ChannelType.DM || newChannel.type === ChannelType.GroupDM) return;

        if (await client.logging.shouldIgnore(newChannel.guild.id, { channelId: newChannel.id })) return;

        const changes = [];

        if (oldChannel.name !== newChannel.name) {
            changes.push(`**Name:** \`#${oldChannel.name}\` ➔ \`#${newChannel.name}\``);
        }

        if (oldChannel.topic !== newChannel.topic) {
            changes.push(`**Topic Changed:**\n${oldChannel.topic || '*None*'} ➔ ${newChannel.topic || '*None*'}`);
        }

        if (oldChannel.parentId !== newChannel.parentId) {
            changes.push(`**Category:** ${oldChannel.parent?.name || '*None*'} ➔ ${newChannel.parent?.name || '*None*'}`);
        }

        if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
            changes.push(`**Slowmode:** ${oldChannel.rateLimitPerUser}s ➔ ${newChannel.rateLimitPerUser}s`);
        }

        if (changes.length === 0) return;

        const embed = client.logging.channelUpdateEmbed(oldChannel, newChannel, changes);
        await client.logging.send(newChannel.guild, 'channels', embed);
    }
};
