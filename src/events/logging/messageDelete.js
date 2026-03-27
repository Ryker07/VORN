const { Events } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    name: Events.MessageDelete,
    async execute(message, client) {
        if (!message.guild || !client.logging || message.author?.bot) return;

        // Ignore checks
        if (await client.logging.shouldIgnore(message.guild.id, {
            channelId: message.channel.id,
            userId: message.author?.id
        })) return;

        // Ignore empty deletes
        if (!message.content && message.attachments.size === 0) return;

        const embed = client.logging.messageDeleteEmbed(message);
        await client.logging.send(message.guild, 'messages', embed);

        // Ghost Ping Detection
        const mentions = message.mentions.users.filter(u => u.id !== message.author.id && !u.bot);
        const roleMentions = message.mentions.roles;

        if (mentions.size > 0 || roleMentions.size > 0) {
            // If deleted within 5 minutes of creation, flag as ghost ping
            if ((Date.now() - message.createdTimestamp) < 300000) {
                const ghostEmbed = VornEmbed.create()
                    .setTitle('👻 Ghost Ping Detected')
                    .setColor(client.logging.COLORS.warning)
                    .setDescription(`**Author:** ${message.author} \`[${message.author.id}]\`\n**Channel:** ${message.channel}\n\n**Message Context:**\n> ${(message.content || '*No content*').substring(0, 500)}`)
                    .addFields(
                        { name: 'User Mentions', value: mentions.size > 0 ? mentions.map(u => `<@${u.id}>`).join(', ') : 'None', inline: true },
                        { name: 'Role Mentions', value: roleMentions.size > 0 ? roleMentions.map(r => `<@&${r.id}>`).join(', ') : 'None', inline: true }
                    );

                await client.logging.send(message.guild, 'moderation', ghostEmbed);
            }
        }
    }
};
