/**
 * Vorn — User History
 * Paginated view of all moderation cases for a user
 */

const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('View full moderation history for a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('page').setDescription('Page number').setMinValue(1)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: false });

        const user = interaction.options.getUser('user');
        const page = interaction.options.getInteger('page') || 1;
        const guild = interaction.guild;

        const results = await client.moderation.searchCases(guild.id, { userId: user.id }, page, 8);
        const activeWarnings = await client.moderation.getActiveWarnings(guild.id, user.id);
        const allWarnings = await client.moderation.getWarnings(guild.id, user.id);

        if (results.total === 0) {
            return interaction.editReply({
                embeds: [VornEmbed.info('History', `${user.tag} has a clean record.`)]
            });
        }

        // Build summary line
        const summary = {};
        const allCases = (await client.moderation.searchCases(guild.id, { userId: user.id }, 1, 999)).cases;
        for (const c of allCases) {
            summary[c.type] = (summary[c.type] || 0) + 1;
        }

        const summaryLine = Object.entries(summary)
            .map(([type, count]) => `${type}: **${count}**`)
            .join(' · ');

        const warnSummary = allWarnings.length > 0
            ? `${activeWarnings.length} active / ${allWarnings.length} total warns`
            : 'No warnings';

        // Case lines
        const lines = results.cases.map(c => {
            const autoTag = c.auto ? ' `[A]`' : '';
            const dur = c.duration ? ` (${c.duration})` : '';
            return `**#${c.id}** ${c.type}${dur}${autoTag} ─ <t:${Math.floor(c.timestamp / 1000)}:R>\n> ${c.reason.substring(0, 100)} *(by <@${c.moderatorId}>)*`;
        });

        const embed = VornEmbed.create()
            .setDescription([
                `### History — ${user.tag}`,
                `-# ${summaryLine}`,
                `-# ${warnSummary}`,
                `-# Page ${results.page}/${results.totalPages}`,
                '',
                lines.join('\n\n')
            ].join('\n'));

        const components = [];
        if (results.totalPages > 1) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`history_prev_${user.id}_${results.page}`)
                    .setLabel('◀ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(results.page <= 1),
                new ButtonBuilder()
                    .setCustomId(`history_page_${user.id}`)
                    .setLabel(`${results.page}/${results.totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`history_next_${user.id}_${results.page}`)
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(results.page >= results.totalPages)
            );
            components.push(row);
        }

        const reply = await interaction.editReply({ embeds: [embed], components });

        // Button collector for pagination
        if (results.totalPages > 1) {
            const collector = reply.createMessageComponentCollector({ time: 120000 });

            collector.on('collect', async (btn) => {
                if (btn.user.id !== interaction.user.id) {
                    return btn.reply({ content: 'Only the command user can navigate.', ephemeral: true });
                }

                await btn.deferUpdate();

                let newPage = results.page;
                if (btn.customId.startsWith('history_prev_')) newPage = Math.max(1, results.page - 1);
                if (btn.customId.startsWith('history_next_')) newPage = Math.min(results.totalPages, results.page + 1);

                const newResults = await client.moderation.searchCases(guild.id, { userId: user.id }, newPage, 8);

                const newLines = newResults.cases.map(c => {
                    const autoTag = c.auto ? ' `[A]`' : '';
                    const dur = c.duration ? ` (${c.duration})` : '';
                    return `**#${c.id}** ${c.type}${dur}${autoTag} ─ <t:${Math.floor(c.timestamp / 1000)}:R>\n> ${c.reason.substring(0, 100)} *(by <@${c.moderatorId}>)*`;
                });

                const newEmbed = VornEmbed.create()
                    .setDescription([
                        `### History — ${user.tag}`,
                        `-# ${summaryLine}`,
                        `-# ${warnSummary}`,
                        `-# Page ${newResults.page}/${newResults.totalPages}`,
                        '',
                        newLines.join('\n\n')
                    ].join('\n'));

                const newRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`history_prev_${user.id}_${newResults.page}`)
                        .setLabel('◀ Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(newResults.page <= 1),
                    new ButtonBuilder()
                        .setCustomId(`history_page_${user.id}`)
                        .setLabel(`${newResults.page}/${newResults.totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`history_next_${user.id}_${newResults.page}`)
                        .setLabel('Next ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(newResults.page >= newResults.totalPages)
                );

                await btn.editReply({ embeds: [newEmbed], components: [newRow] });
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => { });
            });
        }
    }
};
