/**
 * Vorn — /backup Command
 * Create and view server backups
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Manage server backups')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a new server backup (overwrites existing)')
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View current backup information')
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        // --- Create Backup ---
        if (subcommand === 'create') {
            const backup = await client.backupManager.createBackup(guild);

            const embed = VornEmbed.create()
                .setDescription([
                    '### Backup Created',
                    '',
                    `**Categories** ─ \`${backup.categories.length}\``,
                    `**Text Channels** ─ \`${backup.textChannels.length}\``,
                    `**Voice Channels** ─ \`${backup.voiceChannels.length}\``,
                    `**Roles** ─ \`${backup.roles.length}\``,
                    '',
                    `-# Created: <t:${Math.floor(backup.timestamp / 1000)}:F>`
                ].join('\n'));

            return interaction.editReply({ embeds: [embed] });
        }

        // --- View Backup ---
        if (subcommand === 'view') {
            const backup = await client.backupManager.getBackup(guild.id);

            if (!backup) {
                return interaction.editReply({
                    embeds: [VornEmbed.error('No backup exists. Use `/backup create` to create one.')]
                });
            }

            const age = Date.now() - backup.timestamp;
            const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
            const needsRefresh = client.backupManager.needsRefresh(backup);

            const embed = VornEmbed.create()
                .setDescription([
                    '### Server Backup',
                    '',
                    `**Categories** ─ \`${backup.categories.length}\``,
                    `**Text Channels** ─ \`${backup.textChannels.length}\``,
                    `**Voice Channels** ─ \`${backup.voiceChannels.length}\``,
                    `**Roles** ─ \`${backup.roles.length}\``,
                    '',
                    `-# Created: <t:${Math.floor(backup.timestamp / 1000)}:R> (${daysOld} days ago)`,
                    needsRefresh ? `-# **Backup is old** ─ Consider creating a new one` : ''
                ].filter(Boolean).join('\n'));

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
