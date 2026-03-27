/**
 * Vorn — Welcome System
 * Simplified, powerful welcome configuration through interactive dashboard
 */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

// Theme definitions
const THEMES = [
    { value: 'embed', label: 'Text Only', description: 'Simple embed message' },
    { value: 'obsidian', label: 'Obsidian', description: 'Dark minimal' },
    { value: 'aurora', label: 'Aurora', description: 'Purple gradient' },
    { value: 'ocean', label: 'Ocean', description: 'Teal wave' },
    { value: 'neon', label: 'Neon', description: 'Cyberpunk glow' },
    { value: 'discord', label: 'Discord', description: 'Native look' },
    { value: 'midnight', label: 'Midnight', description: 'Deep blue' },
    { value: 'sunset', label: 'Sunset', description: 'Warm orange' },
    { value: 'rose', label: 'Rose', description: 'Pink accent' }
];

const AVATAR_SHAPES = [
    { value: 'circle', label: 'Circle' },
    { value: 'rounded', label: 'Rounded' },
    { value: 'square', label: 'Square' },
    { value: 'hexagon', label: 'Hexagon' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configure the welcome system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Quick setup - set channel and enable')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Welcome channel')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('config')
                .setDescription('Open the interactive configuration panel')
        )
        .addSubcommand(sub =>
            sub.setName('test')
                .setDescription('Send a test welcome message')
        ),

    async execute(interaction, client) {
        if (!client.welcome) {
            return interaction.reply({
                embeds: [VornEmbed.error('Welcome system not initialized.')],
                ephemeral: true
            });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'setup') {
            return handleSetup(interaction, client);
        }

        if (sub === 'test') {
            return handleTest(interaction, client);
        }

        if (sub === 'config') {
            return handleConfig(interaction, client);
        }
    }
};

