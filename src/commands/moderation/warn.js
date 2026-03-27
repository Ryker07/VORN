/**
 * Vorn — Warning System Commands
 * Add, Remove, List, Clear warnings with auto-escalation
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warning system commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        // --- ADD ---
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Warn a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true))
        )
        // --- REMOVE ---
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a specific warning by case ID')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                .addIntegerOption(opt => opt.setName('case_id').setDescription('Case ID of the warning').setRequired(true))
        )
        // --- LIST ---
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('View warnings for a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        )
        // --- CLEAR ---
        .addSubcommand(sub =>
            sub.setName('clear')
                .setDescription('Clear all warnings for a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: false });

        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user');
        const guild = interaction.guild;

        // --- ADD ---
        if (subcommand === 'add') {
            const reason = interaction.options.getString('reason');
            const moderator = interaction.user;

            const caseId = await client.moderation.createCase(guild, 'WARN', user, moderator, reason);

            // Check auto-escalation
            const escalation = await client.moderation.checkEscalation(guild, user, client.user);
            const activeWarns = await client.moderation.getActiveWarnings(guild.id, user.id);

            const lines = [`#${caseId} · Warned **${user.tag}**: ${reason}`];
            lines.push(`-# Active warnings: ${activeWarns.length}`);

            if (escalation.escalated) {
                lines.push('');
                lines.push(`⚡ **Auto-Escalation** ─ ${escalation.action} (Case #${escalation.caseId})`);
            }

            return interaction.editReply({
                embeds: [VornEmbed.success(lines.join('\n'))]
            });
        }

        // --- REMOVE ---
        if (subcommand === 'remove') {
            const caseId = interaction.options.getInteger('case_id');
            const removed = await client.moderation.removeWarning(guild.id, user.id, caseId);

            if (removed) {
                return interaction.editReply({ embeds: [VornEmbed.success(`Removed warning #${caseId} from **${user.tag}**`)] });
            } else {
                return interaction.editReply({ embeds: [VornEmbed.error(`Warning #${caseId} not found for ${user.tag}.`)] });
            }
        }

        // --- LIST ---
        if (subcommand === 'list') {
            const allWarnings = await client.moderation.getWarnings(guild.id, user.id);
            const activeWarnings = await client.moderation.getActiveWarnings(guild.id, user.id);
            const config = await client.moderation.getConfig(guild.id);
            const decayDays = config.warnDecayDays;

            if (allWarnings.length === 0) {
                return interaction.editReply({ embeds: [VornEmbed.info('Warnings', `${user.tag} has no warnings.`)] });
            }

            const activeIds = new Set(activeWarnings.map(w => w.id));

            const lines = allWarnings.map(w => {
                const isActive = activeIds.has(w.id);
                const tag = isActive ? '' : ' `[DECAYED]`';
                return `**#${w.id}**${tag} ─ <t:${Math.floor(w.timestamp / 1000)}:R>\n> ${w.reason} (by <@${w.moderatorId}>)`;
            });

            const decayLine = decayDays ? `\n-# Warn decay: ${decayDays} days` : '';

            const embed = VornEmbed.create()
                .setDescription([
                    `### Warnings for ${user.tag}`,
                    `-# ${activeWarnings.length} active / ${allWarnings.length} total${decayLine}`,
                    '',
                    lines.join('\n\n')
                ].join('\n'));

            return interaction.editReply({ embeds: [embed] });
        }

        // --- CLEAR ---
        if (subcommand === 'clear') {
            const cleared = await client.moderation.clearWarnings(guild.id, user.id);
            if (cleared) {
                return interaction.editReply({ embeds: [VornEmbed.success(`Cleared all warnings for **${user.tag}**`)] });
            } else {
                return interaction.editReply({ embeds: [VornEmbed.info('Warnings', `${user.tag} has no warnings to clear.`)] });
            }
        }
    }
};
