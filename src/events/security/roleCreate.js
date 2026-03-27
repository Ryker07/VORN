/**
 * Vorn — Role Create Event
 */

const { AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'roleCreate',
    async execute(role, client) {
        if (!role.guild || !client.antiNuke) return;

        setTimeout(async () => {
            try {
                const logs = await role.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.RoleCreate
                });

                const log = logs.entries.first();
                if (!log || log.target.id !== role.id) return;

                await client.antiNuke.handleAction(role.guild, log.executor, 'role_create');
            } catch { }
        }, 500);
    }
};
