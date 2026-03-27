/**
 * Vorn — Case Management
 * View, edit, delete, and search moderation cases
 */

const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('case')
        .setDescription('Manage moderation cases')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        // --- VIEW ---
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View details of a case')
                .addIntegerOption(opt => opt.setName('id').setDescription('Case ID').setRequired(true))
        )
        // --- REASON ---
        .addSubcommand(sub =>
            sub.setName('reason')
                .setDescription('Update the reason for a case')
                .addIntegerOption(opt => opt.setName('id').setDescription('Case ID').setRequired(true))
                .addStringOption(opt => opt.setName('new_reason').setDescription('New reason').setRequired(true))
        )
        // --- DELETE ---
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a case (Admin only)')
                .addIntegerOption(opt => opt.setName('id').setDescription('Case ID').setRequired(true))
        )
        // --- SEARCH ---
        .addSubcommand(sub =>
            sub.setName('search')
                .setDescription('Search cases by user or type')
                .addUserOption(opt => opt.setName('user').setDescription('Filter by user'))
                .addUserOption(opt => opt.setName('moderator').setDescription('Filter by moderator'))
                .addStringOption(opt => opt.setName('type').setDescription('Filter by action type')
                    .addChoices(
                        { name: 'Ban', value: 'BAN' },
                        { name: 'Kick', value: 'KICK' },
                        { name: 'Timeout', value: 'TIMEOUT' },
                        { name: 'Warn', value: 'WARN' },
                        { name: 'Softban', value: 'SOFTBAN' },
                        { name: 'Tempban', value: 'TEMPBAN' },
                        { name: 'Unban', value: 'UNBAN' }
                    ))
                .addIntegerOption(opt => opt.setName('page').setDescription('Page number').setMinValue(1))
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: false });

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        // --- VIEW ---
        if (subcommand === 'view') {
            const caseId = interaction.options.getInteger('id');
            const config = await client.moderation.getConfig(guild.id);
            const caseData = config.cases.find(c => c.id === caseId);

            if (!caseData) {
                return interaction.editReply({ embeds: [VornEmbed.error(`Case #${caseId} not found.`)] });
            }

            const durationLine = caseData.duration ? `\n**Duration** ─ ${caseData.duration}` : '';
            const autoTag = caseData.auto ? ' `[AUTO]`' : '';

            const embed = VornEmbed.create()
                .setDescription([
                    `### Case #${caseData.id}${autoTag}`,
                    '',
                    `**User** ─ <@${caseData.targetId}> \`[${caseData.targetId}]\``,
                    `**Moderator** ─ <@${caseData.moderatorId}>`,
                    `**Action** ─ ${caseData.type}${durationLine}`,
                    `**Reason** ─ ${caseData.reason}`,
                    `**Date** ─ <t:${Math.floor(caseData.timestamp / 1000)}:F>`
                ].join('\n'));

            return interaction.editReply({ embeds: [embed] });
        }

        // --- REASON ---
        if (subcommand === 'reason') {
            const caseId = interaction.options.getInteger('id');
            const newReason = interaction.options.getString('new_reason');
            const config = await client.moderation.getConfig(guild.id);

            const index = config.cases.findIndex(c => c.id === caseId);
            if (index === -1) {
                return interaction.editReply({ embeds: [VornEmbed.error(`Case #${caseId} not found.`)] });
            }

            config.cases[index].reason = newReason;

            // Also update in warnings if it's a warn
            const caseData = config.cases[index];
            if (caseData.type === 'WARN' && config.warnings[caseData.targetId]) {
                const wIndex = config.warnings[caseData.targetId].findIndex(c => c.id === caseId);
                if (wIndex !== -1) {
                    config.warnings[caseData.targetId][wIndex].reason = newReason;
                }
            }

            await client.moderation.setConfig(guild.id, config);
            return interaction.editReply({ embeds: [VornEmbed.success(`Updated reason for Case #${caseId}`)] });
        }

        // --- DELETE ---
        if (subcommand === 'delete') {
            // Admin only check
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({ embeds: [VornEmbed.error('Only administrators can delete cases.')] });
            }

            const caseId = interaction.options.getInteger('id');
            const deleted = await client.moderation.deleteCase(guild.id, caseId);

            if (deleted) {
                return interaction.editReply({ embeds: [VornEmbed.success(`Deleted Case #${caseId}`)] });
            } else {
                return interaction.editReply({ embeds: [VornEmbed.error(`Case #${caseId} not found.`)] });
            }
        }

        // --- SEARCH ---
        if (subcommand === 'search') {
            const user = interaction.options.getUser('user');
            const moderator = interaction.options.getUser('moderator');
            const type = interaction.options.getString('type');
            const page = interaction.options.getInteger('page') || 1;

            const filters = {};
            if (user) filters.userId = user.id;
            if (moderator) filters.moderatorId = moderator.id;
            if (type) filters.type = type;

            const results = await client.moderation.searchCases(guild.id, filters, page);

            if (results.total === 0) {
                return interaction.editReply({ embeds: [VornEmbed.info('Case Search', 'No cases found matching filters.')] });
            }

            const lines = results.cases.map(c => {
                const autoTag = c.auto ? ' `[A]`' : '';
                const dur = c.duration ? ` (${c.duration})` : '';
                return `**#${c.id}** ${c.type}${dur}${autoTag} ─ <t:${Math.floor(c.timestamp / 1000)}:R>\n> <@${c.targetId}> by <@${c.moderatorId}> — ${c.reason.substring(0, 80)}`;
            });

            const filterDesc = [];
            if (user) filterDesc.push(`User: ${user.tag}`);
            if (moderator) filterDesc.push(`Mod: ${moderator.tag}`);
            if (type) filterDesc.push(`Type: ${type}`);

            const embed = VornEmbed.create()
                .setDescription([
                    `### Case Search`,
                    filterDesc.length > 0 ? `-# ${filterDesc.join(' · ')}` : '',
                    `-# Page ${results.page}/${results.totalPages} · ${results.total} results`,
                    '',
                    lines.join('\n\n')
                ].join('\n'));

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
