/**
 * Vorn — Invite Member Leave Event
 * Updates invite stats when a member leaves
 */

module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        if (!client.invites) return;
        await client.invites.handleLeave(member);
    }
};
