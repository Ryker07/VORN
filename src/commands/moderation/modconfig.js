/**
 * Vorn — Moderation Config
 * Configure auto-escalation, warn decay, and DM settings
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modconfig')
        .setDescription('Configure moderation settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // --- ESCALATION ---
        .addSubcommandGroup(group => group
            .setName('escalation')
            .setDescription('Auto-punishment escalation')
            .addSubcommand(sub => sub
                .setName('set')
                .setDescription('Set a warn threshold action')
                .addIntegerOption(opt => opt.setName('warns').setDescription('Number of warnings to trigger').setRequired(true).setMinValue(2).setMaxValue(50))
                .addStringOption(opt => opt.setName('action').setDescription('Action: timeout:1h, timeout:1d, kick, ban').setRequired(true))
            )
            .addSubcommand(sub => sub
                .setName('remove')
                .setDescription('Remove a threshold')
                .addIntegerOption(opt => opt.setName('warns').setDescription('Warn count threshold to remove').setRequired(true))
            )
            .addSubcommand(sub => sub
                .setName('toggle')
                .setDescription('Enable or disable auto-escalation')
                .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable escalation').setRequired(true))
            )
            .addSubcommand(sub => sub.setName('view').setDescription('View all escalation thresholds'))
        )

        // --- DECAY ---
        .addSubcommandGroup(group => group
            .setName('decay')
            .setDescription('Warning decay settings')
            .addSubcommand(sub => sub
                .setName('set')
                .setDescription('Set warn decay period')
                .addIntegerOption(opt => opt.setName('days').setDescription('Days until warns expire').setRequired(true).setMinValue(1).setMaxValue(365))
            )
            .addSubcommand(sub => sub.setName('disable').setDescription('Disable warn decay'))
            .addSubcommand(sub => sub.setName('view').setDescription('View current decay setting'))
        )

        // --- DM ---
        .addSubcommand(sub => sub
            .setName('dm')
            .setDescription('Toggle DM notifications on moderation actions')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable DM notifications').setRequired(true))
        )

        // --- VIEW ALL ---
        .addSubcommand(sub => sub.setName('view').setDescription('View all moderation settings'))

        // --- STATS ---
        .addSubcommand(sub => sub
            .setName('stats')
            .setDescription('View moderation statistics')
            .addUserOption(opt => opt.setName('moderator').setDescription('Filter by specific moderator'))
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const sub = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup();
        const guild = interaction.guild;
        const config = await client.moderation.getConfig(guild.id);

        // ═══════════════════ ESCALATION ═══════════════════
        if (group === 'escalation') {
            if (sub === 'set') {
                const warns = interaction.options.getInteger('warns');
                const action = interaction.options.getString('action').toLowerCase();

                // Validate action format
                const validActions = ['ban', 'kick'];
                const timeoutMatch = action.match(/^timeout:(\d+[smhd])$/);

                if (!validActions.includes(action) && !timeoutMatch) {
                    return interaction.editReply({
                        embeds: [VornEmbed.error('Invalid action. Use: `ban`, `kick`, `timeout:1h`, `timeout:1d`, etc.')]
                    });
                }

                const formatted = timeoutMatch ? `TIMEOUT:${timeoutMatch[1]}` : action.toUpperCase();
                config.escalation.thresholds[warns.toString()] = formatted;
                await client.moderation.setConfig(guild.id, config);

                return interaction.editReply({
                    embeds: [VornEmbed.success(`**${warns}** warnings → **${formatted}**`)]
                });
            }

            if (sub === 'remove') {
                const warns = interaction.options.getInteger('warns');
                const key = warns.toString();

                if (!config.escalation.thresholds[key]) {
                    return interaction.editReply({ embeds: [VornEmbed.error(`No threshold at ${warns} warnings.`)] });
                }

                delete config.escalation.thresholds[key];
                await client.moderation.setConfig(guild.id, config);

                return interaction.editReply({ embeds: [VornEmbed.success(`Removed threshold at **${warns}** warnings`)] });
            }

            if (sub === 'toggle') {
                const enabled = interaction.options.getBoolean('enabled');
                config.escalation.enabled = enabled;
                await client.moderation.setConfig(guild.id, config);

                return interaction.editReply({
                    embeds: [VornEmbed.success(`Auto-escalation **${enabled ? 'enabled' : 'disabled'}**`)]
                });
            }

            if (sub === 'view') {
                const entries = Object.entries(config.escalation.thresholds)
                    .sort((a, b) => Number(a[0]) - Number(b[0]));

                const lines = entries.length > 0
                    ? entries.map(([warns, action]) => `**${warns}** warns → \`${action}\``)
                    : ['No thresholds configured'];

                return interaction.editReply({
                    embeds: [VornEmbed.info('Auto-Escalation', [
                        `**Status** ─ ${config.escalation.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
                        '',
                        ...lines
                    ].join('\n'))]
                });
            }
        }

        // ═══════════════════ DECAY ═══════════════════
        if (group === 'decay') {
            if (sub === 'set') {
                const days = interaction.options.getInteger('days');
                config.warnDecayDays = days;
                await client.moderation.setConfig(guild.id, config);

                return interaction.editReply({
                    embeds: [VornEmbed.success(`Warns now decay after **${days}** days`)]
                });
            }

            if (sub === 'disable') {
                config.warnDecayDays = null;
                await client.moderation.setConfig(guild.id, config);

                return interaction.editReply({
                    embeds: [VornEmbed.success('Warn decay **disabled** — warnings never expire')]
                });
            }

            if (sub === 'view') {
                const status = config.warnDecayDays
                    ? `Warns decay after **${config.warnDecayDays}** days`
                    : 'Warn decay is **disabled** — warnings never expire';

                return interaction.editReply({
                    embeds: [VornEmbed.info('Warn Decay', status)]
                });
            }
        }

        // ═══════════════════ DM ═══════════════════
        if (sub === 'dm' && !group) {
            const enabled = interaction.options.getBoolean('enabled');
            config.dmOnAction = enabled;
            await client.moderation.setConfig(guild.id, config);

            return interaction.editReply({
                embeds: [VornEmbed.success(`DM notifications **${enabled ? 'enabled' : 'disabled'}**`)]
            });
        }

        // ═══════════════════ VIEW ALL ═══════════════════
        if (sub === 'view' && !group) {
            const thresh = Object.entries(config.escalation.thresholds)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([w, a]) => `${w} warns → \`${a}\``).join(', ') || 'None';

            return interaction.editReply({
                embeds: [VornEmbed.info('Moderation Config', [
                    `**Log Channel** ─ ${config.logChannelId ? `<#${config.logChannelId}>` : 'Not set'}`,
                    `**DM on Action** ─ ${config.dmOnAction ? '🟢 Enabled' : '🔴 Disabled'}`,
                    '',
                    '**Auto-Escalation**',
                    `Status ─ ${config.escalation.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
                    `Thresholds ─ ${thresh}`,
                    '',
                    '**Warn Decay**',
                    config.warnDecayDays ? `Expires after ─ **${config.warnDecayDays}** days` : 'Disabled ─ warnings never expire'
                ].join('\n'))]
            });
        }

        // ═══════════════════ STATS ═══════════════════
        if (sub === 'stats' && !group) {
            const moderator = interaction.options.getUser('moderator');
            const stats = await client.moderation.getModStats(guild.id, moderator?.id);

            const lines = [
                `**Total Actions** ─ ${stats.total}`,
                `**Last 7 Days** ─ ${stats.last7Days}`,
                `**Last 30 Days** ─ ${stats.last30Days}`,
                ''
            ];

            // By type
            const typeLines = Object.entries(stats.byType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => `${type}: **${count}**`);
            if (typeLines.length > 0) {
                lines.push('**By Action**');
                lines.push(typeLines.join(' · '));
                lines.push('');
            }

            // Top moderators (only show if not filtered)
            if (!moderator && stats.topModerators.length > 0) {
                lines.push('**Top Moderators**');
                stats.topModerators.slice(0, 5).forEach((m, i) => {
                    lines.push(`${i + 1}. <@${m.id}> — **${m.count}** actions`);
                });
            }

            const title = moderator ? `Stats for ${moderator.tag}` : 'Moderation Statistics';

            return interaction.editReply({
                embeds: [VornEmbed.info(title, lines.join('\n'))]
            });
        }
    }
};
