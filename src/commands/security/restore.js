/**
 * Vorn — /restore Command
 * Restore server from backup
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restore')
        .setDescription('Restore server from backup')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('preview')
                .setDescription('Preview what will be restored (no changes made)')
        )
        .addSubcommand(sub =>
            sub.setName('confirm')
                .setDescription('Actually restore missing items from backup')
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        const backup = await client.backupManager.getBackup(guild.id);

        if (!backup) {
            return interaction.editReply({
                embeds: [VornEmbed.error('No backup exists. Use `/backup create` first.')]
            });
        }

        const missing = await client.backupManager.compareMissing(guild, backup);
        const totalMissing =
            missing.roles.length +
            missing.categories.length +
            missing.textChannels.length +
            missing.voiceChannels.length;

        // --- Preview ---
        if (subcommand === 'preview') {
            if (totalMissing === 0) {
                return interaction.editReply({
                    embeds: [VornEmbed.success('Server matches backup. Nothing to restore.')]
                });
            }

            const lines = ['### Restore Preview', '', 'The following items are missing:'];

            if (missing.roles.length > 0) {
                lines.push(`\n**Roles** (\`${missing.roles.length}\`)`);
                missing.roles.slice(0, 10).forEach(r => lines.push(`> ${r.name}`));
                if (missing.roles.length > 10) lines.push(`> ... and ${missing.roles.length - 10} more`);
            }

            if (missing.categories.length > 0) {
                lines.push(`\n**Categories** (\`${missing.categories.length}\`)`);
                missing.categories.slice(0, 10).forEach(c => lines.push(`> ${c.name}`));
                if (missing.categories.length > 10) lines.push(`> ... and ${missing.categories.length - 10} more`);
            }

            if (missing.textChannels.length > 0) {
                lines.push(`\n**Text Channels** (\`${missing.textChannels.length}\`)`);
                missing.textChannels.slice(0, 10).forEach(c => lines.push(`> #${c.name}`));
                if (missing.textChannels.length > 10) lines.push(`> ... and ${missing.textChannels.length - 10} more`);
            }

            if (missing.voiceChannels.length > 0) {
                lines.push(`\n**Voice Channels** (\`${missing.voiceChannels.length}\`)`);
                missing.voiceChannels.slice(0, 10).forEach(c => lines.push(`> ${c.name}`));
                if (missing.voiceChannels.length > 10) lines.push(`> ... and ${missing.voiceChannels.length - 10} more`);
            }

            lines.push('', '-# Use `/restore confirm` to restore these items');

            const embed = VornEmbed.create().setDescription(lines.join('\n'));
            return interaction.editReply({ embeds: [embed] });
        }

        // --- Confirm ---
        if (subcommand === 'confirm') {
            if (totalMissing === 0) {
                return interaction.editReply({
                    embeds: [VornEmbed.success('Server matches backup. Nothing to restore.')]
                });
            }

            await interaction.editReply({
                embeds: [VornEmbed.info('Restoring...', `Restoring \`${totalMissing}\` items. This may take a moment.`)]
            });

            const results = await client.backupManager.restoreMissing(guild, missing, backup);

            const successCount =
                results.roles.success +
                results.categories.success +
                results.textChannels.success +
                results.voiceChannels.success;

            const failedCount =
                results.roles.failed +
                results.categories.failed +
                results.textChannels.failed +
                results.voiceChannels.failed;

            const lines = ['### Restore Complete', ''];

            if (results.roles.success > 0 || results.roles.failed > 0) {
                lines.push(`**Roles** ─ \`${results.roles.success}\` restored, \`${results.roles.failed}\` failed`);
            }
            if (results.categories.success > 0 || results.categories.failed > 0) {
                lines.push(`**Categories** ─ \`${results.categories.success}\` restored, \`${results.categories.failed}\` failed`);
            }
            if (results.textChannels.success > 0 || results.textChannels.failed > 0) {
                lines.push(`**Text Channels** ─ \`${results.textChannels.success}\` restored, \`${results.textChannels.failed}\` failed`);
            }
            if (results.voiceChannels.success > 0 || results.voiceChannels.failed > 0) {
                lines.push(`**Voice Channels** ─ \`${results.voiceChannels.success}\` restored, \`${results.voiceChannels.failed}\` failed`);
            }

            lines.push('', `-# Total: \`${successCount}\` success, \`${failedCount}\` failed`);

            const embed = VornEmbed.create().setDescription(lines.join('\n'));
            return interaction.followUp({ embeds: [embed], ephemeral: true });
        }
    }
};
