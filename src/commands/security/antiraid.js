/**
 * Vorn — Anti-Raid Commands
 * Full A-Z customization for raid protection
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Configure Anti-Raid protection')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // ENABLE/DISABLE
        .addSubcommand(sub => sub.setName('enable').setDescription('Enable Anti-Raid system'))
        .addSubcommand(sub => sub.setName('disable').setDescription('Disable Anti-Raid system'))
        .addSubcommand(sub => sub.setName('settings').setDescription('View current configuration'))

        // MODULE CONFIG
        .addSubcommandGroup(group => group
            .setName('module')
            .setDescription('Configure protection modules')
            .addSubcommand(sub => sub
                .setName('joinrate')
                .setDescription('Mass join detection')
                .addStringOption(opt => opt.setName('enabled').setDescription('Enable/disable').addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }))
                .addIntegerOption(opt => opt.setName('limit').setDescription('Max joins before trigger (default 10)').setMinValue(3).setMaxValue(50))
                .addIntegerOption(opt => opt.setName('time').setDescription('Time window in seconds (default 30)').setMinValue(5).setMaxValue(120))
                .addStringOption(opt => opt.setName('action').setDescription('Action to take').addChoices(
                    { name: 'Lockdown', value: 'lockdown' },
                    { name: 'Kick', value: 'kick' },
                    { name: 'Ban', value: 'ban' },
                    { name: 'Quarantine', value: 'quarantine' }
                ))
            )
            .addSubcommand(sub => sub
                .setName('accountage')
                .setDescription('New account filter')
                .addStringOption(opt => opt.setName('enabled').setDescription('Enable/disable').addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }))
                .addIntegerOption(opt => opt.setName('days').setDescription('Minimum account age in days (default 7)').setMinValue(1).setMaxValue(365))
                .addStringOption(opt => opt.setName('action').setDescription('Action to take').addChoices(
                    { name: 'Kick', value: 'kick' },
                    { name: 'Ban', value: 'ban' },
                    { name: 'Quarantine', value: 'quarantine' },
                    { name: 'Timeout', value: 'timeout' }
                ))
            )
            .addSubcommand(sub => sub
                .setName('noavatar')
                .setDescription('No avatar filter')
                .addStringOption(opt => opt.setName('enabled').setDescription('Enable/disable').addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }))
                .addStringOption(opt => opt.setName('action').setDescription('Action to take').addChoices(
                    { name: 'Kick', value: 'kick' },
                    { name: 'Ban', value: 'ban' },
                    { name: 'Quarantine', value: 'quarantine' },
                    { name: 'Timeout', value: 'timeout' }
                ))
            )
            .addSubcommand(sub => sub
                .setName('messageflood')
                .setDescription('Message spam detection')
                .addStringOption(opt => opt.setName('enabled').setDescription('Enable/disable').addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }))
                .addIntegerOption(opt => opt.setName('limit').setDescription('Max messages before trigger (default 5)').setMinValue(3).setMaxValue(20))
                .addIntegerOption(opt => opt.setName('time').setDescription('Time window in seconds (default 3)').setMinValue(1).setMaxValue(30))
                .addStringOption(opt => opt.setName('action').setDescription('Action to take').addChoices(
                    { name: 'Timeout', value: 'timeout' },
                    { name: 'Kick', value: 'kick' },
                    { name: 'Ban', value: 'ban' },
                    { name: 'Quarantine', value: 'quarantine' }
                ))
            )
            .addSubcommand(sub => sub
                .setName('mentionspam')
                .setDescription('Mass mention detection')
                .addStringOption(opt => opt.setName('enabled').setDescription('Enable/disable').addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }))
                .addIntegerOption(opt => opt.setName('limit').setDescription('Max mentions per message (default 10)').setMinValue(3).setMaxValue(50))
                .addStringOption(opt => opt.setName('action').setDescription('Action to take').addChoices(
                    { name: 'Timeout', value: 'timeout' },
                    { name: 'Kick', value: 'kick' },
                    { name: 'Ban', value: 'ban' },
                    { name: 'Quarantine', value: 'quarantine' }
                ))
            )
        )

        // LOCKDOWN
        .addSubcommandGroup(group => group
            .setName('lockdown')
            .setDescription('Lockdown controls')
            .addSubcommand(sub => sub
                .setName('start')
                .setDescription('Manually start lockdown')
                .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes (default from settings)').setMinValue(1).setMaxValue(1440))
            )
            .addSubcommand(sub => sub.setName('end').setDescription('End lockdown'))
            .addSubcommand(sub => sub
                .setName('config')
                .setDescription('Configure lockdown settings')
                .addIntegerOption(opt => opt.setName('duration').setDescription('Default duration in minutes').setMinValue(1).setMaxValue(1440))
                .addStringOption(opt => opt.setName('action').setDescription('Action on joins during lockdown').addChoices(
                    { name: 'Quarantine', value: 'quarantine' },
                    { name: 'Kick', value: 'kick' },
                    { name: 'Ban', value: 'ban' }
                ))
            )
        )

        // LOGGING
        .addSubcommandGroup(group => group
            .setName('logs')
            .setDescription('Configure logging')
            .addSubcommand(sub => sub
                .setName('channel')
                .setDescription('Set log channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Log channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
            )
            .addSubcommand(sub => sub
                .setName('alerts')
                .setDescription('Set alert role (pinged on raid)')
                .addRoleOption(opt => opt.setName('role').setDescription('Alert role').setRequired(true))
            )
            .addSubcommand(sub => sub.setName('disable').setDescription('Disable logging'))
        )

        // QUARANTINE
        .addSubcommand(sub => sub
            .setName('quarantine')
            .setDescription('Set quarantine role')
            .addRoleOption(opt => opt.setName('role').setDescription('Quarantine role').setRequired(true))
        )

        // WHITELIST
        .addSubcommandGroup(group => group
            .setName('whitelist')
            .setDescription('Manage whitelist')
            .addSubcommand(sub => sub
                .setName('add')
                .setDescription('Add user to whitelist')
                .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
            )
            .addSubcommand(sub => sub
                .setName('remove')
                .setDescription('Remove user from whitelist')
                .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
            )
            .addSubcommand(sub => sub.setName('list').setDescription('View whitelist'))
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const sub = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup();
        const guild = interaction.guild;

        // ═══════════════════════════════════════════════════════════════
        // ENABLE/DISABLE
        // ═══════════════════════════════════════════════════════════════
        if (sub === 'enable' && !group) {
            const config = await client.antiRaid.getConfig(guild.id);
            config.enabled = true;
            await client.antiRaid.setConfig(guild.id, config);
            return interaction.editReply({ embeds: [VornEmbed.success('Anti-Raid **enabled**')] });
        }

        if (sub === 'disable' && !group) {
            const config = await client.antiRaid.getConfig(guild.id);
            config.enabled = false;
            await client.antiRaid.setConfig(guild.id, config);
            return interaction.editReply({ embeds: [VornEmbed.warning('Anti-Raid **disabled**')] });
        }

        // ═══════════════════════════════════════════════════════════════
        // SETTINGS
        // ═══════════════════════════════════════════════════════════════
        if (sub === 'settings' && !group) {
            const cfg = await client.antiRaid.getConfig(guild.id);
            const m = cfg.modules;

            const status = cfg.enabled ? 'Enabled' : 'Disabled';
            const lockdownStatus = cfg.lockdown.active ? 'Active' : 'Inactive';

            const formatModule = (name, mod) => {
                const state = mod.enabled ? 'ON' : 'OFF';
                let details = [`Action: ${mod.action}`];
                if (mod.limit) details.push(`Limit: ${mod.limit}`);
                if (mod.time) details.push(`Time: ${mod.time / 1000}s`);
                if (mod.minAge) details.push(`Min Age: ${mod.minAge}d`);
                return `**${name}** — ${state}\n   ${details.join(' | ')}`;
            };

            const embed = VornEmbed.info('Anti-Raid Configuration', [
                '**Status**',
                `Protection — ${status}`,
                `Lockdown — ${lockdownStatus}`,
                '',
                '**Logging**',
                `Log Channel — ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'Not set'}`,
                `Alert Role — ${cfg.alertRoleId ? `<@&${cfg.alertRoleId}>` : 'Not set'}`,
                '',
                '**Lockdown Settings**',
                `Default Duration — ${cfg.lockdownDuration}m`,
                `Action on Join — ${cfg.lockdownAction}`,
                `Quarantine Role — ${cfg.quarantineRoleId ? `<@&${cfg.quarantineRoleId}>` : 'Auto-create'}`,
                '',
                '**Modules**',
                formatModule('Join Rate', m.join_rate),
                formatModule('Account Age', m.account_age),
                formatModule('No Avatar', m.no_avatar),
                formatModule('Message Flood', m.message_flood),
                formatModule('Mention Spam', m.mention_spam),
                '',
                `-# Whitelisted: ${cfg.whitelist.length} users`
            ].join('\n'));

            return interaction.editReply({ embeds: [embed] });
        }

        // ═══════════════════════════════════════════════════════════════
        // MODULE CONFIG
        // ═══════════════════════════════════════════════════════════════
        if (group === 'module') {
            const cfg = await client.antiRaid.getConfig(guild.id);
            const enabled = interaction.options.getString('enabled');
            const action = interaction.options.getString('action');

            let moduleName, moduleKey;

            if (sub === 'joinrate') {
                moduleKey = 'join_rate';
                moduleName = 'Join Rate';
                const limit = interaction.options.getInteger('limit');
                const time = interaction.options.getInteger('time');

                if (enabled) cfg.modules.join_rate.enabled = enabled === 'on';
                if (limit) cfg.modules.join_rate.limit = limit;
                if (time) cfg.modules.join_rate.time = time * 1000;
                if (action) cfg.modules.join_rate.action = action;
            }

            if (sub === 'accountage') {
                moduleKey = 'account_age';
                moduleName = 'Account Age';
                const days = interaction.options.getInteger('days');

                if (enabled) cfg.modules.account_age.enabled = enabled === 'on';
                if (days) cfg.modules.account_age.minAge = days;
                if (action) cfg.modules.account_age.action = action;
            }

            if (sub === 'noavatar') {
                moduleKey = 'no_avatar';
                moduleName = 'No Avatar';

                if (enabled) cfg.modules.no_avatar.enabled = enabled === 'on';
                if (action) cfg.modules.no_avatar.action = action;
            }

            if (sub === 'messageflood') {
                moduleKey = 'message_flood';
                moduleName = 'Message Flood';
                const limit = interaction.options.getInteger('limit');
                const time = interaction.options.getInteger('time');

                if (enabled) cfg.modules.message_flood.enabled = enabled === 'on';
                if (limit) cfg.modules.message_flood.limit = limit;
                if (time) cfg.modules.message_flood.time = time * 1000;
                if (action) cfg.modules.message_flood.action = action;
            }

            if (sub === 'mentionspam') {
                moduleKey = 'mention_spam';
                moduleName = 'Mention Spam';
                const limit = interaction.options.getInteger('limit');

                if (enabled) cfg.modules.mention_spam.enabled = enabled === 'on';
                if (limit) cfg.modules.mention_spam.limit = limit;
                if (action) cfg.modules.mention_spam.action = action;
            }

            await client.antiRaid.setConfig(guild.id, cfg);
            return interaction.editReply({ embeds: [VornEmbed.success(`**${moduleName}** module updated`)] });
        }

        // ═══════════════════════════════════════════════════════════════
        // LOCKDOWN
        // ═══════════════════════════════════════════════════════════════
        if (group === 'lockdown') {
            if (sub === 'start') {
                const cfg = await client.antiRaid.getConfig(guild.id);
                const duration = (interaction.options.getInteger('duration') || cfg.lockdownDuration) * 60 * 1000;
                await client.antiRaid.activateLockdown(guild, duration, `Manual (${interaction.user.tag})`);
                return interaction.editReply({ embeds: [VornEmbed.warning(`Lockdown started for **${duration / 60000}** minutes`)] });
            }

            if (sub === 'end') {
                await client.antiRaid.deactivateLockdown(guild);
                return interaction.editReply({ embeds: [VornEmbed.success('Lockdown ended')] });
            }

            if (sub === 'config') {
                const cfg = await client.antiRaid.getConfig(guild.id);
                const duration = interaction.options.getInteger('duration');
                const action = interaction.options.getString('action');

                if (duration) cfg.lockdownDuration = duration;
                if (action) cfg.lockdownAction = action;

                await client.antiRaid.setConfig(guild.id, cfg);

                const changes = [];
                if (duration) changes.push(`Duration: ${duration}m`);
                if (action) changes.push(`Join Action: ${action}`);

                return interaction.editReply({ embeds: [VornEmbed.success(`Lockdown settings updated\n${changes.join('\n')}`)] });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // LOGGING
        // ═══════════════════════════════════════════════════════════════
        if (group === 'logs') {
            const cfg = await client.antiRaid.getConfig(guild.id);

            if (sub === 'channel') {
                const channel = interaction.options.getChannel('channel');
                cfg.logChannelId = channel.id;
                await client.antiRaid.setConfig(guild.id, cfg);
                return interaction.editReply({ embeds: [VornEmbed.success(`Log channel set to ${channel}`)] });
            }

            if (sub === 'alerts') {
                const role = interaction.options.getRole('role');
                cfg.alertRoleId = role.id;
                await client.antiRaid.setConfig(guild.id, cfg);
                return interaction.editReply({ embeds: [VornEmbed.success(`Alert role set to ${role}`)] });
            }

            if (sub === 'disable') {
                cfg.logChannelId = null;
                cfg.alertRoleId = null;
                await client.antiRaid.setConfig(guild.id, cfg);
                return interaction.editReply({ embeds: [VornEmbed.success('Logging disabled')] });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // QUARANTINE
        // ═══════════════════════════════════════════════════════════════
        if (sub === 'quarantine' && !group) {
            const role = interaction.options.getRole('role');

            if (role.position >= guild.members.me.roles.highest.position) {
                return interaction.editReply({ embeds: [VornEmbed.error('Cannot use that role (hierarchy)')] });
            }

            const cfg = await client.antiRaid.getConfig(guild.id);
            cfg.quarantineRoleId = role.id;
            await client.antiRaid.setConfig(guild.id, cfg);
            return interaction.editReply({ embeds: [VornEmbed.success(`Quarantine role set to ${role}`)] });
        }

        // ═══════════════════════════════════════════════════════════════
        // WHITELIST
        // ═══════════════════════════════════════════════════════════════
        if (group === 'whitelist') {
            const cfg = await client.antiRaid.getConfig(guild.id);

            if (sub === 'add') {
                const user = interaction.options.getUser('user');
                if (!cfg.whitelist.includes(user.id)) {
                    cfg.whitelist.push(user.id);
                    await client.antiRaid.setConfig(guild.id, cfg);
                }
                return interaction.editReply({ embeds: [VornEmbed.success(`${user} added to whitelist`)] });
            }

            if (sub === 'remove') {
                const user = interaction.options.getUser('user');
                cfg.whitelist = cfg.whitelist.filter(id => id !== user.id);
                await client.antiRaid.setConfig(guild.id, cfg);
                return interaction.editReply({ embeds: [VornEmbed.success(`${user} removed from whitelist`)] });
            }

            if (sub === 'list') {
                if (cfg.whitelist.length === 0) {
                    return interaction.editReply({ embeds: [VornEmbed.info('Whitelist', 'No users whitelisted')] });
                }

                const users = cfg.whitelist.map(id => `<@${id}>`).join('\n');
                return interaction.editReply({ embeds: [VornEmbed.info('Whitelisted Users', users)] });
            }
        }
    }
};
