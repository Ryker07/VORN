const { Events } = require('discord.js');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client) {
        if (!newState.guild || !client.logging) return;

        const member = newState.member;
        if (!member) return;
        if (member.user.bot && !(await client.logging.shouldLogBots(newState.guild.id))) return;

        // Ignore checks
        if (await client.logging.shouldIgnore(newState.guild.id, {
            userId: member.id,
            roleIds: member.roles.cache.map(r => r.id)
        })) return;

        let action = null;
        let details = {};

        // Join
        if (!oldState.channelId && newState.channelId) {
            action = 'Joined';
            details.channel = newState.channel;
        }
        // Leave
        else if (oldState.channelId && !newState.channelId) {
            action = 'Left';
            details.channel = oldState.channel;
        }
        // Move
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            action = 'Moved';
            details.oldChannel = oldState.channel;
            details.newChannel = newState.channel;
        }

        if (action) {
            const embed = client.logging.voiceStateEmbed(member, action, details);
            await client.logging.send(newState.guild, 'voice', embed);
        }
    }
};
