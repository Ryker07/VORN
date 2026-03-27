/**
 * Vorn — Role Delete Event
 * With Auto-Recovery support
 */

const { AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'roleDelete',
    async execute(role, client) {
        if (!role.guild || !client.antiNuke) return;

        const roleId = role.id;
        const guild = role.guild;

        setTimeout(async () => {
            try {
                const logs = await guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.RoleDelete
                });

                const log = logs.entries.first();
                if (!log || log.target.id !== roleId) return;

                // Handle anti-nuke (punishment)
                await client.antiNuke.handleAction(guild, log.executor, 'role_delete');

                // Auto-recovery: restore role if enabled
                const config = await client.antiNuke.getConfig(guild.id);
                if (config.autoRecovery && client.backupManager) {
                    const restored = await client.backupManager.quickRestoreRole(guild, roleId);
                    if (restored) {
                        console.log(`[AutoRecovery] Restored role: ${restored.name}`);
                    }
                }
            } catch { }
        }, 500);
    }
};
