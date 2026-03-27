/**
 * Vorn — Giveaway Interaction Handler
 * Handles Join Buttons, Paused state, Drop mode, and Creation Modals
 */

const { InteractionType } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.guild || !client.giveawayManager) return;

        // --- HANDLE JOIN BUTTON ---
        if (interaction.isButton() && interaction.customId === 'gw_join') {
            await interaction.deferReply({ ephemeral: true });

            const result = await client.giveawayManager.joinGiveaway(interaction, interaction.message.id);

            if (result.success) {
                const message = result.action === 'join'
                    ? '✅ Entry confirmed! Good luck!'
                    : '📤 You left the giveaway.';
                await interaction.editReply({ content: message });
            } else {
                await interaction.editReply({ content: `❌ ${result.message}` });
            }
        }

        // --- WIZARD COMPONENTS ---
        if (client.giveawayWizard) {
            if (interaction.isButton() && interaction.customId.startsWith('gwdraft_')) {
                const handled = await client.giveawayWizard.handleInteraction(interaction);
                if (handled) return;
            }

            if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('gWModal_')) {
                const handled = await client.giveawayWizard.handleModalSubmit(interaction);
                if (handled) return;
            }

            if (interaction.isAnySelectMenu() && interaction.customId.startsWith('gWSelect_')) {
                const handled = await client.giveawayWizard.handleSelectMenu(interaction);
                if (handled) return;
            }
        }
    }
};

function parseDuration(str) {
    if (!str) return null;
    const match = str.match(/^(\d+)([smhd])$/);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2];
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return val * multipliers[unit];
}