// Quick setup
async function handleSetup(interaction, client) {
    const channel = interaction.options.getChannel('channel');

    await client.welcome.updateConfig(interaction.guild.id, 'channelId', channel.id);
    await client.welcome.updateConfig(interaction.guild.id, 'enabled', true);
    await client.welcome.updateConfig(interaction.guild.id, 'canvas.enabled', true);
    await client.welcome.updateConfig(interaction.guild.id, 'canvas.template', 'obsidian');

    const embed = VornEmbed.success('Welcome System Enabled')
        .setDescription([
            `Channel: ${channel}`,
            `Theme: **Obsidian**`,
            '',
            'Use `/welcome config` to customize further.'
        ].join('\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Test message
async function handleTest(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const config = await client.welcome.getConfig(interaction.guild.id);

    if (!config.channelId) {
        return interaction.editReply({
            embeds: [VornEmbed.error('No channel set. Use `/welcome setup` first.')]
        });
    }

    try {
        const channel = await interaction.guild.channels.fetch(config.channelId);
        await client.welcome.sendTest(interaction.member, channel);
        await interaction.editReply({
            embeds: [VornEmbed.success(`Test sent to ${channel}`)]
        });
    } catch (error) {
        await interaction.editReply({
            embeds: [VornEmbed.error(`Failed: ${error.message}`)]
        });
    }
}

// Main interactive config panel
async function handleConfig(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    let currentTab = 'main';

    // Build the main embed based on current tab
    const buildEmbed = async () => {
        const cfg = await client.welcome.getConfig(interaction.guild.id);

        if (currentTab === 'main') {
            const status = cfg.enabled ? 'Enabled' : 'Disabled';
            const channel = cfg.channelId ? `<#${cfg.channelId}>` : 'Not set';
            const theme = cfg.canvas?.enabled ? cfg.canvas.template : 'Text only';
            const avatar = cfg.canvas?.avatarStyle || 'circle';

            return VornEmbed.create()
                .setTitle('Welcome Configuration')
                .setDescription([
                    '```',
                    `Status      ${status}`,
                    `Channel     ${cfg.channelId ? '#' + (await interaction.guild.channels.fetch(cfg.channelId).catch(() => ({ name: 'unknown' }))).name : 'Not set'}`,
                    `Theme       ${theme}`,
                    `Avatar      ${avatar}`,
                    '```',
                    '',
                    '-# Use the buttons below to configure each section'
                ].join('\n'));
        }

        if (currentTab === 'style') {
            const theme = cfg.canvas?.enabled ? cfg.canvas.template : 'embed';
            const avatar = cfg.canvas?.avatarStyle || 'circle';
            const accent = cfg.canvas?.accentColor || 'Default';
            const bg = cfg.canvas?.background ? 'Custom' : 'None';

            return VornEmbed.create()
                .setTitle('Style Settings')
                .setDescription([
                    '```',
                    `Theme       ${theme}`,
                    `Avatar      ${avatar}`,
                    `Accent      ${accent}`,
                    `Background  ${bg}`,
                    '```',
                    '',
                    '-# Select a theme and avatar shape below'
                ].join('\n'));
        }

        if (currentTab === 'message') {
            const content = cfg.message?.content || 'None';
            const embedEnabled = cfg.message?.embed?.enabled ? 'Yes' : 'No';
            const title = cfg.message?.embed?.title || 'None';
            const desc = cfg.message?.embed?.description || 'Welcome {user}';

            return VornEmbed.create()
                .setTitle('Message Settings')
                .setDescription([
                    '**Text Content**',
                    content === 'None' ? '-# No text content set' : `\`${content.substring(0, 50)}${content.length > 50 ? '...' : ''}\``,
                    '',
                    '**Embed**',
                    `Enabled: ${embedEnabled}`,
                    title !== 'None' ? `Title: ${title}` : '',
                    `Description: \`${desc.substring(0, 50)}${desc.length > 50 ? '...' : ''}\``,
                    '',
                    '**Placeholders**',
                    '`{user}` `{user.name}` `{memberCount}` `{server}` `{inviter}`'
                ].filter(Boolean).join('\n'));
        }

        if (currentTab === 'features') {
            const goodbye = cfg.goodbye?.enabled ? 'On' : 'Off';
            const invites = cfg.invites?.enabled ? 'On' : 'Off';
            const milestones = cfg.milestones?.enabled ? 'On' : 'Off';
            const dm = cfg.dm?.enabled ? 'On' : 'Off';
            const autorole = cfg.autoroles?.length ? `<@&${cfg.autoroles[0]}>` : 'None';
            const ping = cfg.pingUser ? 'On' : 'Off';
            const deleteOnLeave = cfg.deleteOnLeave ? 'On' : 'Off';
            const showCount = cfg.canvas?.showMemberCount !== false ? 'On' : 'Off';

            return VornEmbed.create()
                .setTitle('Features')
                .setDescription([
                    '```',
                    `Goodbye Messages    ${goodbye}`,
                    `Invite Tracking     ${invites}`,
                    `Milestones          ${milestones}`,
                    `DM Welcome          ${dm}`,
                    `Ping User           ${ping}`,
                    `Delete on Leave     ${deleteOnLeave}`,
                    `Show Member Count   ${showCount}`,
                    '```',
                    '',
                    autorole !== 'None' ? `**Auto Role:** ${autorole}` : '',
                    '',
                    '-# Toggle features using the buttons below'
                ].filter(Boolean).join('\n'));
        }

        if (currentTab === 'goodbye') {
            const enabled = cfg.goodbye?.enabled ? 'Enabled' : 'Disabled';
            const channel = cfg.goodbye?.channelId ? `<#${cfg.goodbye.channelId}>` : 'Same as welcome';
            const msg = cfg.goodbye?.embed?.description || '{user.name} left the server';

            return VornEmbed.create()
                .setTitle('Goodbye Settings')
                .setDescription([
                    '```',
                    `Status      ${enabled}`,
                    '```',
                    '',
                    `**Channel:** ${channel}`,
                    `**Message:** \`${msg.substring(0, 60)}${msg.length > 60 ? '...' : ''}\``,
                    '',
                    '-# Goodbye messages are sent when members leave'
                ].join('\n'));
        }

        return VornEmbed.create().setTitle('Welcome Configuration');
    };

    // Build components based on current tab
    const buildComponents = async () => {
        const cfg = await client.welcome.getConfig(interaction.guild.id);
        const rows = [];

        if (currentTab === 'main') {
            // Row 1: Main toggles
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('wcfg_toggle')
                    .setLabel(cfg.enabled ? 'Enabled' : 'Disabled')
                    .setStyle(cfg.enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('wcfg_test')
                    .setLabel('Test')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('wcfg_reset')
                    .setLabel('Reset')
                    .setStyle(ButtonStyle.Danger)
            ));

            // Row 2: Tab navigation
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('wcfg_tab_style')
                    .setLabel('Style')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('wcfg_tab_message')
                    .setLabel('Message')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('wcfg_tab_features')
                    .setLabel('Features')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('wcfg_tab_goodbye')
                    .setLabel('Goodbye')
                    .setStyle(ButtonStyle.Primary)
            ));

            // Row 3: Channel selector
            rows.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('wcfg_channel')
                    .setPlaceholder('Select welcome channel...')
                    .setChannelTypes(ChannelType.GuildText)
            ));
        }

        if (currentTab === 'style') {
            // Row 1: Back button
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('wcfg_back')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('wcfg_colors')
                    .setLabel('Custom Colors')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('wcfg_background')
                    .setLabel('Background')
                    .setStyle(ButtonStyle.Primary)
            ));

            // Row 2: Theme selector
            rows.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('wcfg_theme')
                    .setPlaceholder('Choose theme...')
                    .addOptions(THEMES.map(t => ({
                        label: t.label,
                        description: t.description,
                        value: t.value,
                        default: (cfg.canvas?.enabled ? cfg.canvas.template : 'embed') === t.value
                    })))
            ));

            // Row 3: Avatar shape
            rows.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('wcfg_avatar')
                    .setPlaceholder('Avatar shape...')
                    .addOptions(AVATAR_SHAPES.map(s => ({
                        label: s.label,
                        value: s.value,
                        default: (cfg.canvas?.avatarStyle || 'circle') === s.value
                    })))
            ));
        }

        if (currentTab === 'message') {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('wcfg_back')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('wcfg_edit_content')
                    .setLabel('Edit Text')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('wcfg_edit_embed')
                    .setLabel('Edit Embed')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('wcfg_toggle_embed')
                    .setLabel(cfg.message?.embed?.enabled !== false ? 'Embed: On' : 'Embed: Off')
                    .setStyle(cfg.message?.embed?.enabled !== false ? ButtonStyle.Success : ButtonStyle.Secondary)
            ));
        }

        if (currentTab === 'features') {
            // Row 1: Back + main toggles
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('wcfg_back')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('wcfg_feat_ping')
                    .setLabel(cfg.pingUser ? 'Ping: On' : 'Ping: Off')
                    .setStyle(cfg.pingUser ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('wcfg_feat_delete')
                    .setLabel(cfg.deleteOnLeave ? 'Del on Leave: On' : 'Del on Leave: Off')
                    .setStyle(cfg.deleteOnLeave ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('wcfg_feat_count')
                    .setLabel(cfg.canvas?.showMemberCount !== false ? 'Count: On' : 'Count: Off')
                    .setStyle(cfg.canvas?.showMemberCount !== false ? ButtonStyle.Success : ButtonStyle.Secondary)
            ));

            // Row 2: Feature toggles
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('wcfg_feat_invites')
                    .setLabel(cfg.invites?.enabled ? 'Invites: On' : 'Invites: Off')
                    .setStyle(cfg.invites?.enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('wcfg_feat_milestones')
                    .setLabel(cfg.milestones?.enabled ? 'Milestones: On' : 'Milestones: Off')
                    .setStyle(cfg.milestones?.enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('wcfg_feat_dm')
                    .setLabel(cfg.dm?.enabled ? 'DM: On' : 'DM: Off')
                    .setStyle(cfg.dm?.enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
            ));

            // Row 3: Auto role selector
            rows.push(new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('wcfg_autorole')
                    .setPlaceholder('Select auto-role (optional)...')
                    .setMinValues(0)
                    .setMaxValues(1)
            ));
        }

        if (currentTab === 'goodbye') {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('wcfg_back')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('wcfg_goodbye_toggle')
                    .setLabel(cfg.goodbye?.enabled ? 'Enabled' : 'Disabled')
                    .setStyle(cfg.goodbye?.enabled ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('wcfg_goodbye_msg')
                    .setLabel('Edit Message')
                    .setStyle(ButtonStyle.Primary)
            ));

            // Row 2: Channel selector
            rows.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('wcfg_goodbye_channel')
                    .setPlaceholder('Goodbye channel (optional)...')
                    .setChannelTypes(ChannelType.GuildText)
            ));
        }

        return rows;
    };

    // Send initial message
    const response = await interaction.editReply({
        embeds: [await buildEmbed()],
        components: await buildComponents()
    });

    // Collector
    const collector = response.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (i) => {
        try {
            // Already handled check
            if (i.replied || i.deferred) return;

            if (i.user.id !== interaction.user.id) {
                // We use reply here because we haven't deferred this specific interaction 'i' yet
                return i.reply({ content: 'Use `/welcome config` to open your own panel.', ephemeral: true });
            }

            const cfg = await client.welcome.getConfig(interaction.guild.id);
            const customId = i.customId;

            // Handle modals - must show modal BEFORE deferring
            if (customId === 'wcfg_edit_content') {
                const modal = new ModalBuilder()
                    .setCustomId('wcfg_modal_content')
                    .setTitle('Edit Welcome Text')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('content')
                                .setLabel('Text Content (above the embed/card)')
                                .setStyle(TextInputStyle.Paragraph)
                                .setValue(cfg.message?.content || '')
                                .setPlaceholder('Welcome {user} to {server}!')
                                .setRequired(false)
                        )
                    );
                return i.showModal(modal);
            }

            if (customId === 'wcfg_edit_embed') {
                const modal = new ModalBuilder()
                    .setCustomId('wcfg_modal_embed')
                    .setTitle('Edit Embed')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('title')
                                .setLabel('Embed Title')
                                .setStyle(TextInputStyle.Short)
                                .setValue(cfg.message?.embed?.title || '')
                                .setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('description')
                                .setLabel('Embed Description')
                                .setStyle(TextInputStyle.Paragraph)
                                .setValue(cfg.message?.embed?.description || 'Welcome {user}')
                                .setPlaceholder('Welcome {user} to **{server}**!')
                                .setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('color')
                                .setLabel('Embed Color (hex)')
                                .setStyle(TextInputStyle.Short)
                                .setValue(cfg.message?.embed?.color || '#2b2d31')
                                .setPlaceholder('#ff6b6b')
                                .setRequired(false)
                        )
                    );
                return i.showModal(modal);
            }

            if (customId === 'wcfg_colors') {
                const modal = new ModalBuilder()
                    .setCustomId('wcfg_modal_colors')
                    .setTitle('Custom Colors')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('accent')
                                .setLabel('Accent Color (hex)')
                                .setStyle(TextInputStyle.Short)
                                .setValue(cfg.canvas?.accentColor || '')
                                .setPlaceholder('#ff6b6b')
                                .setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('text')
                                .setLabel('Text Color (hex)')
                                .setStyle(TextInputStyle.Short)
                                .setValue(cfg.canvas?.textColor || '')
                                .setPlaceholder('#ffffff')
                                .setRequired(false)
                        )
                    );
                return i.showModal(modal);
            }

            if (customId === 'wcfg_background') {
                const modal = new ModalBuilder()
                    .setCustomId('wcfg_modal_bg')
                    .setTitle('Custom Background')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('url')
                                .setLabel('Background Image URL')
                                .setStyle(TextInputStyle.Short)
                                .setValue(cfg.canvas?.background || '')
                                .setPlaceholder('https://example.com/image.png')
                                .setRequired(false)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('overlay')
                                .setLabel('Overlay Opacity (0.0 - 1.0)')
                                .setStyle(TextInputStyle.Short)
                                .setValue((cfg.canvas?.overlayOpacity || 0.6).toString())
                                .setPlaceholder('0.6')
                                .setRequired(false)
                        )
                    );
                return i.showModal(modal);
            }

            if (customId === 'wcfg_goodbye_msg') {
                const modal = new ModalBuilder()
                    .setCustomId('wcfg_modal_goodbye')
                    .setTitle('Goodbye Message')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('message')
                                .setLabel('Goodbye Message')
                                .setStyle(TextInputStyle.Paragraph)
                                .setValue(cfg.goodbye?.embed?.description || '{user.name} left the server')
                                .setPlaceholder('{user.name} left the server')
                                .setRequired(false)
                        )
                    );
                return i.showModal(modal);
            }

            // --- DEFER UPDATE FOR NON-MODAL INTERACTIONS ---
            await i.deferUpdate();

            // Navigation
            if (customId === 'wcfg_back') {
                currentTab = 'main';
            } else if (customId.startsWith('wcfg_tab_')) {
                currentTab = customId.replace('wcfg_tab_', '');
            }

            // Main tab actions
            else if (customId === 'wcfg_toggle') {
                await client.welcome.updateConfig(interaction.guild.id, 'enabled', !cfg.enabled);
            } else if (customId === 'wcfg_test') {
                if (!cfg.channelId) {
                    await i.followUp({ content: 'Set a channel first.', ephemeral: true });
                } else {
                    try {
                        const channel = await interaction.guild.channels.fetch(cfg.channelId);
                        await client.welcome.sendTest(interaction.member, channel);
                        await i.followUp({ content: `Test sent to ${channel}`, ephemeral: true });
                    } catch (e) {
                        await i.followUp({ content: `Test failed: ${e.message}`, ephemeral: true });
                    }
                }
            } else if (customId === 'wcfg_reset') {
                await client.welcome.setConfig(interaction.guild.id, {});
                await i.followUp({ content: 'Configuration reset.', ephemeral: true });
            }

            // Channel selection
            else if (customId === 'wcfg_channel') {
                const channelId = i.values[0];
                await client.welcome.updateConfig(interaction.guild.id, 'channelId', channelId);
            }

            // Style tab
            else if (customId === 'wcfg_theme') {
                const theme = i.values[0];
                if (theme === 'embed') {
                    await client.welcome.updateConfig(interaction.guild.id, 'canvas.enabled', false);
                    await client.welcome.updateConfig(interaction.guild.id, 'message.embed.enabled', true);
                } else {
                    await client.welcome.updateConfig(interaction.guild.id, 'canvas.enabled', true);
                    await client.welcome.updateConfig(interaction.guild.id, 'canvas.template', theme);
                }
            } else if (customId === 'wcfg_avatar') {
                await client.welcome.updateConfig(interaction.guild.id, 'canvas.avatarStyle', i.values[0]);
            }

            // Message tab
            else if (customId === 'wcfg_toggle_embed') {
                const current = cfg.message?.embed?.enabled !== false;
                await client.welcome.updateConfig(interaction.guild.id, 'message.embed.enabled', !current);
            }

            // Features tab
            else if (customId === 'wcfg_feat_ping') {
                await client.welcome.updateConfig(interaction.guild.id, 'pingUser', !cfg.pingUser);
            } else if (customId === 'wcfg_feat_delete') {
                await client.welcome.updateConfig(interaction.guild.id, 'deleteOnLeave', !cfg.deleteOnLeave);
            } else if (customId === 'wcfg_feat_count') {
                const current = cfg.canvas?.showMemberCount !== false;
                await client.welcome.updateConfig(interaction.guild.id, 'canvas.showMemberCount', !current);
            } else if (customId === 'wcfg_feat_invites') {
                await client.welcome.updateConfig(interaction.guild.id, 'invites.enabled', !cfg.invites?.enabled);
            } else if (customId === 'wcfg_feat_milestones') {
                await client.welcome.updateConfig(interaction.guild.id, 'milestones.enabled', !cfg.milestones?.enabled);
            } else if (customId === 'wcfg_feat_dm') {
                await client.welcome.updateConfig(interaction.guild.id, 'dm.enabled', !cfg.dm?.enabled);
            } else if (customId === 'wcfg_autorole') {
                const roleId = i.values[0] || null;
                await client.welcome.updateConfig(interaction.guild.id, 'autoroles', roleId ? [roleId] : []);
            }

            // Goodbye tab
            else if (customId === 'wcfg_goodbye_toggle') {
                await client.welcome.updateConfig(interaction.guild.id, 'goodbye.enabled', !cfg.goodbye?.enabled);
            } else if (customId === 'wcfg_goodbye_channel') {
                const channelId = i.values[0];
                await client.welcome.updateConfig(interaction.guild.id, 'goodbye.channelId', channelId);
            }

            // Always update the dashboard view
            await interaction.editReply({
                embeds: [await buildEmbed()],
                components: await buildComponents()
            });

        } catch (err) {
            console.error('[Vorn Welcome] Config error:', err);
            // Only reply if we haven't already
            if (!i.replied && !i.deferred) {
                await i.reply({ content: `Error: ${err.message}`, ephemeral: true }).catch(() => {});
            }
        }
    });

    // Handle modal submissions
    const modalFilter = (i) => i.user.id === interaction.user.id && i.customId.startsWith('wcfg_modal_');
    const modalCollector = interaction.channel.createMessageComponentCollector({
        filter: modalFilter,
        time: 300000
    });

    interaction.client.on('interactionCreate', async (i) => {
        if (!i.isModalSubmit()) return;
        if (i.user.id !== interaction.user.id) return;
        if (!i.customId.startsWith('wcfg_modal_')) return;

        try {
            await i.deferUpdate(); // Acknowledge the modal submit

            if (i.customId === 'wcfg_modal_content') {
                const content = i.fields.getTextInputValue('content');
                await client.welcome.updateConfig(interaction.guild.id, 'message.content', content);
                await i.followUp({ content: 'Text content updated.', ephemeral: true });
            }

            if (i.customId === 'wcfg_modal_embed') {
                const title = i.fields.getTextInputValue('title');
                const description = i.fields.getTextInputValue('description');
                const color = i.fields.getTextInputValue('color');

                if (title) await client.welcome.updateConfig(interaction.guild.id, 'message.embed.title', title);
                if (description) await client.welcome.updateConfig(interaction.guild.id, 'message.embed.description', description);
                if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
                    await client.welcome.updateConfig(interaction.guild.id, 'message.embed.color', color);
                }
                await i.followUp({ content: 'Embed updated.', ephemeral: true });
            }

            if (i.customId === 'wcfg_modal_colors') {
                const accent = i.fields.getTextInputValue('accent');
                const text = i.fields.getTextInputValue('text');

                if (accent && /^#[0-9A-Fa-f]{6}$/.test(accent)) {
                    await client.welcome.updateConfig(interaction.guild.id, 'canvas.accentColor', accent);
                }
                if (text && /^#[0-9A-Fa-f]{6}$/.test(text)) {
                    await client.welcome.updateConfig(interaction.guild.id, 'canvas.textColor', text);
                }
                await i.followUp({ content: 'Colors updated.', ephemeral: true });
            }

            if (i.customId === 'wcfg_modal_bg') {
                const url = i.fields.getTextInputValue('url');
                const overlay = parseFloat(i.fields.getTextInputValue('overlay')) || 0.6;

                await client.welcome.updateConfig(interaction.guild.id, 'canvas.background', url);
                await client.welcome.updateConfig(interaction.guild.id, 'canvas.overlayOpacity', Math.min(1, Math.max(0, overlay)));
                await i.followUp({ content: url ? 'Background set.' : 'Background cleared.', ephemeral: true });
            }

            if (i.customId === 'wcfg_modal_goodbye') {
                const message = i.fields.getTextInputValue('message');
                await client.welcome.updateConfig(interaction.guild.id, 'goodbye.embed.description', message);
                await i.followUp({ content: 'Goodbye message updated.', ephemeral: true });
            }

            // Refresh the main panel
            await interaction.editReply({
                embeds: [await buildEmbed()],
                components: await buildComponents()
            }).catch(() => {});

        } catch (err) {
            console.error('[Vorn Welcome] Modal error:', err);
            // Don't reply here as we deferred, logging is enough
        }
    });

    collector.on('end', async () => {
        try {
            const rows = await buildComponents();
            rows.forEach(row => row.components.forEach(c => c.setDisabled(true)));
            await interaction.editReply({ components: rows }).catch(() => {});
        } catch {}
    });
}
