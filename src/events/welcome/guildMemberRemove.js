/**
 * Vorn — Welcome Member Leave Event
 * Handles guildMemberRemove for goodbye messages
 */

module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        if (!client.welcome) return;

        // Handle goodbye message
        await client.welcome.handleLeave(member);

        // Delete welcome message if configured
        await client.welcome.deleteWelcomeMessage(member);
    }
};
