/**
 * Vorn — ModLogs Configuration
 * Set logging channel
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modlogs')
        .setDescription('Configure moderation logs')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set the moderation log channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Disable moderation logging')
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const config = await client.moderation.getConfig(guild.id);

        if (subcommand === 'set') {
            const channel = interaction.options.getChannel('channel');
            config.logChannelId = channel.id;
            await client.moderation.setConfig(guild.id, config);
            return interaction.editReply({ embeds: [VornEmbed.success(`Moderation logs set to ${channel}`)] });
        }

        if (subcommand === 'disable') {
            config.logChannelId = null;
            await client.moderation.setConfig(guild.id, config);
            return interaction.editReply({ embeds: [VornEmbed.warning('Moderation logs disabled.')] });
        }
    }
};
