/**
 * Vorn — AutoMod Manager
 * Advanced Anti-Spam & Anti-Link System
 */

const { PermissionFlagsBits } = require('discord.js');

class AutoModManager {
    constructor(client) {
        this.client = client;
        // memory cache for rate limits: `${guildId}-${userId}` -> [timestamps]
        this.spamCache = new Map();
        // memory cache for duplicate messages: `${guildId}-${userId}` -> { content, timestamp }
        this.duplicateCache = new Map();
    }

    /**
     * Get AutoMod config
     */
    async getConfig(guildId) {
        const config = await this.client.db.get(guildId, 'automod_config') || {};

        // Defaults
        if (!config.enabled) config.enabled = false;
        if (!config.logChannelId) config.logChannelId = null;
        if (config.exemptChannels === undefined) config.exemptChannels = [];
        if (config.exemptRoles === undefined) config.exemptRoles = [];
        if (config.ignoreAdmins === undefined) config.ignoreAdmins = false;
        if (config.whitelist === undefined) config.whitelist = [];

        // Anti-Spam Defaults
        if (!config.antispam) {
            config.antispam = {
                rate_limit: { enabled: false, limit: 5, time: 3000, action: 'mute', muteTime: 60, warningMessage: 'Please slow down your messages.' },
                mentions: { enabled: false, limit: 5, action: 'warn', warningMessage: 'Too many mentions in one message.' },
                caps: { enabled: false, threshold: 70, minLength: 10, action: 'warn', warningMessage: 'Please avoid using excessive caps.' },
                newlines: { enabled: false, limit: 10, action: 'warn', warningMessage: 'Please avoid spamming newlines.' },
                duplicates: { enabled: false, time: 5000, action: 'mute', muteTime: 60, warningMessage: 'Please stop sending duplicate messages.' },
                emojis: { enabled: false, limit: 10, action: 'warn', warningMessage: 'Too many emojis in one message.' },
                zalgo: { enabled: false, limit: 20, action: 'warn', warningMessage: 'Zalgo/glitch text is not allowed here.' },
                mass_attachments: { enabled: false, limit: 3, action: 'warn', warningMessage: 'Too many attachments in one message.' }
            };
        }

        // New Filters (Words & Files)
        if (!config.words) {
            config.words = { enabled: false, list: [], action: 'delete', warningMessage: 'That word or phrase is not allowed here.' };
        }

        if (!config.files) {
            config.files = { enabled: false, blocked_extensions: [], action: 'delete', warningMessage: 'That file type is not allowed here.' };
        }

        // Anti-Link Defaults
        if (!config.antilink) {
            config.antilink = {
                enabled: false,
                block_invites: true,
                invite_action: 'delete',
                invite_warning: 'Discord invite links are forbidden.',
                block_all: false,
                allowlist: [], // Allowed domains
                blocklist: [], // Specific blocked domains (if block_all is false)
                action: 'delete', // delete, warn, mute
                warningMessage: 'Unauthorized links are not allowed.'
            };
        }

        return config;
    }

    /**
     * Save config
     */
    async setConfig(guildId, config) {
        await this.client.db.set(guildId, 'automod_config', config);
    }

    /**
     * Check if entity is exempt
     */
    async isExempt(guildId, member, channel) {
        const config = await this.getConfig(guildId);

        if (config.ignoreAdmins && member.permissions.has(PermissionFlagsBits.Administrator)) return true;

        // Check whitelist system
        // Note: We need to implement 'automod' in whitelist command
        // For now, check generic whitelist if implemented, otherwise rely on config exemptions
        if (this.client.antiNuke && await this.client.antiNuke.isWhitelistedByGuild(guildId, member.id, 'automod')) return true;

        if (!config.enabled) return true;

        if (config.whitelist && config.whitelist.includes(member.id)) return true;

        if (config.exemptChannels.includes(channel.id)) return true;
        if (member.roles.cache.some(r => config.exemptRoles.includes(r.id))) return true;

        return false;
    }

