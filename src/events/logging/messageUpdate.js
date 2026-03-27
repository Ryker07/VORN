const { Events } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage, client) {
        if (!oldMessage.guild || !client.logging) return;
        if (oldMessage.author?.bot && !(await client.logging.shouldLogBots(oldMessage.guild.id))) return;

        // Ignore same content (e.g., embed loading)
        if (oldMessage.content === newMessage.content) return;

        // Ignore checks
        if (await client.logging.shouldIgnore(oldMessage.guild.id, {
            channelId: oldMessage.channel.id,
            userId: oldMessage.author?.id
        })) return;

        const embed = client.logging.messageEditEmbed(oldMessage, newMessage);
        await client.logging.send(oldMessage.guild, 'messages', embed);

        // Ghost Ping Detection for edits (changing the mention out)
        const oldMentions = oldMessage.mentions.users.filter(u => u.id !== oldMessage.author.id && !u.bot).size + oldMessage.mentions.roles.size;
        const newMentions = newMessage.mentions.users.filter(u => u.id !== newMessage.author.id && !u.bot).size + newMessage.mentions.roles.size;

        if (oldMentions > newMentions) {
            if ((Date.now() - oldMessage.createdTimestamp) < 300000) {
                const ghostEmbed = VornEmbed.create()
                    .setTitle('👻 Ninja Mention Edit Detected')
                    .setColor(client.logging.COLORS.warning)
                    .setDescription(`**Author:** ${oldMessage.author} \`[${oldMessage.author.id}]\`\n**Channel:** ${oldMessage.channel}\n\n**Original:**\n> ${(oldMessage.content || '*No content*').substring(0, 500)}\n\n**Edited:**\n> ${(newMessage.content || '*No content*').substring(0, 500)}`);

                await client.logging.send(oldMessage.guild, 'moderation', ghostEmbed);
            }
        }
    }
};
