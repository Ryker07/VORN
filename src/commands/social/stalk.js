/**
 * Vorn — /stalk Command
 * Advanced Instagram Profile Lookup
 */

const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

const APIFY_TOKEN = require('../../../config.json').apifyToken || process.env.APIFY_TOKEN;
const APIFY_ACTOR = 'apify~instagram-profile-scraper';

const INVISIBLE = 0x2b2d31;

/**
 * Format large numbers (1234567 → 1.2M)
 */
function formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
}

/**
 * Calculate engagement rate
 */
function getEngagementRate(profile) {
    if (!profile.followersCount || !profile.latestPosts?.length) return null;
    const totalLikes = profile.latestPosts.reduce((sum, p) => sum + (p.likesCount || 0), 0);
    const totalComments = profile.latestPosts.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
    const avgEngagement = (totalLikes + totalComments) / profile.latestPosts.length;
    return ((avgEngagement / profile.followersCount) * 100).toFixed(2);
}

/**
 * Build status badges (no emojis)
 */
function getBadges(profile) {
    const badges = [];
    if (profile.verified) badges.push('Verified');
    if (profile.private) badges.push('Private');
    if (profile.isBusinessAccount) badges.push('Business');
    if (profile.isProfessionalAccount) badges.push('Creator');
    if (!badges.length) badges.push('Personal');
    return badges.join(' · ');
}

/**
 * Get account tier based on followers
 */