    /**
     * Main Message Handler
     */
    async handleMessage(message) {
        if (!message.guild || message.author.bot) return;
        if (await this.isExempt(message.guild.id, message.member, message.channel)) return;

        const config = await this.getConfig(message.guild.id);

        // Word Filter Check
        if (config.words.enabled) {
            if (await this.checkWords(message, config.words)) return;
        }

        // Anti-Link Check
        if (config.antilink.enabled) {
            if (await this.checkLinks(message, config.antilink)) return; // Stop if action taken
        }

        // File/Attachment Ext Filter
        if (config.files.enabled) {
            if (await this.checkFiles(message, config.files)) return;
        }

        // Anti-Spam Check
        if (await this.checkSpam(message, config.antispam)) return;
    }

    /**
     * Anti-Link Logic
     */
    async checkLinks(message, config) {
        const content = message.content.toLowerCase();
        // Regex for discord invites
        const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite|discord\.me|discord\.io|discord\.li|discord\.pl|discord\.st)\/([a-z0-9-]+)/i;
        // Regex for generic links
        const linkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i;

        let detected = false;
        let reason = '';
        let action = config.action;
        let warning = config.warningMessage;

        // Check Invites
        if (config.block_invites) {
            const inviteMatch = message.content.match(inviteRegex);
            if (inviteMatch) {
                detected = true;
                reason = 'Discord Invite Link';
                action = config.invite_action || config.action;
                warning = config.invite_warning || 'Discord invite links are forbidden.';

                // Attempt to resolve if it's local
                try {
                    const code = inviteMatch[1];
                    const invites = await message.guild.invites.fetch();
                    if (invites.has(code)) detected = false; // It's a local invite
                } catch { }
            }
        }

        // Check All Links
        if (!detected && config.block_all && linkRegex.test(message.content)) {
            // Check Allowlist
            const matches = message.content.match(linkRegex);
            if (matches) {
                const url = matches[0];
                const isAllowed = config.allowlist.some(domain => url.includes(domain));
                if (!isAllowed) {
                    detected = true;
                    reason = 'Unauthorized Link';
                }
            }
        }

