const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message, client) {
        // Ignore bots and DM
        if (message.author.bot || !message.guild) return;

        // AutoMod Check
        if (client.automod) {
            await client.automod.handleMessage(message);
        }
    }
};