function getFollowerTier(count) {
    if (count >= 10_000_000) return 'Celebrity';
    if (count >= 1_000_000) return 'Mega Influencer';
    if (count >= 100_000) return 'Macro Influencer';
    if (count >= 10_000) return 'Micro Influencer';
    if (count >= 1_000) return 'Rising Creator';
    return 'Growing Account';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stalk')
        .setDescription('Look up an Instagram profile')
        .addStringOption(opt =>
            opt.setName('username')
                .setDescription('Instagram username (without @)')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        await interaction.deferReply();

        const rawUsername = interaction.options.getString('username');
        const username = rawUsername
            .replace(/^@/, '')
            .replace(/https?:\/\/(www\.)?instagram\.com\//, '')
            .replace(/\//g, '')
            .trim()
            .toLowerCase();

        if (!username || username.length < 1) {
            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(INVISIBLE)
                    .setDescription('**Error** ─ Please provide a valid Instagram username.')]
            });
        }

        try {
            console.log(`[Stalk] Looking up: ${username}`);
            const profile = await fetchProfile(username);

            if (!profile) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(INVISIBLE)
                        .setDescription(`**Error** ─ Could not find Instagram user \`${username}\`.`)]
                });
            }

            const engagementRate = getEngagementRate(profile);
            const tier = getFollowerTier(profile.followersCount || 0);
            const badges = getBadges(profile);

            // F/F Ratio
            const ratio = profile.followersCount && profile.followsCount
                ? (profile.followersCount / profile.followsCount).toFixed(1)
                : null;

            // ═══════════════════════════════════════════
            // MAIN EMBED — Clean, no emojis
            // ═══════════════════════════════════════════

            const descLines = [
                `**@${profile.username}**`,
                `-# ${badges}`,
                '',
                profile.biography || '*No bio*',
            ];

            if (profile.externalUrl) {
                const cleanLink = profile.externalUrl.replace(/https?:\/\/(www\.)?/, '').replace(/\/$/, '');
                descLines.push(`[${cleanLink}](${profile.externalUrl})`);
            }

            const embed = new EmbedBuilder()
                .setColor(INVISIBLE)
                .setAuthor({
                    name: profile.fullName || username,
                    iconURL: profile.profilePicUrlHD || profile.profilePicUrl,
                    url: `https://www.instagram.com/${profile.username}/`
                })
                .setThumbnail(profile.profilePicUrlHD || profile.profilePicUrl)
                .setDescription(descLines.join('\n'))
                .addFields(
                    { name: 'Followers', value: `\`${formatNumber(profile.followersCount)}\``, inline: true },
                    { name: 'Following', value: `\`${formatNumber(profile.followsCount)}\``, inline: true },
                    { name: 'Posts', value: `\`${formatNumber(profile.postsCount)}\``, inline: true },
                )
                .setFooter({ text: `${tier} · Requested by ${interaction.user.username}` })
                .setTimestamp();

            // Optional fields
            if (engagementRate) {
                embed.addFields({ name: 'Engagement', value: `\`${engagementRate}%\``, inline: true });
            }

            if (ratio && ratio !== 'Infinity') {
                embed.addFields({ name: 'F/F Ratio', value: `\`${ratio}:1\``, inline: true });
            }

            if (profile.businessCategoryName) {
                embed.addFields({ name: 'Category', value: `\`${profile.businessCategoryName}\``, inline: true });
            }

            if (profile.igtvVideoCount > 0) {
                embed.addFields({ name: 'IGTV', value: `\`${profile.igtvVideoCount}\``, inline: true });
            }

            // ═══════════════════════════════════════════
            // RECENT POSTS
            // ═══════════════════════════════════════════

            const embeds = [embed];

            if (profile.latestPosts?.length > 0 && !profile.private) {
                const recentPosts = profile.latestPosts.slice(0, 6);
                const postsLines = recentPosts.map(post => {
                    const type = post.type === 'Video' ? 'VID' : 'IMG';
                    const likes = formatNumber(post.likesCount || 0);
                    const comments = formatNumber(post.commentsCount || 0);
                    const caption = (post.caption || 'No caption').substring(0, 40);
                    return `\`${type}\` ┃ \`${likes}\` likes · \`${comments}\` comments ─ *${caption}${post.caption?.length > 40 ? '...' : ''}*`;
                });

                const postsEmbed = new EmbedBuilder()
                    .setColor(INVISIBLE)
                    .setTitle('Recent Posts')
                    .setDescription(postsLines.join('\n'))
                    .setImage(recentPosts[0].displayUrl || recentPosts[0].url || null);

                embeds.push(postsEmbed);
            }

            // ═══════════════════════════════════════════
            // ACTION BUTTONS
            // ═══════════════════════════════════════════

            const profileUrl = `https://www.instagram.com/${profile.username}/`;
            const pfpUrl = profile.profilePicUrlHD || profile.profilePicUrl || null;

            const buttons = [
                new ButtonBuilder()
                    .setLabel('Open Profile')
                    .setStyle(ButtonStyle.Link)
                    .setURL(profileUrl)
            ];

            // Discord buttons cap at 512 chars for URL
            if (pfpUrl && pfpUrl.length <= 512) {
                buttons.push(
                    new ButtonBuilder()
                        .setLabel('View Profile Picture')
                        .setStyle(ButtonStyle.Link)
                        .setURL(pfpUrl)
                );
            }

            const row = new ActionRowBuilder().addComponents(...buttons);

            await interaction.editReply({ embeds, components: [row] });

        } catch (error) {
            console.error(`[Stalk] Error: ${error.message}`);
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(INVISIBLE)
                    .setDescription(`**Error** ─ ${error.message}`)]
            });
        }
    }
};

/**
 * Fetch profile from Apify with retry
 */
async function fetchProfile(username, retries = 2) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.post(
                `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
                { usernames: [username] },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
                }
            );

            const items = response.data;
            if (!items || !items.length) {
                console.error(`[Stalk] Apify attempt ${attempt}/${retries}: empty response`);
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                return null;
            }

            console.log(`[Stalk] Resolved on attempt ${attempt}`);
            return items[0];

        } catch (e) {
            console.error(`[Stalk] Apify attempt ${attempt}/${retries} failed: ${e.message}`);
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }
            return null;
        }
    }
    return null;
}
