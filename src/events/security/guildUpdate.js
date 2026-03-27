/**
 * Vorn — Guild Update Event
 * Anti-Nuke: Detects unauthorized server changes (name, icon, etc.)
 */

const { AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'guildUpdate',
    async execute(oldGuild, newGuild, client) {
        if (!client.antiNuke) return;

        // Check what changed
        const nameChanged = oldGuild.name !== newGuild.name;
        const iconChanged = oldGuild.icon !== newGuild.icon;
        const bannerChanged = oldGuild.banner !== newGuild.banner;
        const vanityChanged = oldGuild.vanityURLCode !== newGuild.vanityURLCode;

        if (!nameChanged && !iconChanged && !bannerChanged && !vanityChanged) return;

        setTimeout(async () => {
            try {
                const logs = await newGuild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.GuildUpdate
                });

                const log = logs.entries.first();
                if (!log) return;

                // Handle anti-nuke
                const punished = await client.antiNuke.handleAction(newGuild, log.executor, 'guild_update');

                // Auto-revert if punished
                if (punished) {
                    // We can try to revert changes if we have permission
                    if (nameChanged) await newGuild.setName(oldGuild.name, 'Anti-Nuke Revert');
                    if (iconChanged) await newGuild.setIcon(oldGuild.iconURL(), 'Anti-Nuke Revert');
                    if (bannerChanged) await newGuild.setBanner(oldGuild.bannerURL(), 'Anti-Nuke Revert');
                    // Vanity URL cannot always be reverted easily if stolen, but we can try
                    // Note: Vanity URL requires Level 3 usually
                }

            } catch (error) {
                console.error(`[AntiNuke] Guild Update Error: ${error.message}`);
            }
        }, 1000);
    }
};
