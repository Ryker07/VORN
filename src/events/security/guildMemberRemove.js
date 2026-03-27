/**
 * Vorn — Guild Member Remove Event (member_kick & member_prune)
 */

const { AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        if (!member.guild || !client.antiNuke) return;

        setTimeout(async () => {
            try {
                // Check for kick
                const kickLogs = await member.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberKick
                });

                const kickLog = kickLogs.entries.first();
                if (kickLog && kickLog.target.id === member.id && Date.now() - kickLog.createdTimestamp < 5000) {
                    await client.antiNuke.handleAction(member.guild, kickLog.executor, 'member_kick');
                    return;
                }

                // Check for prune
                const pruneLogs = await member.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberPrune
                });

                const pruneLog = pruneLogs.entries.first();
                if (pruneLog && Date.now() - pruneLog.createdTimestamp < 5000) {
                    await client.antiNuke.handleAction(member.guild, pruneLog.executor, 'member_prune');
                }
            } catch { }
        }, 500);
    }
};
