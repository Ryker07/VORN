/**
 * Vorn — Invite Delete Event
 * Updates invite cache when an invite is deleted
 */

module.exports = {
    name: 'inviteDelete',
    async execute(invite, client) {
        if (!client.invites) return;
        client.invites.handleInviteDelete(invite);
    }
};
