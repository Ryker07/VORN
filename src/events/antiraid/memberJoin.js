/**
 * Vorn — Anti-Raid Join Handler
 * Monitors member joins for raid detection
 */

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        if (!client.antiRaid) return;
        await client.antiRaid.handleJoin(member);
    }
};
