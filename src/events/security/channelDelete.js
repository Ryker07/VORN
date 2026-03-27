/**
 * Vorn — Channel Delete Event
 * With Auto-Recovery support
 */

const { AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'channelDelete',
    async execute(channel, client) {
        if (!channel.guild || !client.antiNuke) return;

        const channelId = channel.id;
        const guild = channel.guild;

        setTimeout(async () => {
            try {
                const logs = await guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.ChannelDelete
                });

                const log = logs.entries.first();
                if (!log || log.target.id !== channelId) return;

                // Handle anti-nuke (punishment)
                const punished = await client.antiNuke.handleAction(guild, log.executor, 'channel_delete');

                // Auto-recovery: restore channel if enabled
                const config = await client.antiNuke.getConfig(guild.id);
                if (config.autoRecovery && client.backupManager) {
                    const restored = await client.backupManager.quickRestoreChannel(guild, channelId);
                    if (restored) {
                        console.log(`[AutoRecovery] Restored channel: ${restored.name}`);
                    }
                }
            } catch { }
        }, 500);
    }
};
