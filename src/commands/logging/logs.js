/**
 * Vorn — /logs Command
 * Configure the full audit logging system
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Configure the audit logging system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Enable the logging system')
        )
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Disable the logging system')
        )
        .addSubcommand(sub =>
            sub.setName('channel')
                .setDescription('Set a log channel (default or per-category)')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('The channel to send logs to')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('category')
                        .setDescription('Specific category (leave empty for default)')
                        .addChoices(
                            { name: 'All (Default)', value: 'default' },
                            { name: 'Messages', value: 'messages' },
                            { name: 'Members', value: 'members' },
                            { name: 'Moderation', value: 'moderation' },
                            { name: 'Roles', value: 'roles' },
                            { name: 'Channels', value: 'channels' },
                            { name: 'Voice', value: 'voice' },
                            { name: 'Server', value: 'server' },
                            { name: 'Invites', value: 'invites' },
                            { name: 'Threads', value: 'threads' },
                            { name: 'Emojis', value: 'emojis' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable or disable a log category')
                .addStringOption(opt =>
                    opt.setName('category')
                        .setDescription('The category to toggle')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Messages', value: 'messages' },
                            { name: 'Members', value: 'members' },
                            { name: 'Moderation', value: 'moderation' },
                            { name: 'Roles', value: 'roles' },
                            { name: 'Channels', value: 'channels' },
                            { name: 'Voice', value: 'voice' },
                            { name: 'Server', value: 'server' },
                            { name: 'Invites', value: 'invites' },
                            { name: 'Threads', value: 'threads' },
                            { name: 'Emojis', value: 'emojis' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('ignore')
                .setDescription('Ignore a channel, role, or user from logging')
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Add or remove from ignore list')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Add', value: 'add' },
                            { name: 'Remove', value: 'remove' }
                        )
                )
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel to ignore')
                )
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Role to ignore')
                )
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User to ignore')
                )
        )
        .addSubcommand(sub =>
            sub.setName('settings')
                .setDescription('Configure logging options')
                .addBooleanOption(opt =>
                    opt.setName('log_bots')
                        .setDescription('Log bot actions')
                )
                .addBooleanOption(opt =>
                    opt.setName('show_moderator')
                        .setDescription('Show who performed mod actions (uses audit log)')
                )
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('View current logging configuration')
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        if (!client.logging) {
            return interaction.editReply({ embeds: [VornEmbed.error('Logging system not initialized.')] });
        }

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const config = await client.logging.getConfig(guild.id);

        switch (subcommand) {
            case 'enable': {
                config.enabled = true;
                await client.logging.setConfig(guild.id, config);
                return interaction.editReply({ embeds: [VornEmbed.success('Logging system **enabled**.')] });
            }

            case 'disable': {
                config.enabled = false;
                await client.logging.setConfig(guild.id, config);
                return interaction.editReply({ embeds: [VornEmbed.success('Logging system **disabled**.')] });
            }

            case 'channel': {
                const channel = interaction.options.getChannel('channel');
                const category = interaction.options.getString('category') || 'default';

                if (category === 'default') {
                    config.defaultChannelId = channel.id;
                } else {
                    if (!config.channels) config.channels = {};
                    config.channels[category] = channel.id;
                }

                await client.logging.setConfig(guild.id, config);

                const label = category === 'default' ? 'Default' : client.logging.CATEGORIES[category]?.label || category;
                return interaction.editReply({ embeds: [VornEmbed.success(`**${label}** logs set to ${channel}`)] });
            }

            case 'toggle': {
                const category = interaction.options.getString('category');
                config.categories[category] = !config.categories[category];
                await client.logging.setConfig(guild.id, config);

                const state = config.categories[category] ? 'enabled' : 'disabled';
                const label = client.logging.CATEGORIES[category]?.label || category;
                return interaction.editReply({ embeds: [VornEmbed.success(`**${label}** logging ${state}.`)] });
            }

            case 'ignore': {
                const action = interaction.options.getString('action');
                const channel = interaction.options.getChannel('channel');
                const role = interaction.options.getRole('role');
                const user = interaction.options.getUser('user');

                if (!channel && !role && !user) {
                    return interaction.editReply({ embeds: [VornEmbed.error('Specify a channel, role, or user.')] });
                }

                const targets = [];

                if (channel) {
                    if (action === 'add') {
                        if (!config.ignoredChannels.includes(channel.id)) {
                            config.ignoredChannels.push(channel.id);
                            targets.push(`${channel}`);
                        }
                    } else {
                        config.ignoredChannels = config.ignoredChannels.filter(id => id !== channel.id);
                        targets.push(`${channel}`);
                    }
                }

                if (role) {
                    if (action === 'add') {
                        if (!config.ignoredRoles.includes(role.id)) {
                            config.ignoredRoles.push(role.id);
                            targets.push(`${role}`);
                        }
                    } else {
                        config.ignoredRoles = config.ignoredRoles.filter(id => id !== role.id);
                        targets.push(`${role}`);
                    }
                }

                if (user) {
                    if (action === 'add') {
                        if (!config.ignoredUsers.includes(user.id)) {
                            config.ignoredUsers.push(user.id);
                            targets.push(`${user}`);
                        }
                    } else {
                        config.ignoredUsers = config.ignoredUsers.filter(id => id !== user.id);
                        targets.push(`${user}`);
                    }
                }

                await client.logging.setConfig(guild.id, config);

                const verb = action === 'add' ? 'added to' : 'removed from';
                return interaction.editReply({ embeds: [VornEmbed.success(`${targets.join(', ')} ${verb} ignore list.`)] });
            }

            case 'settings': {
                const logBots = interaction.options.getBoolean('log_bots');
                const showMod = interaction.options.getBoolean('show_moderator');

                const updates = [];

                if (logBots !== null) {
                    config.logBots = logBots;
                    updates.push(`**Log Bots** ─ ${logBots ? 'Yes' : 'No'}`);
                }

                if (showMod !== null) {
                    config.showAuditLogActor = showMod;
                    updates.push(`**Show Moderator** ─ ${showMod ? 'Yes' : 'No'}`);
                }

                if (updates.length === 0) {
                    return interaction.editReply({ embeds: [VornEmbed.error('No settings specified.')] });
                }

                await client.logging.setConfig(guild.id, config);
                return interaction.editReply({ embeds: [VornEmbed.success(`Updated:\n${updates.join('\n')}`)] });
            }

            case 'status': {
                const check = '\u2713';
                const cross = '\u2717';

                const categoryLines = Object.entries(client.logging.CATEGORIES).map(([key, meta]) => {
                    const enabled = config.categories[key];
                    const channelId = config.channels[key] || config.defaultChannelId;
                    const channelStr = channelId ? `<#${channelId}>` : '*No channel*';
                    return `${enabled ? check : cross} **${meta.label}** ─ ${channelStr}`;
                });

                const embed = VornEmbed.create()
                    .setTitle('Logging Configuration')
                    .setDescription([
                        `**System** ─ ${config.enabled ? 'Enabled' : 'Disabled'}`,
                        `**Default Channel** ─ ${config.defaultChannelId ? `<#${config.defaultChannelId}>` : 'Not set'}`,
                        `**Log Bots** ─ ${config.logBots ? 'Yes' : 'No'}`,
                        `**Show Moderator** ─ ${config.showAuditLogActor ? 'Yes' : 'No'}`,
                        '',
                        '**Categories**',
                        ...categoryLines,
                        '',
                        `**Ignored Channels** ─ ${config.ignoredChannels.length}`,
                        `**Ignored Roles** ─ ${config.ignoredRoles.length}`,
                        `**Ignored Users** ─ ${config.ignoredUsers.length}`
                    ].join('\n'));

                return interaction.editReply({ embeds: [embed] });
            }
        }
    }
};
