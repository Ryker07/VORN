/**
 * Vorn — Invite Member Join Event
 * Tracks invite attribution when a member joins
 */

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        if (!client.invites) return;
        await client.invites.handleJoin(member);
    }
};
