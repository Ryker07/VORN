const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logsetup')
        .setDescription('Configure the premium audit logging system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        // --- ENABLE/DISABLE ---
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Enable or disable the entire logging system')
                .addBooleanOption(opt => opt.setName('enabled').setDescription('Turn logging on or off').setRequired(true))
        )

        // --- DEFAULT CHANNEL ---
        .addSubcommand(sub =>
            sub.setName('default_channel')
                .setDescription('Set the fallback channel for all logs if a specific one isn\'t set')
                .addChannelOption(opt => opt.setName('channel').setDescription('Log channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
        )

        // --- SPECIFIC CATEGORY CHANNEL ---
        .addSubcommand(sub =>
            sub.setName('category_channel')
                .setDescription('Set a specific channel for a certain type of log')
                .addStringOption(opt =>
                    opt.setName('category')
                        .setDescription('The log category')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Messages (Edits/Deletes)', value: 'messages' },
                            { name: 'Members (Join/Leave/Updates)', value: 'members' },
                            { name: 'Moderation (Bans/Kicks)', value: 'moderation' },
                            { name: 'Roles (Create/Edit/Delete)', value: 'roles' },
                            { name: 'Channels (Create/Edit/Delete)', value: 'channels' },
                            { name: 'Voice (Join/Move/Leave)', value: 'voice' },
                            { name: 'Server (Settings/Boosts)', value: 'server' },
                            { name: 'Invites', value: 'invites' }
                        )
                )
                .addChannelOption(opt => opt.setName('channel').setDescription('Log channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
        )

        // --- TOGGLE CATEGORY ---
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable or disable specific log categories')
                .addStringOption(opt =>
                    opt.setName('category')
                        .setDescription('The log category')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Messages (Edits/Deletes)', value: 'messages' },
                            { name: 'Members (Join/Leave/Updates)', value: 'members' },
                            { name: 'Moderation (Bans/Kicks)', value: 'moderation' },
                            { name: 'Roles (Create/Edit/Delete)', value: 'roles' },
                            { name: 'Channels (Create/Edit/Delete)', value: 'channels' },
                            { name: 'Voice (Join/Move/Leave)', value: 'voice' },
                            { name: 'Server (Settings/Boosts)', value: 'server' },
                            { name: 'Invites', value: 'invites' }
                        )
                )
                .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable this category?').setRequired(true))
        )

        // --- IGNORE RULES ---
        .addSubcommand(sub =>
            sub.setName('ignore_channel')
                .setDescription('Ignore logs from a specific channel (e.g. staff chat or spam channels)')
                .addChannelOption(opt => opt.setName('channel').setDescription('Channel to ignore').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('ignore_role')
                .setDescription('Ignore logs triggered by users with this role')
                .addRoleOption(opt => opt.setName('role').setDescription('Role to ignore').setRequired(true))
        )

        // --- VIEW SETTINGS ---
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View current logging configuration')
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        if (!client.logging) {
            return interaction.editReply({ embeds: [VornEmbed.error('Logging system is not loaded on the bot.')] });
        }

        const sub = interaction.options.getSubcommand();
        const config = await client.logging.getConfig(interaction.guild.id);

        let updated = false;
        let response = '';

        if (sub === 'status') {
            const enabled = interaction.options.getBoolean('enabled');
            config.enabled = enabled;
            updated = true;
            response = enabled ? '✅ Logging system is now **enabled**.' : '🛑 Logging system is now **disabled**.';
        }
        else if (sub === 'default_channel') {
            const channel = interaction.options.getChannel('channel');
            config.defaultChannelId = channel.id;
            updated = true;
            response = `📝 Default log channel set to ${channel}.`;
        }
        else if (sub === 'category_channel') {
            const category = interaction.options.getString('category');
            const channel = interaction.options.getChannel('channel');
            config.channels[category] = channel.id;
            // Also auto-enable the category
            config.categories[category] = true;
            updated = true;
            response = `📝 Specific channel for **${category}** set to ${channel}.`;
        }
        else if (sub === 'toggle') {
            const category = interaction.options.getString('category');
            const enabled = interaction.options.getBoolean('enabled');
            config.categories[category] = enabled;
            updated = true;
            response = `⚙️ Category **${category}** is now ${enabled ? '**enabled**' : '**disabled**'}.`;
        }
        else if (sub === 'ignore_channel') {
            const channel = interaction.options.getChannel('channel');
            const idx = config.ignoredChannels.indexOf(channel.id);
            if (idx > -1) {
                config.ignoredChannels.splice(idx, 1);
                response = `👀 Channel ${channel} is no longer ignored.`;
            } else {
                config.ignoredChannels.push(channel.id);
                response = `🙈 Channel ${channel} is now ignored from logging.`;
            }
            updated = true;
        }
        else if (sub === 'ignore_role') {
            const role = interaction.options.getRole('role');
            const idx = config.ignoredRoles.indexOf(role.id);
            if (idx > -1) {
                config.ignoredRoles.splice(idx, 1);
                response = `👀 Role ${role} is no longer ignored.`;
            } else {
                config.ignoredRoles.push(role.id);
                response = `🙈 Role ${role} is now ignored from logging.`;
            }
            updated = true;
        }
        else if (sub === 'view') {
            const embed = VornEmbed.create()
                .setTitle('⚙️ Logging Configuration')
                .setDescription(`**Status:** ${config.enabled ? '🟢 Enabled' : '🔴 Disabled'}
                **Default Channel:** ${config.defaultChannelId ? `<#${config.defaultChannelId}>` : 'Not Set'}`)
                .addFields(
                    {
                        name: '📁 Categories',
                        value: Object.keys(config.categories).slice(0, 8).map(c =>
                            `${config.categories[c] ? '🟢' : '🔴'} **${c}**: ${config.channels[c] ? `<#${config.channels[c]}>` : '*(Default)*'}`
                        ).join('\n'),
                        inline: false
                    },
                    {
                        name: '🙈 Ignored Channels',
                        value: config.ignoredChannels.length > 0 ? config.ignoredChannels.map(c => `<#${c}>`).join(', ') : 'None',
                        inline: true
                    },
                    {
                        name: '🛡️ Ignored Roles',
                        value: config.ignoredRoles.length > 0 ? config.ignoredRoles.map(r => `<@&${r}>`).join(', ') : 'None',
                        inline: true
                    }
                );

            return interaction.editReply({ embeds: [embed] });
        }

        if (updated) {
            await client.logging.setConfig(interaction.guild.id, config);
            return interaction.editReply({ embeds: [VornEmbed.success(response)] });
        }
    }
};
