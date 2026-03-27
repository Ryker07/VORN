/**
 * Vorn — /serverinfo Command
 * Displays detailed server information
 */

const { SlashCommandBuilder, ChannelType } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('View detailed server information'),

    async execute(interaction, client) {
        const guild = interaction.guild;

        // Fetch full guild data
        await guild.members.fetch().catch(() => { });

        const owner = await guild.fetchOwner().catch(() => null);
        const channels = guild.channels.cache;
        const roles = guild.roles.cache;
        const members = guild.members.cache;

        // Channel breakdown
        const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
        const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;
        const forums = channels.filter(c => c.type === ChannelType.GuildForum).size;
        const stages = channels.filter(c => c.type === ChannelType.GuildStageVoice).size;

        // Member breakdown
        const humans = members.filter(m => !m.user.bot).size;
        const bots = members.filter(m => m.user.bot).size;
        const online = members.filter(m => m.presence?.status === 'online').size;

        // Boost info
        const boostLevel = guild.premiumTier;
        const boostCount = guild.premiumSubscriptionCount || 0;

        // Verification level
        const verificationLevels = {
            0: 'None',
            1: 'Low',
            2: 'Medium',
            3: 'High',
            4: 'Very High'
        };

        const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

        const embed = VornEmbed.create()
            .setTitle(guild.name)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
            .setDescription(guild.description || null)
            .addFields(
                // General
                { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: 'Created', value: `<t:${createdTimestamp}:R>`, inline: true },
                { name: 'Verification', value: `\`${verificationLevels[guild.verificationLevel] || 'Unknown'}\``, inline: true },

                // Counts
                { name: 'Members', value: `\`${guild.memberCount}\` (${humans} humans, ${bots} bots)`, inline: false },

                // Channels Breakdown (Grid)
                { name: 'Text', value: `\`${textChannels}\``, inline: true },
                { name: 'Voice', value: `\`${voiceChannels}\``, inline: true },
                { name: 'Categories', value: `\`${categories}\``, inline: true },

                // Stats
                { name: 'Roles', value: `\`${roles.size}\``, inline: true },
                { name: 'Boosts', value: `\`Level ${boostLevel}\` (${boostCount} boosts)`, inline: true },
            )
            .setFooter({ text: `ID: ${guild.id}` });

        if (guild.bannerURL()) {
            embed.setImage(guild.bannerURL({ size: 1024 }));
        }

        await interaction.reply({ embeds: [embed] });
    }
};
