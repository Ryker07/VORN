/**
 * Vorn — /slowmode Command
 * Quick channel slowmode management
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

const PRESETS = [
    { name: 'Off', value: '0' },
    { name: '5 seconds', value: '5' },
    { name: '10 seconds', value: '10' },
    { name: '30 seconds', value: '30' },
    { name: '1 minute', value: '60' },
    { name: '5 minutes', value: '300' },
    { name: '10 minutes', value: '600' },
    { name: '30 minutes', value: '1800' },
    { name: '1 hour', value: '3600' },
    { name: '6 hours', value: '21600' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set channel slowmode')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(opt =>
            opt.setName('duration')
                .setDescription('Slowmode duration')
                .setRequired(true)
                .addChoices(...PRESETS)
        )
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('Target channel (default: current)')
        ),

    async execute(interaction, client) {
        const seconds = parseInt(interaction.options.getString('duration'));
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        try {
            await channel.setRateLimitPerUser(seconds);

            const label = seconds === 0
                ? 'Slowmode disabled'
                : `Slowmode set to **${formatDuration(seconds)}**`;

            const target = channel.id === interaction.channel.id
                ? ''
                : ` in ${channel}`;

            await interaction.reply({
                embeds: [VornEmbed.success(`${label}${target}`)]
            });

            // Log to modlogs if configured
            try {
                const config = await client.moderation.getConfig(interaction.guild.id);
                if (config.logChannelId) {
                    const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
                    if (logChannel?.isTextBased()) {
                        const embed = VornEmbed.create()
                            .setDescription([
                                `### Slowmode Updated`,
                                '',
                                `**Channel** ─ ${channel}`,
                                `**Duration** ─ ${seconds === 0 ? 'Disabled' : formatDuration(seconds)}`,
                                `**Moderator** ─ ${interaction.user}`,
                                '',
                                `-# <t:${Math.floor(Date.now() / 1000)}:R>`
                            ].join('\n'));
                        logChannel.send({ embeds: [embed] }).catch(() => { });
                    }
                }
            } catch { }

        } catch (error) {
            await interaction.reply({
                embeds: [VornEmbed.error(`Failed to set slowmode: ${error.message}`)],
                ephemeral: true
            });
        }
    }
};

function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
}
