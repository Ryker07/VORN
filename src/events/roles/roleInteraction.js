/**
 * Vorn — Reaction Role Interaction Handler
 * Handles Button and Select Menu interactions for role panels
 */

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.guild || !client.reactionRoles) return;

        // --- BUTTON INTERACTION ---
        if (interaction.isButton() && interaction.customId.startsWith('rr_btn_')) {
            await client.reactionRoles.handleButton(interaction);
        }

        // --- SELECT MENU INTERACTION ---
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rr_sel_')) {
            await client.reactionRoles.handleSelect(interaction);
        }
    }
};
