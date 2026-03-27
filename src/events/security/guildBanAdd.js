/**
 * Vorn — Guild Ban Add Event (member_ban)
 */

const { AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'guildBanAdd',
    async execute(ban, client) {
        if (!ban.guild || !client.antiNuke) return;

        setTimeout(async () => {
            try {
                const logs = await ban.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberBanAdd
                });

                const log = logs.entries.first();
                if (!log || log.target.id !== ban.user.id) return;

                await client.antiNuke.handleAction(ban.guild, log.executor, 'member_ban');
            } catch { }
        }, 500);
    }
};
