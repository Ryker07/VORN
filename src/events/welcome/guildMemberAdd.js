/**
 * Vorn — Welcome Member Join Event
 * Handles guildMemberAdd for welcome system
 */

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        if (!client.welcome) return;
        await client.welcome.handleJoin(member);
    }
};
