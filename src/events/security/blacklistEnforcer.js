/**
 * Vorn — Persistent Blacklist Event
 * Triggers on guildMemberAdd to automatically ban users saved in the persistent blacklist
 */

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        if (!member.guild) return;

        // Fetch explicitly blacklisted IDs from DB
        const persistentBans = await client.db.get(member.guild.id, 'persistent_bans') || [];

        if (persistentBans.includes(member.id)) {
            if (member.bannable) {
                await member.guild.members.ban(member.id, { reason: 'Persistent Blacklist (Auto-Ban on Join)' }).catch(() => null);
            }
        }
    }
};
