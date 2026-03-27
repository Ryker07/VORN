/**
 * Vorn — Reels Manager
 * Advanced Instagram Reels posting system with native upload support
 */

const { AttachmentBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Apify Config
let APIFY_TOKEN = process.env.APIFY_TOKEN;
try { if (!APIFY_TOKEN) APIFY_TOKEN = require('../../../config.json').apifyToken; } catch (e) {}
const APIFY_ACTOR = 'presetshubham~instagram-reel-downloader';

class ReelsManager {
    constructor(client) {
        this.client = client;
    }

    // ═══════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════

    async getConfig(guildId) {
        const config = await this.client.db.get(guildId, 'social_reels') || {};
        return {
            enabled: false,
            channelId: null,
            roleIds: [], // Publisher roles
            pingRoleId: null, // Motivation/Notification role
            autoCleanup: true, // Delete command message
            ...config
        };
    }

    async setConfig(guildId, config) {
        await this.client.db.set(guildId, 'social_reels', config);
    }

    // ═══════════════════════════════════════════════════════════════
    // CORE LOGIC
    // ═══════════════════════════════════════════════════════════════

    /**
     * Resolve and post a reel
     * @param {Interaction} interaction 
     * @param {string} url 
     * @param {string} caption 
     * @param {import('discord.js').GuildChannel} [targetChannelOverride]
     */
    async postReel(interaction, url, caption, targetChannelOverride = null) {
        // Defer immediately to prevent "Unknown interaction" timeout
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        const member = interaction.member;

        // Load Config
        const config = await this.getConfig(guild.id);

        let targetChannelId = targetChannelOverride ? targetChannelOverride.id : config.channelId;

        if (!targetChannelId) {
            return interaction.editReply({
                embeds: [VornEmbed.error('Setup Required', 'No target channel configured. Use `/reels setup channel` first, or specify a channel in the command.')]
            });
        }

        const channel = guild.channels.cache.get(targetChannelId);
        if (!channel) {
            return interaction.editReply({
                embeds: [VornEmbed.error('Invalid Channel', 'The target channel no longer exists or the bot cannot see it.')]
            });
        }

        // Check Permissions
        if (config.roleIds.length > 0) {
            const hasRole = member.roles.cache.some(r => config.roleIds.includes(r.id));
            if (!hasRole && !member.permissions.has('Administrator')) {
                return interaction.editReply({
                    embeds: [VornEmbed.error('Permission Denied', 'You do not have the required role to post reels.')]
                });
            }
        }

        try {
            // 1. Clean URL
            const cleanUrl = this.cleanInstagramUrl(url);
            if (!cleanUrl) {
                throw new Error('Invalid Instagram URL. Please use a link like `instagram.com/reel/...`');
            }

            // 2. Resolve Video via Apify API (with retry)
            console.log(`[Reels] Resolving via Apify: ${cleanUrl}`);
            const videoData = await this.resolveViaApify(cleanUrl);

            if (!videoData || !videoData.videoUrl) {
                throw new Error('Could not resolve video URL. The post might be private or deleted.');
            }

            // 3. Download Video
            const uploadLimit = guild.premiumTier > 1 ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
            const tempPath = path.join(__dirname, `temp_${Date.now()}.mp4`);

            try {
                await this.downloadVideo(videoData.videoUrl, tempPath);
                const stats = fs.statSync(tempPath);

                if (stats.size <= uploadLimit) {
                    // 4. Upload video directly — no text, just the video
                    const attachment = new AttachmentBuilder(tempPath, { name: 'reel.mp4' });
                    await channel.send({ files: [attachment] });
                } else {
                    // Fallback: send link if too large
                    await channel.send({ content: url });
                }
            } catch (dlErr) {
                console.error(`[Reels] Download failed: ${dlErr.message}`);
                // Fallback: send link
                await channel.send({ content: url });
            }

            // 5. Cleanup temp file
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { }

            // 6. Confirm
            await interaction.editReply({
                embeds: [VornEmbed.success('Reel Posted', `Successfully posted to ${channel}`)]
            });

        } catch (error) {
            console.error(`[Reels] Error: ${error.message}`);
            await interaction.editReply({
                embeds: [VornEmbed.error('Resolution Failed', error.message)]
            });
        }
    }

    /**
     * Clean Instagram URL — extract shortcode and ignore query params
     */
    cleanInstagramUrl(url) {
        const regex = /(?:instagram\.com\/(?:reel|reels|p)\/)([a-zA-Z0-9_-]+)/;
        const match = url.match(regex);
        if (!match) return null;
        return `https://www.instagram.com/reel/${match[1]}/`;
    }

    /**
     * Resolve video using Apify Instagram Reel Downloader
     * Includes retry logic for intermittent failures
     * Returns { videoUrl, title, author }
     */
    async resolveViaApify(cleanUrl, retries = 2) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await axios.post(
                    `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
                    {
                        reelLinks: [cleanUrl],
                        proxyConfiguration: { useApifyProxy: true }
                    },
                    {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 60000 // 60s timeout
                    }
                );

                const items = response.data;
                if (!items || !items.length || !items[0].video_url) {
                    console.error(`[Reels] Apify attempt ${attempt}/${retries}: no video data`);
                    if (attempt < retries) {
                        console.log(`[Reels] Retrying in 2s...`);
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }
                    return null;
                }

                const item = items[0];
                console.log(`[Reels] Resolved on attempt ${attempt}`);
                return {
                    videoUrl: item.video_url,
                    title: item.caption || item.description || '',
                    author: item.owner_username || item.username || item.ownerUsername || ''
                };

            } catch (e) {
                console.error(`[Reels] Apify attempt ${attempt}/${retries} failed: ${e.message}`);
                if (attempt < retries) {
                    console.log(`[Reels] Retrying in 2s...`);
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                return null;
            }
        }
        return null;
    }

    /**
     * Download video from URL to a local file (stream-based)
     */
    async downloadVideo(url, filePath) {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 60000
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }
}

module.exports = ReelsManager;
