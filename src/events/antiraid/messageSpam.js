/**
 * Vorn — Anti-Raid Message Handler
 * Monitors messages for spam detection
 */

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (!client.antiRaid) return;
        if (message.author.bot) return;
        await client.antiRaid.handleMessage(message);
    }
};
