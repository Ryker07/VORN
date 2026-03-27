/**
 * Vorn — Interactive Welcome Editor
 * Layer-based visual editor for custom welcome cards
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const WelcomeRenderer = require('./WelcomeRenderer');
const VornEmbed = require('../utils/embedBuilder');

// In-memory draft state
const drafts = new Map();

class WelcomeEditor {
    constructor(client) {
        this.client = client;
        // Cleanup interval
        setInterval(() => this.cleanupDrafts(), 5 * 60 * 1000);
    }

    cleanupDrafts() {
        const now = Date.now();
        const ttl = 15 * 60 * 1000;
        for (const [key, state] of drafts.entries()) {
            if (now - state.lastActive > ttl) {
                drafts.delete(key);
            }
        }
    }

    async start(interaction) {
        let schema = await this.getSchema(interaction.guild.id);

        const draftKey = `${interaction.guild.id}_${interaction.user.id}`;

        drafts.set(draftKey, {
            schema: JSON.parse(JSON.stringify(schema)),
            selectedLayerIndex: null,
            lastActive: Date.now()
        });

        await this.renderDashboard(interaction);
    }

    async renderDashboard(interaction) {
        const draftKey = `${interaction.guild.id}_${interaction.user.id}`;
        const state = drafts.get(draftKey);

        if (!state) {
            return interaction.reply({ content: 'Session expired. Run the command again.', ephemeral: true });
        }

        state.lastActive = Date.now();
        const { schema, selectedLayerIndex } = state;

        let previewBuffer;
        try {
            previewBuffer = await WelcomeRenderer.render(interaction.member, schema);
        } catch (e) {
            console.error('[Vorn Editor]', e);
            return interaction.reply({ content: 'Render failed.', ephemeral: true });
        }

        const embed = VornEmbed.create()
            .setTitle('Welcome Card Editor')
            .setDescription('Select a layer to edit. Changes are live.')
            .setImage('attachment://preview.png')
            .setFooter({ text: 'Vorn Design Engine' });

        const rows = [];

        // Layer selection menu
        if (schema.layers.length > 0) {
            const layerOptions = schema.layers.map((layer, index) => {
                let label = `${layer.type.toUpperCase()}`;
                if (layer.type === 'text' && layer.content) {
                    label += `: ${layer.content.substring(0, 15)}`;
                }
                if (layer.type === 'shape' && layer.shape) {
                    label += `: ${layer.shape}`;
                }

                return {
                    label: label.substring(0, 25),
                    value: index.toString(),
                    description: `Z: ${layer.zIndex || 0}`,
                    default: index === selectedLayerIndex
                };
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('editor_select_layer')
                .setPlaceholder('Select layer...')
                .addOptions(layerOptions);

            rows.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        // Controls for selected layer
        if (selectedLayerIndex !== null && schema.layers[selectedLayerIndex]) {
            const selectedLayer = schema.layers[selectedLayerIndex];

            // Position controls
            const posRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('editor_move_left').setLabel('\u2190').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('editor_move_up').setLabel('\u2191').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('editor_move_down').setLabel('\u2193').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('editor_move_right').setLabel('\u2192').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('editor_deselect').setLabel('Deselect').setStyle(ButtonStyle.Secondary)
            );

            // Property controls
            const propRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('editor_size_up').setLabel('+ Size').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('editor_size_down').setLabel('- Size').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('editor_color').setLabel('Color').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('editor_content').setLabel('Content').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('editor_delete').setLabel('Delete').setStyle(ButtonStyle.Danger)
            );

            // Layer ordering
            const orderRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('editor_layer_up').setLabel('Forward').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('editor_layer_down').setLabel('Backward').setStyle(ButtonStyle.Secondary)
            );

            rows.push(posRow, propRow, orderRow);

            embed.addFields({
                name: 'Selected',
                value: `Type: ${selectedLayer.type}\nZ-Index: ${selectedLayer.zIndex || 0}\nPosition: ${selectedLayer.x || 0}, ${selectedLayer.y || 0}`
            });
        } else {
            // Add layer buttons
            const addRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('editor_add_text').setLabel('Add Text').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('editor_add_shape').setLabel('Add Shape').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('editor_save').setLabel('Save').setStyle(ButtonStyle.Success)
            );
            rows.push(addRow);
        }

        const payload = {
            embeds: [embed],
            components: rows,
            files: [{ attachment: previewBuffer, name: 'preview.png' }]
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply(payload);
        } else {
            await interaction.reply(payload);
        }
    }

    async handleInteraction(interaction) {
        const draftKey = `${interaction.guild.id}_${interaction.user.id}`;
        const state = drafts.get(draftKey);

        if (!state) {
            if (interaction.isRepliable()) {
                return interaction.reply({ content: 'Session expired.', ephemeral: true });
            }
            return;
        }

        // Modal handling
        if (interaction.isModalSubmit()) {
            const { schema, selectedLayerIndex } = state;
            const layer = selectedLayerIndex !== null ? schema.layers[selectedLayerIndex] : null;

            if (interaction.customId === 'modal_color' && layer) {
                const hex = interaction.fields.getTextInputValue('hex');
                if (/^#[0-9A-F]{6}$/i.test(hex)) {
                    layer.color = hex;
                }
            }

            if (interaction.customId === 'modal_content' && layer) {
                layer.content = interaction.fields.getTextInputValue('content');
            }

            await interaction.deferUpdate();
            return this.renderDashboard(interaction);
        }

        if (!interaction.customId.startsWith('editor_')) return;

        const action = interaction.customId;
        const { schema, selectedLayerIndex } = state;
        const layer = selectedLayerIndex !== null ? schema.layers[selectedLayerIndex] : null;

        // Modal triggers
        if (action === 'editor_color') {
            const modal = new ModalBuilder()
                .setCustomId('modal_color')
                .setTitle('Edit Color');

            const input = new TextInputBuilder()
                .setCustomId('hex')
                .setLabel('Hex Color (e.g. #FFFFFF)')
                .setStyle(TextInputStyle.Short)
                .setValue(layer?.color || '#FFFFFF')
                .setMinLength(7)
                .setMaxLength(7);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        if (action === 'editor_content') {
            const modal = new ModalBuilder()
                .setCustomId('modal_content')
                .setTitle('Edit Content');

            const input = new TextInputBuilder()
                .setCustomId('content')
                .setLabel('Text (use {user}, {server}, {count})')
                .setStyle(TextInputStyle.Short)
                .setValue(layer?.content || '')
                .setMaxLength(100);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        await interaction.deferUpdate();

        // Layer selection
        if (interaction.isStringSelectMenu() && action === 'editor_select_layer') {
            state.selectedLayerIndex = parseInt(interaction.values[0]);
        }

        // Movement
        const moveAmount = 10;
        if (layer) {
            switch (action) {
                case 'editor_move_left':
                    layer.x = (layer.x || 0) - moveAmount;
                    break;
                case 'editor_move_right':
                    layer.x = (layer.x || 0) + moveAmount;
                    break;
                case 'editor_move_up':
                    layer.y = (layer.y || 0) - moveAmount;
                    break;
                case 'editor_move_down':
                    layer.y = (layer.y || 0) + moveAmount;
                    break;
                case 'editor_size_up':
                    layer.size = (layer.size || 32) + 5;
                    break;
                case 'editor_size_down':
                    layer.size = Math.max(8, (layer.size || 32) - 5);
                    break;
                case 'editor_layer_up':
                    layer.zIndex = (layer.zIndex || 0) + 1;
                    break;
                case 'editor_layer_down':
                    layer.zIndex = (layer.zIndex || 0) - 1;
                    break;
                case 'editor_delete':
                    schema.layers.splice(selectedLayerIndex, 1);
                    state.selectedLayerIndex = null;
                    break;
                case 'editor_deselect':
                    state.selectedLayerIndex = null;
                    break;
            }
        }

        // Add layers
        if (action === 'editor_add_text') {
            schema.layers.push({
                type: 'text',
                content: 'New Text',
                x: 50,
                y: 50,
                size: 32,
                color: '#ffffff',
                weight: 'bold',
                zIndex: schema.layers.length + 1
            });
            state.selectedLayerIndex = schema.layers.length - 1;
        }

        if (action === 'editor_add_shape') {
            schema.layers.push({
                type: 'shape',
                shape: 'rect',
                x: 50,
                y: 50,
                width: 100,
                height: 50,
                color: 'rgba(255,255,255,0.2)',
                radius: 10,
                zIndex: schema.layers.length + 1
            });
            state.selectedLayerIndex = schema.layers.length - 1;
        }

        // Save
        if (action === 'editor_save') {
            await this.client.welcome.updateConfig(interaction.guild.id, 'canvas.schema', schema);
            await this.client.welcome.updateConfig(interaction.guild.id, 'canvas.enabled', true);
            return interaction.followUp({ content: 'Layout saved.', ephemeral: true });
        }

        await this.renderDashboard(interaction);
    }

    async getSchema(guildId) {
        const config = await this.client.welcome.getConfig(guildId);

        if (config.canvas?.schema) {
            return config.canvas.schema;
        }

        // Default schema
        return {
            width: 900,
            height: 320,
            layers: [
                {
                    type: 'background',
                    color: '#0a0a0a',
                    vignette: true,
                    vignetteStrength: 0.3,
                    zIndex: 0
                },
                {
                    type: 'decoration',
                    style: 'accent-bottom',
                    color: '#ffffff',
                    height: 3,
                    zIndex: 1
                },
                {
                    type: 'avatar',
                    shape: 'circle',
                    x: 60,
                    y: 80,
                    size: 160,
                    stroke: { color: '#ffffff', width: 4 },
                    glow: { color: 'rgba(255,255,255,0.15)', blur: 25 },
                    zIndex: 2
                },
                {
                    type: 'text',
                    content: 'WELCOME',
                    x: 260,
                    y: 70,
                    size: 14,
                    color: '#71717a',
                    weight: '600',
                    zIndex: 3
                },
                {
                    type: 'text',
                    content: '{user}',
                    x: 260,
                    y: 95,
                    size: 44,
                    color: '#ffffff',
                    weight: 'bold',
                    maxWidth: 550,
                    autoFit: true,
                    textShadow: { color: 'rgba(0,0,0,0.5)', blur: 8, y: 2 },
                    zIndex: 3
                },
                {
                    type: 'text',
                    content: 'to {server}',
                    x: 260,
                    y: 150,
                    size: 18,
                    color: '#71717a',
                    weight: '500',
                    zIndex: 3
                },
                {
                    type: 'shape',
                    shape: 'rect',
                    x: 260,
                    y: 190,
                    width: 130,
                    height: 28,
                    color: '#ffffff',
                    radius: 14,
                    zIndex: 4
                },
                {
                    type: 'text',
                    content: 'Member #{count}',
                    x: 325,
                    y: 197,
                    size: 13,
                    color: '#0a0a0a',
                    weight: 'bold',
                    align: 'center',
                    zIndex: 5
                }
            ]
        };
    }
}

module.exports = WelcomeEditor;
