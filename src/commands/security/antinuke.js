/**
 * Vorn — /antinuke Command
 * Configuration for the Anti-Nuke security system
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

const ACTIONS = ['ban', 'kick', 'strip', 'quarantine'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antinuke')
        .setDescription('Configure the Anti-Nuke security system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Enable the Anti-Nuke system')
        )
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Disable the Anti-Nuke system')
        )
        .addSubcommand(sub =>
            sub.setName('settings')
                .setDescription('View current security settings')
        )
        .addSubcommand(sub =>
            sub.setName('autorecovery')
                .setDescription('Toggle auto-recovery mode')
                .addStringOption(opt =>
                    opt.setName('mode')
                        .setDescription('Enable or disable auto-recovery')
                        .setRequired(true)
                        .addChoices(
                            { name: 'on', value: 'on' },
                            { name: 'off', value: 'off' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('quarantine_role')
                .setDescription('Set the role used for quarantine punishment')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('The role to assign (leave empty to view current)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('module')
                .setDescription('Configure a protection module')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Module name')
                        .setRequired(true)
                        .addChoices(
                            { name: 'channel_create', value: 'channel_create' },
                            { name: 'channel_delete', value: 'channel_delete' },
                            { name: 'role_create', value: 'role_create' },
                            { name: 'role_delete', value: 'role_delete' },
                            { name: 'member_ban', value: 'member_ban' },
                            { name: 'member_kick', value: 'member_kick' },
                            { name: 'member_prune', value: 'member_prune' },
                            { name: 'bot_add', value: 'bot_add' },
                            { name: 'webhook_create', value: 'webhook_create' },
                            { name: 'guild_update', value: 'guild_update' }
                        )
                )
                .addIntegerOption(opt =>
                    opt.setName('limit')
                        .setDescription('Max actions allowed (0 = disable module)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(50)
                )
                .addIntegerOption(opt =>
                    opt.setName('time')
                        .setDescription('Time window in seconds')
                        .setRequired(true)
                        .setMinValue(10)
                        .setMaxValue(300)
                )
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Punishment when limit exceeded')
                        .setRequired(true)
                        .addChoices(...ACTIONS.map(a => ({ name: a, value: a })))
                )
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const config = await client.antiNuke.getConfig(guildId);

        // --- Enable ---
        if (subcommand === 'enable') {
            config.enabled = true;
            await client.antiNuke.setConfig(guildId, config);
            return interaction.editReply({
                embeds: [VornEmbed.success('Anti-Nuke system **enabled**')]
            });
        }

        // --- Disable ---
        if (subcommand === 'disable') {
            config.enabled = false;
            await client.antiNuke.setConfig(guildId, config);
            return interaction.editReply({
                embeds: [VornEmbed.warning('Anti-Nuke system **disabled**')]
            });
        }

        // --- Settings ---
        if (subcommand === 'settings') {
            const status = config.enabled ? '`Enabled`' : '`Disabled`';

            const moduleLines = Object.entries(config.modules).map(([name, mod]) => {
                if (!mod.enabled || mod.limit === 0) {
                    return `\`${name}\` ─ *disabled*`;
                }
                return `\`${name}\` ─ ${mod.limit}/${mod.time}s → ${mod.action}`;
            });

            const autoRecovery = config.autoRecovery ? '`ON`' : '`OFF`';

            const embed = VornEmbed.create()
                .setDescription([
                    '### Anti-Nuke Settings',
                    `-# Status: ${status} · Auto-Recovery: ${autoRecovery}`,
                    '',
                    '**Modules**',
                    moduleLines.join('\n'),
                    '',
                    `-# Whitelisted: ${config.whitelist.length} users`
                ].join('\n'));

            return interaction.editReply({ embeds: [embed] });
        }

        // --- Auto-Recovery ---
        if (subcommand === 'autorecovery') {
            const mode = interaction.options.getString('mode');
            config.autoRecovery = mode === 'on';

            // Create initial backup if enabling and none exists
            if (config.autoRecovery) {
                const existingBackup = await client.backupManager.getBackup(guildId);
                if (!existingBackup) {
                    await client.backupManager.createBackup(interaction.guild);
                }
            }

            await client.antiNuke.setConfig(guildId, config);

            if (config.autoRecovery) {
                return interaction.editReply({
                    embeds: [VornEmbed.success('Auto-Recovery **enabled**. Backup created.')]
                });
            } else {
                return interaction.editReply({
                    embeds: [VornEmbed.warning('Auto-Recovery **disabled**.')]
                });
            }
        }

        // --- Quarantine Role ---
        if (subcommand === 'quarantine_role') {
            const role = interaction.options.getRole('role');
            
            if (!role) {
                const currentId = config.quarantineRoleId;
                const currentRole = currentId ? interaction.guild.roles.cache.get(currentId) : null;
                const roleText = currentRole ? currentRole.toString() : '*(None configured - will auto-create)*';
                
                return interaction.editReply({
                    embeds: [VornEmbed.create().setDescription(`Current Quarantine Role: ${roleText}`)]
                });
            }

            // Safety check: ensure bot can manage this role
            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.editReply({
                    embeds: [VornEmbed.error('I cannot use that role (it is higher than or equal to my highest role).')]
                });
            }

            config.quarantineRoleId = role.id;
            await client.antiNuke.setConfig(guildId, config);

            return interaction.editReply({
                embeds: [VornEmbed.success(`Quarantine role set to ${role.toString()}`)]
            });
        }

        // --- Module Configuration ---
        if (subcommand === 'module') {
            const name = interaction.options.getString('name');
            const limit = interaction.options.getInteger('limit');
            const time = interaction.options.getInteger('time');
            const action = interaction.options.getString('action');

            if (!config.modules[name]) {
                config.modules[name] = { enabled: true, limit: 3, time: 60, action: 'ban' };
            }

            config.modules[name].limit = limit;
            config.modules[name].time = time;
            config.modules[name].action = action;
            config.modules[name].enabled = limit > 0;

            await client.antiNuke.setConfig(guildId, config);

            const statusText = limit > 0
                ? `\`${limit}\` actions in \`${time}s\` → \`${action}\``
                : '*disabled*';

            return interaction.editReply({
                embeds: [VornEmbed.success(`Module \`${name}\` updated: ${statusText}`)]
            });
        }
    }
};
