/**
 * Vorn — /userinfo Command
 * Displays detailed user information with mod history count
 */

const { SlashCommandBuilder } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('View detailed user information')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('Target user (default: yourself)')
        ),

    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({
                embeds: [VornEmbed.error('User not found in this server.')],
                ephemeral: true
            });
        }

        const user = member.user;

        // Timestamps
        const createdAt = Math.floor(user.createdTimestamp / 1000);
        const joinedAt = Math.floor(member.joinedTimestamp / 1000);

        // Roles (exclude @everyone, sort by position)
        const roles = member.roles.cache
            .filter(r => r.id !== interaction.guild.id)
            .sort((a, b) => b.position - a.position);
        const roleCount = roles.size;
        const topRoles = roles.first(10);
        const roleDisplay = topRoles.map(r => `<@&${r.id}>`).join(' ');
        const extraRoles = roleCount > 10 ? ` +${roleCount - 10} more` : '';

        // Key permissions
        const keyPerms = [];
        const permChecks = {
            Administrator: 'Administrator',
            ManageGuild: 'Manage Server',
            ManageRoles: 'Manage Roles',
            ManageChannels: 'Manage Channels',
            ManageMessages: 'Manage Messages',
            BanMembers: 'Ban Members',
            KickMembers: 'Kick Members',
            ModerateMembers: 'Moderate Members'
        };

        for (const [perm, label] of Object.entries(permChecks)) {
            if (member.permissions.has(perm)) {
                keyPerms.push(`\`${label}\``);
            }
        }

        // Mod history count
        let caseCount = 0;
        try {
            const config = await client.moderation.getConfig(interaction.guild.id);
            if (config.cases) {
                caseCount = config.cases.filter(c => c.targetId === user.id).length;
            }
        } catch { }

        // Boost status
        const boostingSince = member.premiumSince
            ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`
            : 'Not boosting';

        const embed = VornEmbed.create()
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                // Identity
                { name: 'User Tag', value: `\`${user.tag}\``, inline: true },
                { name: 'ID', value: `\`${user.id}\``, inline: true },
                { name: 'Created', value: `<t:${createdAt}:R>`, inline: true },

                // Server Profile
                { name: 'Nickname', value: `\`${member.nickname || 'None'}\``, inline: true },
                { name: 'Joined', value: `<t:${joinedAt}:R>`, inline: true },
                { name: 'Booster', value: boostingSince, inline: true },

                // Roles
                { name: `Roles [${roleCount}]`, value: roleCount > 0 ? `${roleDisplay}${extraRoles}` : 'None', inline: false }
            );

        // Add permissions if notable
        if (keyPerms.length > 0) {
            embed.addFields({ name: 'Key Permissions', value: keyPerms.join(', '), inline: false });
        }

        // Add Mod History if exists
        if (caseCount > 0) {
            embed.addFields({ name: 'Moderation History', value: `**${caseCount}** infractions recorded`, inline: false });
        }

        // Account Status footer
        embed.setFooter({ text: user.bot ? 'Bot Account' : 'User Account' });

        // User banner
        const fetchedUser = await user.fetch().catch(() => null);
        if (fetchedUser?.bannerURL()) {
            embed.setImage(fetchedUser.bannerURL({ size: 1024 }));
        }

        await interaction.reply({ embeds: [embed] });
    }
};
