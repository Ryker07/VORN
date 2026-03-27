/**
 * Vorn — /botinfo Command
 * Displays comprehensive bot statistics with feature status
 */

const { SlashCommandBuilder, version: djsVersion } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');
const os = require('os');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('View information about Vorn'),

    async execute(interaction, client) {
        await interaction.deferReply();

        let attachment = null;
        try {
            const GuideRenderer = require('../../utils/GuideRenderer');
            if (GuideRenderer.isAvailable()) {
                const buffer = await GuideRenderer.render('SYSTEM', 'OPERATIONAL STATUS');
                const { AttachmentBuilder } = require('discord.js');
                attachment = new AttachmentBuilder(buffer, { name: 'banner.png' });
            }
        } catch { }

        // Calculate uptime
        const uptime = formatUptime(client.uptime);

        // Get statistics
        const serverCount = client.guilds.cache.size;
        const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const channelCount = client.channels.cache.size;

        // Memory usage
        const memUsage = process.memoryUsage();
        const memUsed = formatBytes(memUsage.heapUsed);
        const memTotal = formatBytes(memUsage.rss);

        // Ping
        const ping = client.ws.ping;

        // Database stats
        const dbStats = client.db ? client.db.getStats() : null;

        // Feature status
        const features = [];
        if (client.antiNuke) features.push('Anti-Nuke');
        if (client.automod) features.push('AutoMod');
        if (client.moderation) features.push('Moderation');
        if (client.ticketManager) features.push('Tickets');
        if (client.giveawayManager) features.push('Giveaways');
        if (client.reactionRoles) features.push('Roles');

        const featureStr = features.length > 0 ? features.join(' · ') : 'None';

        // Build embed
        const embed = VornEmbed.create()
            .setImage(attachment ? 'attachment://banner.png' : null)
            .addFields(
                // Row 1: Vital Stats
                { name: 'Latency', value: `\`${ping}ms\``, inline: true },
                { name: 'Memory', value: `\`${memUsed}\``, inline: true },
                { name: 'Uptime', value: `\`${uptime}\``, inline: true },

                // Row 2: Scale
                { name: 'Servers', value: `\`${serverCount}\``, inline: true },
                { name: 'Users', value: `\`${userCount.toLocaleString()}\``, inline: true },
                { name: 'Channels', value: `\`${channelCount.toLocaleString()}\``, inline: true },

                // Row 3: Platform
                { name: 'System', value: `\`${os.platform()} ${os.arch()}\``, inline: true },
                { name: 'Library', value: `\`DJS v${djsVersion}\``, inline: true },
                { name: 'Database', value: `\`${dbStats?.cachedServers || 0} Cached\``, inline: true },

                // Full Code Block for Modules
                { name: 'Active Systems', value: `\`\`\`${featureStr}\`\`\``, inline: false }
            );

        const payload = { embeds: [embed] };
        if (attachment) payload.files = [attachment];

        await interaction.editReply(payload);
    }
};

/**
 * Format uptime to human readable string
 */
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours % 24 > 0) parts.push(`${hours % 24}h`);
    if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
    if (seconds % 60 > 0 || parts.length === 0) parts.push(`${seconds % 60}s`);

    return parts.join(' ');
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}
