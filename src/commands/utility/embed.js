/**
 * Vorn — /embed Command
 * Custom embed builder via modals
 */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create and send a custom embed')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('Channel to send the embed in (default: current)')
        ),

    async execute(interaction, client) {
        // Store target channel for later
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        // Build modal
        const modal = new ModalBuilder()
            .setCustomId(`embed_builder_${targetChannel.id}`)
            .setTitle('Embed Builder');

        const titleInput = new TextInputBuilder()
            .setCustomId('embed_title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(256)
            .setPlaceholder('Embed title');

        const descInput = new TextInputBuilder()
            .setCustomId('embed_description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(4000)
            .setPlaceholder('Embed description (supports markdown)');

        const colorInput = new TextInputBuilder()
            .setCustomId('embed_color')
            .setLabel('Color (hex)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(7)
            .setPlaceholder('#2b2d31');

        const footerInput = new TextInputBuilder()
            .setCustomId('embed_footer')
            .setLabel('Footer')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(256)
            .setPlaceholder('Footer text');

        const imageInput = new TextInputBuilder()
            .setCustomId('embed_image')
            .setLabel('Image URL')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('https://example.com/image.png');

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput),
            new ActionRowBuilder().addComponents(colorInput),
            new ActionRowBuilder().addComponents(footerInput),
            new ActionRowBuilder().addComponents(imageInput)
        );

        await interaction.showModal(modal);

        // Wait for modal submission
        try {
            const submitted = await interaction.awaitModalSubmit({
                filter: (i) => i.customId === `embed_builder_${targetChannel.id}` && i.user.id === interaction.user.id,
                time: 300_000
            });

            const title = submitted.fields.getTextInputValue('embed_title') || null;
            const description = submitted.fields.getTextInputValue('embed_description');
            const colorRaw = submitted.fields.getTextInputValue('embed_color') || '#2b2d31';
            const footer = submitted.fields.getTextInputValue('embed_footer') || null;
            const image = submitted.fields.getTextInputValue('embed_image') || null;

            // Parse color
            let color = 0x2b2d31;
            try {
                const cleaned = colorRaw.replace('#', '');
                color = parseInt(cleaned, 16);
                if (isNaN(color)) color = 0x2b2d31;
            } catch {
                color = 0x2b2d31;
            }

            // Build embed
            const embed = new EmbedBuilder()
                .setColor(color)
                .setDescription(description);

            if (title) embed.setTitle(title);
            if (footer) embed.setFooter({ text: footer });
            if (image && image.startsWith('http')) embed.setImage(image);

            // Send to target channel
            await targetChannel.send({ embeds: [embed] });

            const target = targetChannel.id === submitted.channel.id
                ? 'this channel'
                : `${targetChannel}`;

            await submitted.reply({
                embeds: [VornEmbed.success(`Embed sent to ${target}`)],
                ephemeral: true
            });

        } catch (error) {
            // Modal timed out or failed — no response needed
        }
    }
};
