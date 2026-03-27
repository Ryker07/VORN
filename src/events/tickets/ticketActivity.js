/**
 * Vorn — Ticket Activity Tracker
 * Tracks message activity in ticket channels for auto-close and response time
 */

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // Ignore bots and DMs
        if (message.author.bot || !message.guild) return;
        if (!client.ticketManager) return;

        // Check if this is a ticket channel
        const isTicket = await client.ticketManager.isTicket(message.channel.id, message.guild.id);
        if (!isTicket) return;

        // Track activity
        await client.ticketManager.trackActivity(
            message.channel.id,
            message.guild.id,
            message.author.id
        );
    }
};
