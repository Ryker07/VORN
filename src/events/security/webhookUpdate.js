/**
 * Vorn — Webhook Update Event
 * Anti-Nuke: Detects unauthorized webhook creation
 */

const { AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'webhookUpdate',
    async execute(channel, client) {
        if (!channel.guild || !client.antiNuke) return;

        setTimeout(async () => {
            try {
                const logs = await channel.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.WebhookCreate
                });

                const log = logs.entries.first();
                // Check if log is recent (within 5 seconds)
                if (!log || (Date.now() - log.createdTimestamp) > 5000) return;

                if (log.target.channelId !== channel.id) return;

                // Handle anti-nuke
                const punished = await client.antiNuke.handleAction(channel.guild, log.executor, 'webhook_create');

                // Auto-delete webhook if punished
                if (punished) {
                    const webhook = log.target;
                    // We need to fetch the webhook to delete it usually, or use the one from log if valid
                    // Since log.target is partial usually, let's fetch webhooks in channel
                    const webhooks = await channel.fetchWebhooks();
                    const targetWebhook = webhooks.find(w => w.id === webhook.id);
                    if (targetWebhook) {
                        await targetWebhook.delete('Anti-Nuke Protection');
                        console.log(`[AntiNuke] Deleted unauthorized webhook in ${channel.name}`);
                    }
                }

            } catch (error) {
                // Ignore errors (permissions etc)
            }
        }, 1000);
    }
};