        if (detected) {
            await this.executeAction(message, action, `Anti-Link: ${reason}`, warning);
            return true;
        }
        return false;
    }

    /**
     * Anti-Spam Logic
     */
    async checkSpam(message, config) {
        const { member, guild, channel } = message;

        // 1. Mentions
        if (config.mentions.enabled) {
            const mentionCount = message.mentions.users.size + message.mentions.roles.size;
            if (mentionCount > config.mentions.limit) {
                await this.executeAction(message, config.mentions.action, 'Mass Mentions', config.mentions.warningMessage);
                return true;
            }
        }

        // 2. Caps
        if (config.caps.enabled && message.content.length >= config.caps.minLength) {
            const capsCount = message.content.replace(/[^A-Z]/g, "").length;
            const percentage = (capsCount / message.content.length) * 100;
            if (percentage >= config.caps.threshold) {
                await this.executeAction(message, config.caps.action, 'Excessive Caps', config.caps.warningMessage);
                return true;
            }
        }

        // 3. Newlines
        if (config.newlines.enabled) {
            const newlines = (message.content.match(/\n/g) || []).length;
            if (newlines > config.newlines.limit) {
                await this.executeAction(message, config.newlines.action, 'Vertical Spam', config.newlines.warningMessage);
                return true;
            }
        }

        // 4. Emojis
        if (config.emojis.enabled) {
            const emojiRegex = /<a?:.+?:\d+>|\p{Emoji_Presentation}/gu;
            const emojis = (message.content.match(emojiRegex) || []).length;
            if (emojis > config.emojis.limit) {
                await this.executeAction(message, config.emojis.action, 'Mass Emojis', config.emojis.warningMessage);
                return true;
            }
        }

        // 5. Zalgo / Glitch Text
        if (config.zalgo?.enabled) {
            // Checks for combining characters (mark non-spacing)
            const zalgoRegex = /[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g;
            const marks = (message.content.match(zalgoRegex) || []).length;
            const threshold = config.zalgo.limit || 20; // Default 20 marks
            if (marks > threshold) {
                await this.executeAction(message, config.zalgo.action, 'Zalgo/Glitch Text', config.zalgo.warningMessage);
                return true;
            }
        }

        // 6. Stickers / Attachments
        if (config.mass_attachments?.enabled) {
            const count = message.stickers.size + message.attachments.size;
            const limit = config.mass_attachments.limit || 3;
            if (count > limit) {
                await this.executeAction(message, config.mass_attachments.action, 'Mass Attachments/Stickers', config.mass_attachments.warningMessage);
                return true;
            }
        }

        // 7. Duplicates (Fuzzy Matching)
        if (config.duplicates.enabled) {
            const key = `${guild.id}-${member.id}`;
            const lastMsg = this.duplicateCache.get(key);
            const now = Date.now();

            if (lastMsg && (now - lastMsg.timestamp) < config.duplicates.time) {
                // Calculate similarity (Levenshtein-like simplified for speed)
                const similarity = this.calculateSimilarity(message.content, lastMsg.content);

                // > 85% match considered duplicate
                if (similarity > 0.85) {
                    await this.executeAction(message, config.duplicates.action, 'Duplicate Text', config.duplicates.warningMessage, config.duplicates.muteTime);
                    return true;
                }
            }
            this.duplicateCache.set(key, { content: message.content, timestamp: now });
        }

        // 8. Rate Limit (Speed)
        if (config.rate_limit.enabled) {
            const key = `${guild.id}-${member.id}`;
            const timestamps = this.spamCache.get(key) || [];
            const now = Date.now();

            const filtered = timestamps.filter(t => (now - t) < config.rate_limit.time);
            filtered.push(now);
            this.spamCache.set(key, filtered);

            if (filtered.length > config.rate_limit.limit) {
                this.spamCache.set(key, []); // Reset
                await this.executeAction(message, config.rate_limit.action, 'Fast Messaging', config.rate_limit.warningMessage, config.rate_limit.muteTime);
                return true;
            }
        }

        return false;
    }

    /**
     * Calculate string similarity (0.0 to 1.0)
     */
    calculateSimilarity(s1, s2) {
        if (s1 === s2) return 1.0;
        if (s1.length < 2 || s2.length < 2) return 0.0;

        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        const longerLength = longer.length;

        if (longerLength === 0) return 1.0;

        // Simple edit distance
        const costs = new Array();
        for (let i = 0; i <= longer.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= shorter.length; j++) {
                if (i == 0) costs[j] = j;
                else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (longer.charAt(i - 1) != shorter.charAt(j - 1))
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[shorter.length] = lastValue;
        }

        return (longerLength - costs[shorter.length]) / parseFloat(longerLength);
    }

    /**
     * Anti-Link Logic
     */
    async checkLinks(message, config) {
        const content = message.content.toLowerCase();
        // Regex for discord invites
        const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite|discord\.me|discord\.io|discord\.li|discord\.pl|discord\.st)\/([a-z0-9-]+)/i;
        // Regex for generic links
        const linkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i;

        let detected = false;
        let reason = '';

        // Check Invites
        if (config.block_invites) {
            const inviteMatch = message.content.match(inviteRegex);
            if (inviteMatch) {
                // Smart Check: Allow invites for THIS server
                // We'd ideally fetch the invite, but that's slow.
                // For now, we rely on user whitelist, or we can async fetch.
                // A safe comprehensive approach:
                // If it's an invite, and we block invites, defaulting to block is safer.
                detected = true;
                reason = 'Discord Invite Link';

                // Attempt to resolve if it's local (Optional optimization)
                try {
                    const code = inviteMatch[1];
                    const invites = await message.guild.invites.fetch();
                    if (invites.has(code)) detected = false; // It's a local invite
                } catch { }
            }
        }

        // Check All Links
        if (!detected && config.block_all && linkRegex.test(message.content)) {
            // Check Allowlist
            const matches = message.content.match(linkRegex);
            if (matches) {
                const url = matches[0];
                const isAllowed = config.allowlist.some(domain => url.includes(domain));
                if (!isAllowed) {
                    detected = true;
                    reason = 'Unauthorized Link';
                }
            }
        }

        if (detected) {
            await this.executeAction(message, config.action, `Anti-Link: ${reason}`);
            return true;
        }
        return false;
    }

    /**
     * File Extension Logic
     */
    async checkFiles(message, config) {
        if (!message.attachments.size || config.blocked_extensions.length === 0) return false;

        const blockedExts = config.blocked_extensions.map(ext => ext.toLowerCase());

        for (const attachment of message.attachments.values()) {
            const fileName = attachment.name.toLowerCase();
            const extMatch = fileName.match(/\.[^.]+$/);
            const ext = extMatch ? extMatch[0] : '';

            if (blockedExts.includes(ext) || blockedExts.includes(ext.substring(1))) {
                await this.executeAction(message, config.action, `Blocked File Extension (${ext})`, config.warningMessage);
                return true;
            }
        }

        return false;
    }

    /**
     * Word/Phrase Filter Logic
     */
    async checkWords(message, config) {
        if (config.list.length === 0) return false;

        const content = message.content.toLowerCase();
        let detectedWord = null;

        for (const filter of config.list) {
            if (filter.type === 'exact') {
                const words = content.split(/[\s,.;!?]+/);
                if (words.includes(filter.word.toLowerCase())) {
                    detectedWord = filter.word;
                    break;
                }
            } else if (filter.type === 'contains') {
                if (content.includes(filter.word.toLowerCase())) {
                    detectedWord = filter.word;
                    break;
                }
            } else if (filter.type === 'regex') {
                try {
                    const regex = new RegExp(filter.word, 'i');
                    if (regex.test(content)) {
                        detectedWord = filter.word;
                        break;
                    }
                } catch { } // Ignore bad regex
            }
        }

        if (detectedWord) {
            await this.executeAction(message, config.action, `Blacklisted Word/Phrase (${detectedWord})`, config.warningMessage);
            return true;
        }

        return false;
    }

    /**
     * Execute Punishment
     */
    async executeAction(message, action, reason, warningMessage = null, duration = 60) {
        try {
            if (message.deletable) await message.delete().catch(() => { });

            const member = message.member;
            if (!member) return;

            // Notify user
            const notify = async (act) => {
                try {
                    const embed = this.client.embeds.error(
                        `AutoMod Action: ${act}`,
                        warningMessage ? `${warningMessage}\n\n**Reason:** ${reason}` : `You triggered AutoMod in **${message.guild.name}**\n**Reason:** ${reason}`
                    );
                    await member.send({ embeds: [embed] });
                } catch { }
            };

            switch (action) {
                case 'warn':
                    const displayMsg = warningMessage ? `${member}, ${warningMessage}` : `${member}, please stop! Reason: ${reason}`;
                    const warnEmbed = this.client.embeds.warn('AutoMod', displayMsg);
                    const wMsg = await message.channel.send({ content: `${member}`, embeds: [warnEmbed] });
                    setTimeout(() => wMsg.delete().catch(() => { }), 5000);
                    break;
                case 'mute':
                    if (member.moderatable) {
                        await member.timeout(duration * 1000, `AutoMod: ${reason}`);
                        await notify(`Muted for ${duration}s`);
                        message.channel.send(`**${member.user.tag}** has been muted for ${duration}s \u2500 ${reason}`).then(m => setTimeout(() => m.delete().catch(() => { }), 5000));
                    }
                    break;
                case 'kick':
                    if (member.kickable) {
                        await notify('Kicked');
                        await member.kick(`AutoMod: ${reason}`);
                        message.channel.send(`**${member.user.tag}** has been kicked \u2500 ${reason}`);
                    }
                    break;
                case 'ban':
                    if (member.bannable) {
                        await notify('Banned');
                        await member.ban({ reason: `AutoMod: ${reason}` });
                        message.channel.send(`**${member.user.tag}** has been banned \u2500 ${reason}`);
                    }
                    break;
            }

            // Centralized Logging
            this.logAutoModAction(message, action, reason);

        } catch (error) {
            console.error(`[AutoMod] Action failed: ${error.message}`);
        }
    }

    async logAutoModAction(message, action, reason) {
        try {
            const config = await this.getConfig(message.guild.id);
            if (!config.logChannelId) return;

            const logChannel = message.guild.channels.cache.get(config.logChannelId);
            if (!logChannel?.isTextBased()) return;

            const embed = this.client.embeds.create()
                .setTitle('AutoMod Action Taken')
                .setColor('#ff0000') // Red for automod
                .setDescription([
                    `**User** ─ ${message.author} \`[${message.author.id}]\``,
                    `**Action** ─ \`${action.toUpperCase()}\``,
                    `**Reason** ─ ${reason}`,
                    `**Channel** ─ ${message.channel}`,
                    '',
                    `**Content (Truncated)**`,
                    `\`\`\`\n${message.content.substring(0, 500).replace(/`/g, '')}\n\`\`\``
                ].join('\n'))
                .setFooter({ text: 'Vorn Security', iconURL: this.client.user.displayAvatarURL() })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => { });
        } catch { }
    }
}

module.exports = AutoModManager;
