/**
 * Vorn — Enterprise Ticket System
 * Full featured with all customization options
 */

const {
    SlashCommandBuilder, PermissionFlagsBits, ChannelType,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder
} = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Enterprise ticket system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)

        // SETUP
        .addSubcommand(sub => sub.setName('setup').setDescription('Quick setup guide'))

        // PANEL GROUP
        .addSubcommandGroup(group => group
            .setName('panel')
            .setDescription('Manage ticket panels')
            .addSubcommand(sub => sub
                .setName('create')
                .setDescription('Create a ticket panel')
                .addStringOption(opt => opt.setName('title').setDescription('Panel title').setRequired(true))
                .addStringOption(opt => opt.setName('type').setDescription('Panel type').setRequired(true)
                    .addChoices({ name: 'Button', value: 'BUTTON' }, { name: 'Select Menu', value: 'SELECT' }))
                .addStringOption(opt => opt.setName('description').setDescription('Panel description'))
                .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post in').addChannelTypes(ChannelType.GuildText))
                .addChannelOption(opt => opt.setName('category').setDescription('Category for tickets').addChannelTypes(ChannelType.GuildCategory))
                .addRoleOption(opt => opt.setName('role').setDescription('Staff role to ping'))
            )
            .addSubcommand(sub => sub
                .setName('delete')
                .setDescription('Delete a ticket panel')
                .addStringOption(opt => opt.setName('message_id').setDescription('Panel message ID').setRequired(true))
            )
            .addSubcommand(sub => sub.setName('list').setDescription('List all panels'))
        )

        // OPTION GROUP
        .addSubcommandGroup(group => group
            .setName('option')
            .setDescription('Manage select menu options')
            .addSubcommand(sub => sub
                .setName('add')
                .setDescription('Add option to select menu')
                .addStringOption(opt => opt.setName('panel_id').setDescription('Panel message ID').setRequired(true))
                .addStringOption(opt => opt.setName('label').setDescription('Option label').setRequired(true))
                .addStringOption(opt => opt.setName('description').setDescription('Option description'))
                .addChannelOption(opt => opt.setName('category').setDescription('Ticket category').addChannelTypes(ChannelType.GuildCategory))
                .addRoleOption(opt => opt.setName('role').setDescription('Staff role'))
            )
            .addSubcommand(sub => sub
                .setName('remove')
                .setDescription('Remove option from select menu')
                .addStringOption(opt => opt.setName('panel_id').setDescription('Panel message ID').setRequired(true))
                .addStringOption(opt => opt.setName('label').setDescription('Option label').setRequired(true))
            )
        )

        // SETTINGS GROUP
        .addSubcommandGroup(group => group
            .setName('settings')
            .setDescription('Configure ticket settings')
            .addSubcommand(sub => sub
                .setName('logs')
                .setDescription('Set log channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Log channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
            )
            .addSubcommand(sub => sub
                .setName('transcripts')
                .setDescription('Set transcript channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Transcript channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
            )
            .addSubcommand(sub => sub
                .setName('staff')
                .setDescription('Set default staff role')
                .addRoleOption(opt => opt.setName('role').setDescription('Staff role').setRequired(true))
            )
            .addSubcommand(sub => sub
                .setName('autoclose')
                .setDescription('Configure auto-close')
                .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable auto-close').setRequired(true))
                .addIntegerOption(opt => opt.setName('hours').setDescription('Hours before close (default 48)').setMinValue(1).setMaxValue(168))
                .addIntegerOption(opt => opt.setName('warn_hours').setDescription('Hours before warning (default 24)').setMinValue(1).setMaxValue(72))
            )
            .addSubcommand(sub => sub
                .setName('feedback')
                .setDescription('Toggle feedback DMs')
                .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable feedback').setRequired(true))
            )
            .addSubcommand(sub => sub
                .setName('naming')
                .setDescription('Set channel naming format')
                .addStringOption(opt => opt.setName('format').setDescription('Format ({id}, {user}, {type})').setRequired(true))
            )
            .addSubcommand(sub => sub.setName('view').setDescription('View all settings'))
        )

        // CANNED RESPONSES GROUP
        .addSubcommandGroup(group => group
            .setName('canned')
            .setDescription('Manage canned responses')
            .addSubcommand(sub => sub
                .setName('add')
                .setDescription('Add a canned response')
                .addStringOption(opt => opt.setName('name').setDescription('Short name (e.g. greeting)').setRequired(true))
                .addStringOption(opt => opt.setName('content').setDescription('Response content').setRequired(true))
            )
            .addSubcommand(sub => sub
                .setName('remove')
                .setDescription('Remove a canned response')
                .addStringOption(opt => opt.setName('name').setDescription('Response name').setRequired(true))
            )
            .addSubcommand(sub => sub.setName('list').setDescription('List all canned responses'))
            .addSubcommand(sub => sub
                .setName('use')
                .setDescription('Send a canned response in this channel')
                .addStringOption(opt => opt.setName('name').setDescription('Response name').setRequired(true))
            )
        )

        // BLACKLIST GROUP
        .addSubcommandGroup(group => group
            .setName('blacklist')
            .setDescription('Manage ticket blacklist')
            .addSubcommand(sub => sub
                .setName('add')
                .setDescription('Blacklist a user from creating tickets')
                .addUserOption(opt => opt.setName('user').setDescription('User to blacklist').setRequired(true))
            )
            .addSubcommand(sub => sub
                .setName('remove')
                .setDescription('Remove a user from the blacklist')
                .addUserOption(opt => opt.setName('user').setDescription('User to unblacklist').setRequired(true))
            )
            .addSubcommand(sub => sub.setName('list').setDescription('List all blacklisted users'))
        )

        // STATS & LIST
        .addSubcommand(sub => sub.setName('stats').setDescription('View ticket statistics'))
        .addSubcommand(sub => sub.setName('list').setDescription('List active tickets'))
        .addSubcommand(sub => sub
            .setName('sla')
            .setDescription('Configure or check SLA settings')
            .addIntegerOption(opt => opt.setName('first_response').setDescription('First response SLA in minutes').setMinValue(1))
            .addIntegerOption(opt => opt.setName('resolve').setDescription('Resolution SLA in minutes').setMinValue(1))
            .addBooleanOption(opt => opt.setName('check').setDescription('Check current SLA violations'))
        )
        .addSubcommand(sub => sub
            .setName('closereason')
            .setDescription('Manage predefined close reasons')
            .addStringOption(opt => opt.setName('add').setDescription('Add a close reason'))
            .addStringOption(opt => opt.setName('remove').setDescription('Remove a close reason'))
            .addBooleanOption(opt => opt.setName('stats').setDescription('Show close reason analytics'))
        )
        .addSubcommand(sub => sub.setName('performance').setDescription('View staff performance dashboard'))

        // IN-TICKET COMMANDS
        .addSubcommand(sub => sub.setName('claim').setDescription('Claim this ticket'))
        .addSubcommand(sub => sub.setName('unclaim').setDescription('Unclaim this ticket'))
        .addSubcommand(sub => sub
            .setName('close')
            .setDescription('Close this ticket')
            .addStringOption(opt => opt.setName('reason').setDescription('Close reason'))
        )
        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Add user to ticket')
            .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Remove user from ticket')
            .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('priority')
            .setDescription('Set ticket priority')
            .addStringOption(opt => opt.setName('level').setDescription('Priority level').setRequired(true)
                .addChoices(
                    { name: 'Low', value: 'low' },
                    { name: 'Normal', value: 'normal' },
                    { name: 'High', value: 'high' },
                    { name: 'Urgent', value: 'urgent' }
                ))
        )
        .addSubcommand(sub => sub
            .setName('rename')
            .setDescription('Rename this ticket')
            .addStringOption(opt => opt.setName('name').setDescription('New name').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('transfer')
            .setDescription('Transfer ticket ownership')
            .addUserOption(opt => opt.setName('user').setDescription('New owner').setRequired(true))
        ),

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup();
        const guild = interaction.guild;
        const channel = interaction.channel;

        // ═══════════════════════════════════════════════════════════════
        // SETUP
        // ═══════════════════════════════════════════════════════════════
        if (sub === 'setup' && !group) {
            return interaction.reply({
                embeds: [VornEmbed.info('Ticket Setup', [
                    '**Step 1** — Create a panel',
                    '`/ticket panel create title:"Support" type:Button`',
                    '',
                    '**Step 2** — Set log channel',
                    '`/ticket settings logs #ticket-logs`',
                    '',
                    '**Step 3** — Set transcript channel',
                    '`/ticket settings transcripts #transcripts`',
                    '',
                    '**Step 4** — Set staff role',
                    '`/ticket settings staff @Staff`',
                    '',
                    '**Optional** — Enable auto-close',
                    '`/ticket settings autoclose enabled:true hours:48`'
                ].join('\n'))],
                ephemeral: true
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // PANEL GROUP
        // ═══════════════════════════════════════════════════════════════
        if (group === 'panel') {
            await interaction.deferReply({ ephemeral: true });

            if (sub === 'create') {
                const title = interaction.options.getString('title');
                const type = interaction.options.getString('type');
                const description = interaction.options.getString('description') || 'Click below to open a ticket.';
                const targetChannel = interaction.options.getChannel('channel') || channel;
                const category = interaction.options.getChannel('category');
                const role = interaction.options.getRole('role');

                const embed = VornEmbed.create().setTitle(title).setDescription(description);
                const customId = `tpanel_${Date.now()}`;
                let components = [];

                if (type === 'BUTTON') {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`${customId}_btn`).setLabel('Open Ticket').setStyle(ButtonStyle.Primary)
                    ));
                } else {
                    components.push(new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`${customId}_sel`)
                            .setPlaceholder('Select a category...')
                            .addOptions({ label: 'General Support', value: 'support', description: 'General inquiries' })
                    ));
                }

                const msg = await targetChannel.send({ embeds: [embed], components });

                await client.ticketManager.addPanel(guild.id, {
                    id: msg.id,
                    channelId: targetChannel.id,
                    type,
                    customId,
                    categoryId: category?.id || null,
                    roleId: role?.id || null,
                    options: type === 'SELECT' ? [{ label: 'General Support', value: 'support', description: 'General inquiries' }] : []
                });

                return interaction.editReply({ embeds: [VornEmbed.success(`Panel created in ${targetChannel}`)] });
            }

            if (sub === 'delete') {
                const msgId = interaction.options.getString('message_id');
                const config = await client.ticketManager.getConfig(guild.id);
                const panel = config.panels.find(p => p.id === msgId);

                if (!panel) return interaction.editReply({ embeds: [VornEmbed.error('Panel not found')] });

                try {
                    const ch = await guild.channels.fetch(panel.channelId);
                    const msg = await ch.messages.fetch(msgId);
                    await msg.delete();
                } catch (e) { }

                await client.ticketManager.removePanel(guild.id, msgId);
                return interaction.editReply({ embeds: [VornEmbed.success('Panel deleted')] });
            }

            if (sub === 'list') {
                const config = await client.ticketManager.getConfig(guild.id);
                if (!config.panels.length) {
                    return interaction.editReply({ embeds: [VornEmbed.info('Panels', 'No panels. Use `/ticket panel create`')] });
                }

                const lines = config.panels.map((p, i) => `**${i + 1}.** ${p.type} in <#${p.channelId}>\n   ID: \`${p.id}\``);
                return interaction.editReply({ embeds: [VornEmbed.info('Ticket Panels', lines.join('\n\n'))] });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // OPTION GROUP
        // ═══════════════════════════════════════════════════════════════
        if (group === 'option') {
            await interaction.deferReply({ ephemeral: true });

            if (sub === 'add') {
                const panelId = interaction.options.getString('panel_id');
                const label = interaction.options.getString('label');
                const description = interaction.options.getString('description') || label;
                const category = interaction.options.getChannel('category');
                const role = interaction.options.getRole('role');

                const config = await client.ticketManager.getConfig(guild.id);
                const panelIdx = config.panels.findIndex(p => p.id === panelId);

                if (panelIdx === -1) return interaction.editReply({ embeds: [VornEmbed.error('Panel not found')] });

                const panel = config.panels[panelIdx];
                if (panel.type !== 'SELECT') return interaction.editReply({ embeds: [VornEmbed.error('Not a select menu panel')] });

                const value = label.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now();

                if (panel.options.length === 1 && panel.options[0].value === 'support') {
                    panel.options = [];
                }

                panel.options.push({ label, value, description, categoryId: category?.id, roleId: role?.id });
                config.panels[panelIdx] = panel;
                await client.ticketManager.setConfig(guild.id, config);

                try {
                    const ch = await guild.channels.fetch(panel.channelId);
                    const msg = await ch.messages.fetch(panelId);
                    const select = new StringSelectMenuBuilder()
                        .setCustomId(`${panel.customId}_sel`)
                        .setPlaceholder('Select a category...')
                        .addOptions(panel.options.map(o => ({ label: o.label, value: o.value, description: o.description })));
                    await msg.edit({ components: [new ActionRowBuilder().addComponents(select)] });
                } catch (e) { }

                return interaction.editReply({ embeds: [VornEmbed.success(`Added option "${label}"`)] });
            }

            if (sub === 'remove') {
                const panelId = interaction.options.getString('panel_id');
                const label = interaction.options.getString('label');

                const config = await client.ticketManager.getConfig(guild.id);
                const panelIdx = config.panels.findIndex(p => p.id === panelId);

                if (panelIdx === -1) return interaction.editReply({ embeds: [VornEmbed.error('Panel not found')] });

                const panel = config.panels[panelIdx];
                const optIdx = panel.options.findIndex(o => o.label.toLowerCase() === label.toLowerCase());

                if (optIdx === -1) return interaction.editReply({ embeds: [VornEmbed.error('Option not found')] });

                panel.options.splice(optIdx, 1);
                if (panel.options.length === 0) {
                    panel.options.push({ label: 'General Support', value: 'support', description: 'General inquiries' });
                }

                config.panels[panelIdx] = panel;
                await client.ticketManager.setConfig(guild.id, config);

                try {
                    const ch = await guild.channels.fetch(panel.channelId);
                    const msg = await ch.messages.fetch(panelId);
                    const select = new StringSelectMenuBuilder()
                        .setCustomId(`${panel.customId}_sel`)
                        .setPlaceholder('Select a category...')
                        .addOptions(panel.options.map(o => ({ label: o.label, value: o.value, description: o.description })));
                    await msg.edit({ components: [new ActionRowBuilder().addComponents(select)] });
                } catch (e) { }

                return interaction.editReply({ embeds: [VornEmbed.success(`Removed option "${label}"`)] });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // SETTINGS GROUP
        // ═══════════════════════════════════════════════════════════════
        if (group === 'settings') {
            await interaction.deferReply({ ephemeral: true });

            if (sub === 'logs') {
                const ch = interaction.options.getChannel('channel');
                await client.ticketManager.updateSettings(guild.id, { logChannelId: ch.id });
                return interaction.editReply({ embeds: [VornEmbed.success(`Log channel set to ${ch}`)] });
            }

            if (sub === 'transcripts') {
                const ch = interaction.options.getChannel('channel');
                await client.ticketManager.updateSettings(guild.id, { transcriptChannelId: ch.id });
                return interaction.editReply({ embeds: [VornEmbed.success(`Transcript channel set to ${ch}`)] });
            }

            if (sub === 'staff') {
                const role = interaction.options.getRole('role');
                await client.ticketManager.updateSettings(guild.id, { defaultStaffRoleId: role.id });
                return interaction.editReply({ embeds: [VornEmbed.success(`Staff role set to ${role}`)] });
            }

            if (sub === 'autoclose') {
                const enabled = interaction.options.getBoolean('enabled');
                const hours = interaction.options.getInteger('hours') || 48;
                const warnHours = interaction.options.getInteger('warn_hours') || 24;

                await client.ticketManager.updateSettings(guild.id, {
                    autoClose: { enabled, inactiveHours: hours, warnHours }
                });

                if (enabled) {
                    return interaction.editReply({ embeds: [VornEmbed.success(`Auto-close enabled (${hours}h, warning at ${warnHours}h)`)] });
                }
                return interaction.editReply({ embeds: [VornEmbed.success('Auto-close disabled')] });
            }

            if (sub === 'feedback') {
                const enabled = interaction.options.getBoolean('enabled');
                await client.ticketManager.updateSettings(guild.id, { feedbackEnabled: enabled });
                return interaction.editReply({ embeds: [VornEmbed.success(`Feedback ${enabled ? 'enabled' : 'disabled'}`)] });
            }

            if (sub === 'naming') {
                const format = interaction.options.getString('format');
                await client.ticketManager.updateSettings(guild.id, { namingFormat: format });
                return interaction.editReply({ embeds: [VornEmbed.success(`Naming format: \`${format}\``)] });
            }

            if (sub === 'view') {
                const cfg = await client.ticketManager.getConfig(guild.id);
                return interaction.editReply({
                    embeds: [VornEmbed.info('Ticket Settings', [
                        `**Log Channel** — ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'Not set'}`,
                        `**Transcripts** — ${cfg.transcriptChannelId ? `<#${cfg.transcriptChannelId}>` : 'Not set'}`,
                        `**Staff Role** — ${cfg.defaultStaffRoleId ? `<@&${cfg.defaultStaffRoleId}>` : 'Not set'}`,
                        `**Naming** — \`${cfg.namingFormat}\``,
                        `**Feedback** — ${cfg.feedbackEnabled ? 'Enabled' : 'Disabled'}`,
                        '',
                        '**Auto-Close**',
                        `Status — ${cfg.autoClose.enabled ? 'Enabled' : 'Disabled'}`,
                        `Inactive — ${cfg.autoClose.inactiveHours}h`,
                        `Warning — ${cfg.autoClose.warnHours}h`
                    ].join('\n'))]
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // STATS & LIST
        // ═══════════════════════════════════════════════════════════════
        if (sub === 'stats' && !group) {
            await interaction.deferReply({ ephemeral: true });
            const stats = await client.ticketManager.getStats(guild.id);

            return interaction.editReply({
                embeds: [VornEmbed.info('Ticket Statistics', [
                    `**Total Opened** — ${stats.totalOpened}`,
                    `**Total Closed** — ${stats.totalClosed}`,
                    `**Active** — ${stats.activeTickets}`,
                    `**Unclaimed** — ${stats.unclaimedTickets}`,
                    `**Avg Response** — ${stats.avgResponseTimeFormatted}`,
                    '',
                    '**By Priority**',
                    `Low: ${stats.priorityCounts.low} | Normal: ${stats.priorityCounts.normal} | High: ${stats.priorityCounts.high} | Urgent: ${stats.priorityCounts.urgent}`
                ].join('\n'))]
            });
        }

        if (sub === 'list' && !group) {
            await interaction.deferReply({ ephemeral: true });
            const config = await client.ticketManager.getConfig(guild.id);
            const tickets = Object.entries(config.activeTickets);

            if (!tickets.length) {
                return interaction.editReply({ embeds: [VornEmbed.info('Active Tickets', 'No active tickets')] });
            }

            const lines = tickets.slice(0, 15).map(([chId, t]) => {
                const p = t.priority === 'high' || t.priority === 'urgent' ? `[${t.priority.toUpperCase()}] ` : '';
                return `${p}**#${t.id}** <#${chId}>\n   Owner: <@${t.ownerId}> | ${t.claimedBy ? `<@${t.claimedBy}>` : 'Unclaimed'}`;
            });

            if (tickets.length > 15) lines.push(`\n-# ...and ${tickets.length - 15} more`);

            return interaction.editReply({ embeds: [VornEmbed.info('Active Tickets', lines.join('\n\n'))] });
        }

        // ═══════════════════════════════════════════════════════════════
        // IN-TICKET COMMANDS
        // ═══════════════════════════════════════════════════════════════
        const ticketActions = ['claim', 'unclaim', 'close', 'add', 'remove', 'priority', 'rename', 'transfer'];

        if (ticketActions.includes(sub) && !group) {
            const isTicket = await client.ticketManager.isTicket(channel.id, guild.id);
            if (!isTicket) {
                return interaction.reply({ embeds: [VornEmbed.error('Use this inside a ticket channel')], ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            if (sub === 'claim') {
                const result = await client.ticketManager.claimTicket(channel, interaction.member);
                if (!result.success) return interaction.editReply({ embeds: [VornEmbed.error(result.error)] });
                await channel.send({ embeds: [VornEmbed.success(`Claimed by ${interaction.user}`)] });
                return interaction.editReply({ embeds: [VornEmbed.success('Ticket claimed')] });
            }

            if (sub === 'unclaim') {
                const config = await client.ticketManager.getConfig(guild.id);
                const ticket = config.activeTickets[channel.id];
                if (!ticket?.claimedBy) return interaction.editReply({ embeds: [VornEmbed.error('Not claimed')] });
                ticket.claimedBy = null;
                config.activeTickets[channel.id] = ticket;
                await client.ticketManager.setConfig(guild.id, config);
                await channel.send({ embeds: [VornEmbed.warning('Ticket unclaimed')] });
                return interaction.editReply({ embeds: [VornEmbed.success('Unclaimed')] });
            }

            if (sub === 'close') {
                const reason = interaction.options.getString('reason') || 'No reason';
                await interaction.editReply({ embeds: [VornEmbed.warning('Closing in 5 seconds...')] });
                setTimeout(async () => {
                    await client.ticketManager.closeTicket(channel, interaction.user, reason);
                    await channel.delete().catch(() => { });
                }, 5000);
                return;
            }

            if (sub === 'add') {
                const user = interaction.options.getUser('user');
                const result = await client.ticketManager.addUser(channel, user);
                if (!result.success) return interaction.editReply({ embeds: [VornEmbed.error(result.error)] });
                await channel.send({ embeds: [VornEmbed.success(`${user} added`)] });
                return interaction.editReply({ embeds: [VornEmbed.success('User added')] });
            }

            if (sub === 'remove') {
                const user = interaction.options.getUser('user');
                const result = await client.ticketManager.removeUser(channel, user);
                if (!result.success) return interaction.editReply({ embeds: [VornEmbed.error(result.error)] });
                await channel.send({ embeds: [VornEmbed.warning(`${user} removed`)] });
                return interaction.editReply({ embeds: [VornEmbed.success('User removed')] });
            }

            if (sub === 'priority') {
                const level = interaction.options.getString('level');
                const result = await client.ticketManager.setPriority(channel, level);
                if (!result.success) return interaction.editReply({ embeds: [VornEmbed.error(result.error)] });
                await channel.send({ embeds: [VornEmbed.info('Priority', `Set to **${level}**`)] });
                return interaction.editReply({ embeds: [VornEmbed.success(`Priority: ${level}`)] });
            }

            if (sub === 'rename') {
                const name = interaction.options.getString('name');
                await client.ticketManager.renameTicket(channel, name);
                return interaction.editReply({ embeds: [VornEmbed.success(`Renamed to ${name}`)] });
            }

            if (sub === 'transfer') {
                const user = interaction.options.getUser('user');
                const result = await client.ticketManager.transferOwnership(channel, user);
                if (!result.success) return interaction.editReply({ embeds: [VornEmbed.error(result.error)] });
                await channel.send({ embeds: [VornEmbed.info('Transfer', `Transferred to ${user}`)] });
                return interaction.editReply({ embeds: [VornEmbed.success('Transferred')] });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // CANNED RESPONSES
        // ═══════════════════════════════════════════════════════════════
        if (group === 'canned') {
            await interaction.deferReply({ ephemeral: true });

            if (sub === 'add') {
                const name = interaction.options.getString('name');
                const content = interaction.options.getString('content');
                await client.ticketManager.addCannedResponse(guild.id, name, content, interaction.user.id);
                return interaction.editReply({ embeds: [VornEmbed.success(`Canned response **${name}** added`)] });
            }

            if (sub === 'remove') {
                const name = interaction.options.getString('name');
                const removed = await client.ticketManager.removeCannedResponse(guild.id, name);
                if (!removed) return interaction.editReply({ embeds: [VornEmbed.error('Response not found')] });
                return interaction.editReply({ embeds: [VornEmbed.success(`Removed **${name}**`)] });
            }

            if (sub === 'list') {
                const responses = await client.ticketManager.getCannedResponses(guild.id);
                if (!responses.length) return interaction.editReply({ embeds: [VornEmbed.info('Canned Responses', 'None configured')] });
                const lines = responses.map(r => `**${r.name}** — ${r.content.substring(0, 80)}${r.content.length > 80 ? '...' : ''}`);
                return interaction.editReply({ embeds: [VornEmbed.info('Canned Responses', lines.join('\n'))] });
            }

            if (sub === 'use') {
                const name = interaction.options.getString('name');
                const result = await client.ticketManager.useCannedResponse(channel, name);
                if (!result.success) return interaction.editReply({ embeds: [VornEmbed.error(result.error)] });
                return interaction.editReply({ embeds: [VornEmbed.success(`Sent **${name}** response`)] });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // BLACKLIST
        // ═══════════════════════════════════════════════════════════════
        if (group === 'blacklist') {
            await interaction.deferReply({ ephemeral: true });

            if (sub === 'add') {
                const user = interaction.options.getUser('user');
                const added = await client.ticketManager.addToBlacklist(guild.id, user.id);
                if (!added) return interaction.editReply({ embeds: [VornEmbed.error('Already blacklisted')] });
                return interaction.editReply({ embeds: [VornEmbed.success(`${user} blacklisted from tickets`)] });
            }

            if (sub === 'remove') {
                const user = interaction.options.getUser('user');
                const removed = await client.ticketManager.removeFromBlacklist(guild.id, user.id);
                if (!removed) return interaction.editReply({ embeds: [VornEmbed.error('Not blacklisted')] });
                return interaction.editReply({ embeds: [VornEmbed.success(`${user} removed from blacklist`)] });
            }

            if (sub === 'list') {
                const config = await client.ticketManager.getConfig(guild.id);
                const users = config.blacklistedUsers;
                if (!users.length) return interaction.editReply({ embeds: [VornEmbed.info('Blacklist', 'No blacklisted users')] });
                const lines = users.map(id => `<@${id}>`);
                return interaction.editReply({ embeds: [VornEmbed.info('Blacklisted Users', lines.join('\n'))] });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // SLA
        // ═══════════════════════════════════════════════════════════════
        if (sub === 'sla' && !group) {
            await interaction.deferReply({ ephemeral: true });

            const firstResponse = interaction.options.getInteger('first_response');
            const resolve = interaction.options.getInteger('resolve');
            const checkViolations = interaction.options.getBoolean('check');

            // Configure SLA
            if (firstResponse || resolve) {
                const updates = {};
                if (firstResponse) updates['sla.firstResponseMinutes'] = firstResponse;
                if (resolve) updates['sla.resolveMinutes'] = resolve;
                const config = await client.ticketManager.getConfig(guild.id);
                if (firstResponse) config.sla.firstResponseMinutes = firstResponse;
                if (resolve) config.sla.resolveMinutes = resolve;
                await client.ticketManager.setConfig(guild.id, config);

                const lines = [];
                if (firstResponse) lines.push(`First response SLA → **${firstResponse}** minutes`);
                if (resolve) lines.push(`Resolution SLA → **${resolve}** minutes`);
                return interaction.editReply({ embeds: [VornEmbed.success(lines.join('\n'))] });
            }

            // Check violations
            if (checkViolations) {
                const violations = await client.ticketManager.checkSLAViolations(guild.id);
                if (!violations.length) {
                    return interaction.editReply({ embeds: [VornEmbed.success('✅ No SLA violations')] });
                }

                const lines = violations.map(v => {
                    const type = v.type === 'FIRST_RESPONSE' ? '🔴 First Response' : '🟠 Resolution';
                    return `${type} — Ticket **#${v.ticketId}** <#${v.channelId}>\n   ${v.elapsed}min / ${v.sla}min SLA`;
                });

                return interaction.editReply({ embeds: [VornEmbed.warning(`**${violations.length}** SLA Violations\n\n${lines.join('\n\n')}`)] });
            }

            // Show current SLA config
            const config = await client.ticketManager.getConfig(guild.id);
            return interaction.editReply({
                embeds: [VornEmbed.info('SLA Settings', [
                    `**First Response** — ${config.sla.firstResponseMinutes ? config.sla.firstResponseMinutes + ' min' : 'Not set'}`,
                    `**Resolution** — ${config.sla.resolveMinutes ? config.sla.resolveMinutes + ' min' : 'Not set'}`
                ].join('\n'))]
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // CLOSE REASONS
        // ═══════════════════════════════════════════════════════════════
        if (sub === 'closereason' && !group) {
            await interaction.deferReply({ ephemeral: true });

            const addReason = interaction.options.getString('add');
            const removeReason = interaction.options.getString('remove');
            const showStats = interaction.options.getBoolean('stats');

            if (addReason) {
                const added = await client.ticketManager.addCloseReason(guild.id, addReason);
                if (!added) return interaction.editReply({ embeds: [VornEmbed.error('Already exists')] });
                return interaction.editReply({ embeds: [VornEmbed.success(`Added close reason: **${addReason}**`)] });
            }

            if (removeReason) {
                const removed = await client.ticketManager.removeCloseReason(guild.id, removeReason);
                if (!removed) return interaction.editReply({ embeds: [VornEmbed.error('Not found')] });
                return interaction.editReply({ embeds: [VornEmbed.success(`Removed: **${removeReason}**`)] });
            }

            if (showStats) {
                const stats = await client.ticketManager.getCloseReasonStats(guild.id);
                const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
                if (!entries.length) return interaction.editReply({ embeds: [VornEmbed.info('Close Reason Analytics', 'No data yet')] });
                const lines = entries.map(([reason, count]) => `**${reason}** — ${count} times`);
                return interaction.editReply({ embeds: [VornEmbed.info('Close Reason Analytics', lines.join('\n'))] });
            }

            // List close reasons
            const config = await client.ticketManager.getConfig(guild.id);
            if (!config.closeReasons.length) {
                return interaction.editReply({ embeds: [VornEmbed.info('Close Reasons', 'None configured. Use `/ticket closereason add:"Resolved"`')] });
            }
            return interaction.editReply({ embeds: [VornEmbed.info('Close Reasons', config.closeReasons.map(r => `• ${r}`).join('\n'))] });
        }

        // ═══════════════════════════════════════════════════════════════
        // PERFORMANCE
        // ═══════════════════════════════════════════════════════════════
        if (sub === 'performance' && !group) {
            await interaction.deferReply({ ephemeral: true });

            const performance = await client.ticketManager.getStaffPerformance(guild.id);
            if (!performance.length) {
                return interaction.editReply({ embeds: [VornEmbed.info('Staff Performance', 'No data yet')] });
            }

            const lines = performance.slice(0, 10).map((p, i) => [
                `**${i + 1}.** <@${p.staffId}>`,
                `   Closed: **${p.ticketsClosed}** · Avg Resolve: **${p.avgResolveFormatted}** · Rating: **${p.avgRating}** ⭐ (${p.totalRatings} reviews)`
            ].join('\n'));

            return interaction.editReply({
                embeds: [VornEmbed.info('Staff Performance Dashboard', lines.join('\n\n'))]
            });
        }
    }
};
