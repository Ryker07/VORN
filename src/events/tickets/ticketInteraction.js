/**
 * Vorn — Ticket Interaction Handler
 * Handles Panel interactions, Button controls, Modals, and Activity tracking
 */

const {
    InteractionType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder
} = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.guild || !client.ticketManager) return;

        // ═══════════════════════════════════════════════════════════════
        // PANEL INTERACTIONS (Button/Select to open ticket)
        // ═══════════════════════════════════════════════════════════════
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            const customId = interaction.customId;

            // Check if it's a ticket panel interaction
            if (customId.startsWith('tpanel_')) {
                const config = await client.ticketManager.getConfig(interaction.guild.id);
                const panel = config.panels.find(p => customId.startsWith(p.customId));

                if (!panel) return;

                let selectedOption = null;

                if (interaction.isButton()) {
                    selectedOption = {
                        label: 'Support',
                        value: 'default',
                        categoryId: panel.categoryId,
                        roleId: panel.roleId
                    };
                } else if (interaction.isStringSelectMenu()) {
                    const value = interaction.values[0];
                    selectedOption = panel.options.find(o => o.value === value);
                }

                if (!selectedOption) {
                    return interaction.reply({ content: 'Invalid option selected.', ephemeral: true });
                }

                // Show ticket creation modal
                const modal = new ModalBuilder()
                    .setCustomId(`ticket_modal_${panel.id}_${selectedOption.value}`)
                    .setTitle(`Open Ticket: ${selectedOption.label}`);

                const subjectInput = new TextInputBuilder()
                    .setCustomId('subject')
                    .setLabel('Subject')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Brief summary of your issue')
                    .setRequired(true)
                    .setMaxLength(100);

                const descInput = new TextInputBuilder()
                    .setCustomId('description')
                    .setLabel('Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Describe your issue in detail...')
                    .setRequired(true)
                    .setMaxLength(1000);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(subjectInput),
                    new ActionRowBuilder().addComponents(descInput)
                );

                await interaction.showModal(modal);
                return;
            }

            // ═══════════════════════════════════════════════════════════════
            // TICKET CONTROL BUTTONS (Inside ticket)
            // ═══════════════════════════════════════════════════════════════
            if (customId.startsWith('ticket_')) {
                const action = customId.replace('ticket_', '');
                const channel = interaction.channel;
                const ticket = await client.ticketManager.getTicket(channel.id, interaction.guild.id);

                if (!ticket) {
                    return interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
                }

                // CLAIM
                if (action === 'claim') {
                    const result = await client.ticketManager.claimTicket(channel, interaction.member);
                    if (!result.success) {
                        return interaction.reply({ content: result.error, ephemeral: true });
                    }
                    await channel.send({ embeds: [VornEmbed.success(`Ticket claimed by ${interaction.user}`)] });
                    return interaction.reply({ content: 'Ticket claimed.', ephemeral: true });
                }

                // CLOSE
                if (action === 'close') {
                    const modal = new ModalBuilder()
                        .setCustomId('ticket_close_modal')
                        .setTitle('Close Ticket');

                    const reasonInput = new TextInputBuilder()
                        .setCustomId('reason')
                        .setLabel('Close Reason')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Why is this ticket being closed?')
                        .setRequired(false)
                        .setMaxLength(500);

                    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
                    await interaction.showModal(modal);
                    return;
                }

                // PRIORITY
                if (action === 'priority') {
                    const row = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('ticket_priority_select')
                            .setPlaceholder('Select priority level')
                            .addOptions([
                                { label: 'Low', value: 'low', description: 'Non-urgent issues' },
                                { label: 'Normal', value: 'normal', description: 'Standard priority' },
                                { label: 'High', value: 'high', description: 'Important issues' },
                                { label: 'Urgent', value: 'urgent', description: 'Critical issues' }
                            ])
                    );
                    return interaction.reply({ content: 'Select priority:', components: [row], ephemeral: true });
                }

                // ADD USER
                if (action === 'add_user') {
                    const row = new ActionRowBuilder().addComponents(
                        new UserSelectMenuBuilder()
                            .setCustomId('ticket_add_user_select')
                            .setPlaceholder('Select user to add')
                    );
                    return interaction.reply({ content: 'Select user to add:', components: [row], ephemeral: true });
                }

                // TRANSCRIPT
                if (action === 'transcript') {
                    await interaction.deferReply({ ephemeral: true });
                    await client.ticketManager.generateTranscript(channel, ticket, 'Manual Save');
                    return interaction.editReply({ content: 'Transcript saved.' });
                }

                // RENAME
                if (action === 'rename') {
                    const modal = new ModalBuilder()
                        .setCustomId('ticket_rename_modal')
                        .setTitle('Rename Ticket');

                    const nameInput = new TextInputBuilder()
                        .setCustomId('name')
                        .setLabel('New Channel Name')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder(channel.name)
                        .setRequired(true)
                        .setMaxLength(100);

                    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
                    await interaction.showModal(modal);
                    return;
                }

                // TRANSFER
                if (action === 'transfer') {
                    const row = new ActionRowBuilder().addComponents(
                        new UserSelectMenuBuilder()
                            .setCustomId('ticket_transfer_select')
                            .setPlaceholder('Select new owner')
                    );
                    return interaction.reply({ content: 'Select new ticket owner:', components: [row], ephemeral: true });
                }
            }

            // ═══════════════════════════════════════════════════════════════
            // TICKET SELECT MENUS (Priority, Add User, Transfer)
            // ═══════════════════════════════════════════════════════════════
            if (customId === 'ticket_priority_select') {
                const priority = interaction.values[0];
                const result = await client.ticketManager.setPriority(interaction.channel, priority);

                if (!result.success) {
                    return interaction.update({ content: result.error, components: [] });
                }

                await interaction.channel.send({ embeds: [VornEmbed.info('Priority Changed', `Priority set to **${priority}**`)] });
                return interaction.update({ content: `Priority set to ${priority}`, components: [] });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // USER SELECT MENUS
        // ═══════════════════════════════════════════════════════════════
        if (interaction.isUserSelectMenu()) {
            const customId = interaction.customId;
            const user = interaction.users.first();

            if (customId === 'ticket_add_user_select') {
                const result = await client.ticketManager.addUser(interaction.channel, user);

                if (!result.success) {
                    return interaction.update({ content: result.error, components: [] });
                }

                await interaction.channel.send({ embeds: [VornEmbed.success(`${user} has been added to the ticket`)] });
                return interaction.update({ content: `Added ${user}`, components: [] });
            }

            if (customId === 'ticket_transfer_select') {
                const result = await client.ticketManager.transferOwnership(interaction.channel, user);

                if (!result.success) {
                    return interaction.update({ content: result.error, components: [] });
                }

                await interaction.channel.send({ embeds: [VornEmbed.info('Ownership Transferred', `Ticket ownership transferred to ${user}`)] });
                return interaction.update({ content: `Transferred to ${user}`, components: [] });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // MODAL SUBMISSIONS
        // ═══════════════════════════════════════════════════════════════
        if (interaction.type === InteractionType.ModalSubmit) {
            const customId = interaction.customId;

            // TICKET CREATION MODAL
            if (customId.startsWith('ticket_modal_')) {
                const parts = customId.split('_');
                const panelId = parts[2];
                const optionValue = parts.slice(3).join('_');

                await interaction.deferReply({ ephemeral: true });

                const config = await client.ticketManager.getConfig(interaction.guild.id);
                const panel = config.panels.find(p => p.id === panelId);

                if (!panel) {
                    return interaction.editReply({ content: 'Panel configuration not found.' });
                }

                const option = panel.options.find(o => o.value === optionValue) || {
                    label: 'Support',
                    value: 'default',
                    categoryId: panel.categoryId,
                    roleId: panel.roleId
                };

                const subject = interaction.fields.getTextInputValue('subject');
                const description = interaction.fields.getTextInputValue('description');

                try {
                    const result = await client.ticketManager.createTicket(interaction, option, { subject, description });
                    if (result?.success === false) {
                        await interaction.editReply({ content: result.error });
                    } else {
                        await interaction.editReply({ content: `Ticket created: ${result}` });
                    }
                } catch (error) {
                    console.error(`[Vorn Tickets] Create error: ${error.message}`);
                    await interaction.editReply({ content: `Failed to create ticket: ${error.message}` });
                }
                return;
            }

            // CLOSE MODAL
            if (customId === 'ticket_close_modal') {
                const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';

                await interaction.reply({ embeds: [VornEmbed.warning('Closing ticket in 5 seconds...')], ephemeral: true });

                setTimeout(async () => {
                    await client.ticketManager.closeTicket(interaction.channel, interaction.user, reason);
                    await interaction.channel.delete().catch(() => { });
                }, 5000);
                return;
            }

            // RENAME MODAL
            if (customId === 'ticket_rename_modal') {
                const newName = interaction.fields.getTextInputValue('name');
                const result = await client.ticketManager.renameTicket(interaction.channel, newName);

                if (!result.success) {
                    return interaction.reply({ content: result.error, ephemeral: true });
                }

                return interaction.reply({ content: `Renamed to ${newName}`, ephemeral: true });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // FEEDBACK BUTTONS (DM)
        // ═══════════════════════════════════════════════════════════════
        if (interaction.isButton() && interaction.customId.startsWith('feedback_')) {
            const parts = interaction.customId.split('_');
            const guildId = parts[1];
            const ticketId = parts[2];
            const rating = parseInt(parts[3]);

            // Store feedback
            const config = await client.ticketManager.getConfig(guildId);
            if (!config.feedback) config.feedback = [];

            config.feedback.push({
                ticketId,
                userId: interaction.user.id,
                rating,
                timestamp: Date.now()
            });

            // Keep only last 100 feedback entries
            if (config.feedback.length > 100) {
                config.feedback = config.feedback.slice(-100);
            }

            // Record rating for staff performance
            // Find which staff member claimed this ticket from feedback
            const ticketFeedback = config.feedback.find(f => f.ticketId === ticketId);
            if (ticketFeedback) {
                // Check active tickets aren't available since ticket is closed,
                // but we can try to find the staff from log data
                for (const [staffId, perf] of Object.entries(config.staffPerformance || {})) {
                    // Record for the most recently active staff member
                    await client.ticketManager.recordFeedbackRating(guildId, staffId, rating);
                    break; // Only one rating per ticket
                }
            }

            await client.ticketManager.setConfig(guildId, config);

            const ratingText = ['', '', 'Poor', 'Okay', 'Good', 'Excellent'][rating];
            await interaction.update({
                content: `Thank you for your feedback. You rated your experience as **${ratingText}**.`,
                components: [],
                embeds: []
            });
        }
    }
};
