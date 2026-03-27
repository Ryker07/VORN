/**
 * Vorn — AFK Handler
 * Manages auto-replies and AFK removal
 */

const { Events } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // 1. Check if Author is AFK (Remove AFK)
        // We do a quick check first to avoid DB hits if memory cache is available
        const afkData = await client.afk.removeAfk(message.guild.id, message.author.id);

        if (afkData) {
            // Restore nickname if it has prefix
            if (message.member.manageable && message.member.displayName.startsWith('[AFK] ')) {
                try {
                    await message.member.setNickname(message.member.displayName.replace('[AFK] ', ''));
                } catch { }
            }

            const welcomeEmbed = VornEmbed.create()
                .setTitle('Welcome Back! 👋')
                .setDescription(`### AFK Removed\nYour previous status: **${afkData.reason}**`);

            if (afkData.mentions && afkData.mentions.length > 0) {
                const mentionsList = afkData.mentions.map(m => {
                    const time = Math.floor(m.timestamp / 1000);
                    return `• **${m.authorTag}** (<t:${time}:R>): [Jump to Message](${m.url})`;
                }).join('\n');

                welcomeEmbed.addFields({
                    name: `Summary`,
                    value: `**__You were mentioned ${afkData.mentions.length} times__**\n${mentionsList.slice(0, 1000)}` // Safe limit
                });
            } else {
                welcomeEmbed.setFooter({ text: 'No one mentioned you while you were away.' });
            }

            await message.reply({ embeds: [welcomeEmbed] }).then(msg => {
                // Delete after 10 seconds to keep chat clean
                setTimeout(() => msg.delete().catch(() => { }), 10000);
            });
        }

        // 2. Check if mentioned users are AFK (Auto-Reply)
        if (message.mentions.users.size > 0) {
            for (const [userId, user] of message.mentions.users) {
                if (userId === message.author.id) continue; // Ignore self-mentions
                if (user.bot) continue;

                const targetAfk = await client.afk.getAfk(message.guild.id, userId);
                if (targetAfk) {
                    // Send Auto-Reply
                    const reply = await message.reply({
                        embeds: [VornEmbed.info('User is AFK', `### ${user.tag} is away 💤\n**Reason:** ${targetAfk.reason}`)]
                    });

                    // Delete notification after 5 seconds
                    setTimeout(() => reply.delete().catch(() => { }), 5000);

                    // Log this mention for the AFK user
                    await client.afk.addMention(message.guild.id, userId, {
                        authorId: message.author.id,
                        authorTag: message.author.tag,
                        url: message.url,
                        timestamp: Date.now()
                    });
                }
            }
        }
    }
};
