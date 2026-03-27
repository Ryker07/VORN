/**
 * Vorn — Channel Create Event
 */

const { AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'channelCreate',
    async execute(channel, client) {
        if (!channel.guild || !client.antiNuke) return;

        setTimeout(async () => {
            try {
                const logs = await channel.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.ChannelCreate
                });

                const log = logs.entries.first();
                if (!log || log.target.id !== channel.id) return;

                await client.antiNuke.handleAction(channel.guild, log.executor, 'channel_create');
            } catch { }
        }, 500);
    }
};
