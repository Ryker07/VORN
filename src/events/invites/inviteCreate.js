/**
 * Vorn — Invite Create Event
 * Updates invite cache when a new invite is created
 */

module.exports = {
    name: 'inviteCreate',
    async execute(invite, client) {
        if (!client.invites) return;
        client.invites.handleInviteCreate(invite);
    }
};
