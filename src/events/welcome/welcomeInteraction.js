/**
 * Vorn — Welcome Interaction Handler
 * Handles interactions for welcome messages and editor
 */

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.guild) return;

        // Welcome System Interactions (wave button, etc)
        if (client.welcome && interaction.isButton() && interaction.customId.startsWith('welcome_')) {
            await client.welcome.handleInteraction(interaction);
        }

        // Editor Interactions (buttons, select menus)
        if (client.welcomeEditor) {
            const customId = interaction.customId || '';

            if (customId.startsWith('editor_') || customId.startsWith('modal_')) {
                await client.welcomeEditor.handleInteraction(interaction);
            }
        }
    }
};
