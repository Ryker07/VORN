/**
 * Vorn — Welcome & Goodbye System Manager
 * Premium welcome system with canvas banners, embeds, auto-roles, goodbye messages,
 * milestone celebrations, invite tracking, and DM support
 */

const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const VornEmbed = require('../utils/embedBuilder');

class WelcomeManager {
    constructor(client) {
        this.client = client;

        this.defaultConfig = {
            enabled: false,
            channelId: null,

            // Message options
            message: {
                content: '',
                variants: [],
                embed: {
                    enabled: true,
                    color: '#2b2d31',
                    title: '',
                    description: 'Welcome {user}',
                    thumbnail: '{avatar}',
                    image: '',
                    footer: '',
                    fields: []
                },
                buttons: []
            },

            // Canvas banner
            canvas: {
                enabled: false,
                template: 'obsidian',
                background: '',
                avatarStyle: 'circle',
                textColor: null,
                accentColor: null,
                overlayOpacity: 0.6,
                showMemberCount: true,
                scanlines: false
            },

            // Goodbye/Leave messages
            goodbye: {
                enabled: false,
                channelId: null,
                content: '',
                embed: {
                    enabled: true,
                    color: '#2b2d31',
                    title: '',
                    description: '**{user.name}** left the server',
                    thumbnail: '',
                    footer: 'We now have {memberCount} members',
                    fields: []
                },
                canvas: {
                    enabled: false,
                    template: 'obsidian'
                }
            },

            // Milestones
            milestones: {
                enabled: false,
                channelId: null,
                targets: [100, 500, 1000, 5000, 10000],
                message: 'We just hit **{count}** members!'
            },

            // Invite tracking
            invites: {
                enabled: false,
                showInWelcome: true
            },

            // Auto-roles
            autoroles: [],

            // Stacked roles (give different roles at different member counts)
            stackedRoles: [],

            // Bot settings
            bots: {
                ignore: true,
                channelId: null,
                roleIds: []
            },

            // Security logs
            logs: {
                enabled: false,
                channelId: null,
                accountAge: 7 // Days threshold for warning
            },

            // DM welcome
            dm: {
                enabled: false,
                delay: 0,
                content: 'Welcome to **{server}**!',
                embed: {
                    enabled: false,
                    color: '#2b2d31',
                    title: 'Welcome!',
                    description: 'Thanks for joining **{server}**!',
                    thumbnail: '{server.icon}',
                    image: '',
                    footer: '',
                    fields: []
                }
            },

            // Options
            autoDelete: 0,
            pingUser: false,
            deleteOnLeave: false
        };

        // Placeholder definitions
        this.placeholders = {
            // User placeholders
            '{user}': (m) => `<@${m.id}>`,
            '{user.tag}': (m) => m.user.tag,
            '{user.name}': (m) => m.user.username,
            '{user.displayName}': (m) => m.displayName,
            '{user.id}': (m) => m.id,
            '{username}': (m) => m.user.username,
            '{mention}': (m) => `<@${m.id}>`,
            '{avatar}': (m) => m.user.displayAvatarURL({ extension: 'png', size: 512 }),

            // Server placeholders
            '{server}': (m) => m.guild.name,
            '{server.id}': (m) => m.guild.id,
            '{server.icon}': (m) => m.guild.iconURL({ extension: 'png', size: 512 }) || '',
            '{guild}': (m) => m.guild.name,

            // Count placeholders
            '{memberCount}': (m) => m.guild.memberCount.toString(),
            '{memberCount.ordinal}': (m) => this.getOrdinal(m.guild.memberCount),
            '{count}': (m) => m.guild.memberCount.toString(),

            // Date placeholders
            '{createdAt}': (m) => `<t:${Math.floor(m.user.createdTimestamp / 1000)}:D>`,
            '{joinedAt}': (m) => `<t:${Math.floor(m.joinedTimestamp / 1000)}:D>`,
            '{createdAt.relative}': (m) => `<t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`,
            '{joinedAt.relative}': (m) => `<t:${Math.floor(m.joinedTimestamp / 1000)}:R>`,
            '{date}': () => new Date().toLocaleDateString(),
            '{time}': () => new Date().toLocaleTimeString(),

            // Invite placeholders (set dynamically)
            '{inviter}': (m, ctx) => ctx?.inviter ? `<@${ctx.inviter.id}>` : 'Unknown',
            '{inviter.name}': (m, ctx) => ctx?.inviter?.username || 'Unknown',
            '{inviter.count}': (m, ctx) => ctx?.inviterUses?.toString() || '0'
        };
    }

    getOrdinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    parsePlaceholders(text, member, context = {}) {
        if (!text) return text;

        let result = text;
        for (const [placeholder, resolver] of Object.entries(this.placeholders)) {
            const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            result = result.replace(new RegExp(escaped, 'g'), resolver(member, context));
        }
        return result;
    }

    async getConfig(guildId) {
        const stored = await this.client.db.get(guildId, 'welcome') || {};

        return {
            ...this.defaultConfig,
            ...stored,
            message: {
                ...this.defaultConfig.message,
                ...(stored.message || {}),
                embed: {
                    ...this.defaultConfig.message.embed,
                    ...(stored.message?.embed || {})
                }
            },
            canvas: {
                ...this.defaultConfig.canvas,
                ...(stored.canvas || {})
            },
            goodbye: {
                ...this.defaultConfig.goodbye,
                ...(stored.goodbye || {}),
                embed: {
                    ...this.defaultConfig.goodbye.embed,
                    ...(stored.goodbye?.embed || {})
                },
                canvas: {
                    ...this.defaultConfig.goodbye.canvas,
                    ...(stored.goodbye?.canvas || {})
                }
            },
            milestones: {
                ...this.defaultConfig.milestones,
                ...(stored.milestones || {})
            },
            invites: {
                ...this.defaultConfig.invites,
                ...(stored.invites || {})
            },
            dm: {
                ...this.defaultConfig.dm,
                ...(stored.dm || {}),
                embed: {
                    ...this.defaultConfig.dm.embed,
                    ...(stored.dm?.embed || {})
                }
            },
            logs: {
                ...this.defaultConfig.logs,
                ...(stored.logs || {})
            },
            bots: {
                ...this.defaultConfig.bots,
                ...(stored.bots || {})
            }
        };
    }

    async setConfig(guildId, config) {
        await this.client.db.set(guildId, 'welcome', config);
    }

    async updateConfig(guildId, path, value) {
        const config = await this.getConfig(guildId);
        const keys = path.split('.');
        let obj = config;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in obj)) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;

        await this.setConfig(guildId, config);
        return config;
    }

    buildEmbed(embedConfig, member, context = {}) {
        if (!embedConfig.enabled) return null;

        const embed = new EmbedBuilder();

        if (embedConfig.color) {
            try {
                embed.setColor(embedConfig.color);
            } catch {
                embed.setColor('#2b2d31');
            }
        }

        if (embedConfig.title) {
            embed.setTitle(this.parsePlaceholders(embedConfig.title, member, context));
        }

        if (embedConfig.description) {
            embed.setDescription(this.parsePlaceholders(embedConfig.description, member, context));
        } else {
            // Fallback to prevent API error
            embed.setDescription(this.parsePlaceholders('Welcome {user}!', member, context));
        }

        if (embedConfig.thumbnail) {
            const url = this.parsePlaceholders(embedConfig.thumbnail, member, context);
            if (url) embed.setThumbnail(url);
        }

        if (embedConfig.image) {
            const url = this.parsePlaceholders(embedConfig.image, member, context);
            if (url) embed.setImage(url);
        }

        if (embedConfig.footer) {
            embed.setFooter({ text: this.parsePlaceholders(embedConfig.footer, member, context) });
        }

        if (embedConfig.fields && Array.isArray(embedConfig.fields)) {
            for (const field of embedConfig.fields) {
                embed.addFields({
                    name: this.parsePlaceholders(field.name, member, context),
                    value: this.parsePlaceholders(field.value, member, context),
                    inline: field.inline ?? false
                });
            }
        }

        embed.setTimestamp();
        return embed;
    }

    /**
     * Handle member join
     */
    async handleJoin(member) {
        try {
            const config = await this.getConfig(member.guild.id);
            if (!config.enabled) return;

            // Track invite (delegate to InviteManager)
            let inviteContext = {};
            if (config.invites.enabled && this.client.invites) {
                const joinData = this.client.invites.getLastJoin(member.guild.id, member.id);
                if (joinData && joinData.inviter) {
                    inviteContext = {
                        inviter: joinData.inviter,
                        inviterUses: joinData.inviterUses
                    };
                }
            }

            // Handle bots
            if (member.user.bot) {
                if (config.bots?.ignore) return;

                if (config.bots?.roleIds?.length > 0) {
                    await this.assignAutoRoles(member, config.bots.roleIds);
                }

                const botChannelId = config.bots?.channelId || config.channelId;
                if (botChannelId) {
                    await this.sendBotWelcome(member, botChannelId);
                }
                return;
            }

            // Security logs
            if (config.logs?.enabled && config.logs?.channelId) {
                this.sendLog(member, config);
            }

            // Auto-roles
            if (config.autoroles?.length > 0) {
                await this.assignAutoRoles(member, config.autoroles);
            }

            // Stacked roles based on member count
            if (config.stackedRoles?.length > 0) {
                await this.assignStackedRoles(member, config.stackedRoles);
            }

            // Channel welcome
            if (config.channelId) {
                await this.sendChannelWelcome(member, config, inviteContext);
            }

            // DM welcome
            if (config.dm.enabled) {
                if (config.dm.delay > 0) {
                    setTimeout(() => this.sendDMWelcome(member, config), config.dm.delay * 1000);
                } else {
                    await this.sendDMWelcome(member, config);
                }
            }

            // Check milestones
            if (config.milestones.enabled) {
                await this.checkMilestone(member, config);
            }

        } catch (error) {
            console.error(`[Vorn Welcome] Error handling join: ${error.message}`);
        }
    }

    /**
     * Handle member leave
     */
    async handleLeave(member) {
        try {
            const config = await this.getConfig(member.guild.id);

            if (!config.goodbye?.enabled) return;
            if (member.user.bot && config.bots?.ignore) return;

            const channelId = config.goodbye.channelId || config.channelId;
            if (!channelId) return;

            const channel = await member.guild.channels.fetch(channelId).catch(() => null);
            if (!channel) return;

            const messageOptions = {};

            // Content
            if (config.goodbye.content) {
                messageOptions.content = this.parsePlaceholders(config.goodbye.content, member);
            }

            // Embed
            const embed = this.buildEmbed(config.goodbye.embed, member);
            if (embed) {
                messageOptions.embeds = [embed];
            }

            // Goodbye canvas
            if (config.goodbye.canvas?.enabled) {
                try {
                    const CanvasWelcome = require('./CanvasWelcome');
                    const canvasConfig = {
                        ...config.goodbye.canvas,
                        template: config.goodbye.canvas.template || 'obsidian'
                    };
                    const banner = await CanvasWelcome.generate(member, canvasConfig);
                    const attachment = new AttachmentBuilder(banner, { name: 'goodbye.png' });
                    messageOptions.files = [attachment];

                    if (embed) {
                        embed.setImage('attachment://goodbye.png');
                    }
                } catch (err) {
                    console.error(`[Vorn Welcome] Goodbye canvas failed: ${err.message}`);
                }
            }

            await channel.send(messageOptions);

        } catch (error) {
            console.error(`[Vorn Welcome] Error handling leave: ${error.message}`);
        }
    }

    /**
     * Check and send milestone celebration
     */
    async checkMilestone(member, config) {
        const count = member.guild.memberCount;

        if (!config.milestones.targets.includes(count)) return;

        const channelId = config.milestones.channelId || config.channelId;
        if (!channelId) return;

        try {
            const channel = await member.guild.channels.fetch(channelId);
            if (!channel) return;

            const message = config.milestones.message
                .replace(/{count}/g, count.toLocaleString())
                .replace(/{user}/g, `<@${member.id}>`)
                .replace(/{server}/g, member.guild.name);

            const embed = VornEmbed.create()
                .setTitle('Milestone Reached')
                .setDescription(message)
                .setColor('#fbbf24')
                .setFooter({ text: `${member.guild.name} • ${count.toLocaleString()} members` });

            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error(`[Vorn Welcome] Milestone failed: ${err.message}`);
        }
    }

    /**
     * Assign stacked roles based on thresholds
     */
    async assignStackedRoles(member, stackedRoles) {
        const count = member.guild.memberCount;

        for (const sr of stackedRoles) {
            if (count >= sr.threshold && count < (sr.maxThreshold || Infinity)) {
                try {
                    const role = await member.guild.roles.fetch(sr.roleId);
                    if (role && role.position < member.guild.members.me.roles.highest.position) {
                        await member.roles.add(role);
                    }
                } catch {}
            }
        }
    }

    async sendBotWelcome(member, channelId) {
        try {
            const channel = await member.guild.channels.fetch(channelId);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setAuthor({ name: 'Bot Added', iconURL: member.guild.iconURL() })
                .setDescription(`${member} (\`${member.user.tag}\`)`)
                .addFields({ name: 'Added', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true })
                .setThumbnail(member.user.displayAvatarURL())
                .setFooter({ text: `ID: ${member.id}` })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`[Vorn Welcome] Bot welcome failed: ${error.message}`);
        }
    }

    async sendChannelWelcome(member, config, inviteContext = {}) {
        try {
            const channel = await member.guild.channels.fetch(config.channelId);
            if (!channel) return;

            const messageOptions = {};

            // Content with variants
            let content = config.message.content;
            if (config.message.variants?.length > 0) {
                const allMessages = [content, ...config.message.variants].filter(Boolean);
                content = allMessages[Math.floor(Math.random() * allMessages.length)];
            }

            if (content) {
                messageOptions.content = this.parsePlaceholders(content, member, inviteContext);
            }

            // Ping user option
            if (config.pingUser && !messageOptions.content?.includes(`<@${member.id}>`)) {
                messageOptions.content = `<@${member.id}> ${messageOptions.content || ''}`.trim();
            }

            // Embed
            const embed = this.buildEmbed(config.message.embed, member, inviteContext);
            if (embed) {
                // Add invite info to embed if enabled
                if (config.invites.showInWelcome && inviteContext.inviter) {
                    embed.addFields({
                        name: 'Invited by',
                        value: `<@${inviteContext.inviter.id}> (${inviteContext.inviterUses} invites)`,
                        inline: true
                    });
                }
                messageOptions.embeds = [embed];
            }

            // Canvas
            if (config.canvas.enabled) {
                try {
                    let banner;

                    if (config.canvas.schema) {
                        const WelcomeRenderer = require('./WelcomeRenderer');
                        banner = await WelcomeRenderer.render(member, config.canvas.schema);
                    } else {
                        const CanvasWelcome = require('./CanvasWelcome');
                        banner = await CanvasWelcome.generate(member, config.canvas);
                    }

                    const attachment = new AttachmentBuilder(banner, { name: 'welcome.png' });
                    messageOptions.files = [attachment];

                    if (embed) {
                        embed.setImage('attachment://welcome.png');
                    }
                } catch (canvasError) {
                    console.error(`[Vorn Welcome] Canvas failed: ${canvasError.message}`);
                }
            }

            // Buttons
            if (config.message.buttons?.length > 0) {
                const row = new ActionRowBuilder();
                let hasValid = false;

                for (const btn of config.message.buttons) {
                    try {
                        const button = new ButtonBuilder();
                        if (btn.label) button.setLabel(btn.label);
                        if (btn.emoji) button.setEmoji(btn.emoji);

                        if (btn.url) {
                            button.setStyle(ButtonStyle.Link);
                            button.setURL(this.parsePlaceholders(btn.url, member));
                        } else if (btn.customId) {
                            button.setStyle(btn.style || ButtonStyle.Primary);
                            button.setCustomId(btn.customId);
                        } else {
                            continue;
                        }

                        row.addComponents(button);
                        hasValid = true;
                    } catch {}
                }

                if (hasValid) {
                    messageOptions.components = [row];
                }
            }

            const sentMessage = await channel.send(messageOptions);

            // Store message ID for delete on leave
            if (config.deleteOnLeave) {
                const leaveData = await this.client.db.get(member.guild.id, 'welcome_messages') || {};
                leaveData[member.id] = { channelId: channel.id, messageId: sentMessage.id };
                await this.client.db.set(member.guild.id, 'welcome_messages', leaveData);
            }

            // Auto-delete
            if (config.autoDelete > 0) {
                setTimeout(() => {
                    sentMessage.delete().catch(() => {});
                }, config.autoDelete * 1000);
            }

        } catch (error) {
            console.error(`[Vorn Welcome] Channel welcome failed: ${error.message}`);
        }
    }

    async sendLog(member, config) {
        try {
            const channel = await member.guild.channels.fetch(config.logs.channelId);
            if (!channel) return;

            const created = Math.floor(member.user.createdTimestamp / 1000);
            const joined = Math.floor(member.joinedTimestamp / 1000);
            const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / (24 * 60 * 60 * 1000));
            const isNew = accountAgeDays < (config.logs.accountAge || 7);

            const embed = new EmbedBuilder()
                .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                .setColor(isNew ? '#ef4444' : '#22c55e')
                .setDescription(`<@${member.id}> joined`)
                .addFields(
                    { name: 'Account Age', value: `${accountAgeDays} days\nCreated: <t:${created}:R>`, inline: true },
                    { name: 'Member #', value: member.guild.memberCount.toString(), inline: true }
                )
                .setFooter({ text: `ID: ${member.id}` })
                .setTimestamp();

            if (isNew) {
                embed.addFields({ name: 'Warning', value: `Account is less than ${config.logs.accountAge || 7} days old` });
            }

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`[Vorn Welcome] Log failed: ${error.message}`);
        }
    }

    async sendDMWelcome(member, config) {
        try {
            const dmOptions = {};

            if (config.dm.content) {
                dmOptions.content = this.parsePlaceholders(config.dm.content, member);
            }

            const embed = this.buildEmbed(config.dm.embed, member);
            if (embed) {
                dmOptions.embeds = [embed];
            }

            await member.send(dmOptions);
        } catch {
            // DMs disabled
        }
    }

    async assignAutoRoles(member, roleIds) {
        for (const roleId of roleIds) {
            try {
                const role = await member.guild.roles.fetch(roleId);
                if (role && role.position < member.guild.members.me.roles.highest.position) {
                    await member.roles.add(role);
                }
            } catch (error) {
                console.error(`[Vorn Welcome] Role assign failed: ${error.message}`);
            }
        }
    }

    async sendTest(member, channel) {
        const config = await this.getConfig(member.guild.id);
        const messageOptions = {};

        if (config.message.content) {
            messageOptions.content = this.parsePlaceholders(config.message.content, member);
        }

        const embed = this.buildEmbed(config.message.embed, member);
        if (embed) {
            messageOptions.embeds = [embed];
        }

        if (config.canvas.enabled) {
            try {
                let banner;

                if (config.canvas.schema) {
                    const WelcomeRenderer = require('./WelcomeRenderer');
                    banner = await WelcomeRenderer.render(member, config.canvas.schema);
                } else {
                    const CanvasWelcome = require('./CanvasWelcome');
                    banner = await CanvasWelcome.generate(member, config.canvas);
                }

                const attachment = new AttachmentBuilder(banner, { name: 'welcome.png' });
                messageOptions.files = [attachment];

                if (embed) {
                    embed.setImage('attachment://welcome.png');
                }
            } catch (err) {
                console.error(`[Vorn Welcome] Test canvas failed: ${err.message}`);
            }
        }

        return await channel.send(messageOptions);
    }

    async getConfigEmbed(guildId) {
        const config = await this.getConfig(guildId);

        const embed = VornEmbed.create()
            .setTitle('Welcome Configuration')
            .setColor('#2b2d31');

        const check = '\u2713';
        const cross = '\u2717';

        let lines = [
            `**Welcome** ${config.enabled ? check : cross} ${config.channelId ? `<#${config.channelId}>` : 'No channel'}`,
            `**Goodbye** ${config.goodbye?.enabled ? check : cross} ${config.goodbye?.channelId ? `<#${config.goodbye.channelId}>` : ''}`,
            '',
            `**Canvas** ${config.canvas?.enabled ? `${check} ${config.canvas.template}` : cross}`,
            `**Invites** ${config.invites?.enabled ? check : cross}`,
            `**Milestones** ${config.milestones?.enabled ? check : cross}`,
            '',
            `**Auto Role** ${config.autoroles?.length ? `<@&${config.autoroles[0]}>` : 'None'}`,
            `**Logs** ${config.logs?.enabled ? `<#${config.logs.channelId}>` : 'Off'}`,
            `**DM** ${config.dm?.enabled ? check : cross}`
        ];

        embed.setDescription(lines.filter(Boolean).join('\n'));
        embed.setFooter({ text: '/welcome dashboard for settings' });

        return embed;
    }

    getPresets() {
        return {
            minimal: {
                message: {
                    content: '',
                    embed: {
                        enabled: true,
                        color: '#2b2d31',
                        title: '',
                        description: 'Welcome {user}',
                        thumbnail: '',
                        footer: ''
                    }
                },
                canvas: { enabled: false }
            },
            classic: {
                message: {
                    content: '',
                    embed: {
                        enabled: true,
                        color: '#2b2d31',
                        title: 'Welcome',
                        description: 'Hey {user}, welcome to **{server}**!\n\nYou are member **#{memberCount}**',
                        thumbnail: '{avatar}',
                        footer: 'Enjoy your stay'
                    }
                },
                canvas: { enabled: false }
            },
            banner: {
                message: {
                    content: '',
                    embed: { enabled: false }
                },
                canvas: {
                    enabled: true,
                    template: 'obsidian',
                    avatarStyle: 'circle',
                    showMemberCount: true
                }
            },
            premium: {
                message: {
                    content: '',
                    embed: { enabled: false }
                },
                canvas: {
                    enabled: true,
                    template: 'aurora',
                    avatarStyle: 'circle',
                    showMemberCount: true
                }
            }
        };
    }

    async applyPreset(guildId, presetName) {
        const presets = this.getPresets();
        if (!presets[presetName]) {
            throw new Error('Invalid preset');
        }

        const config = await this.getConfig(guildId);
        const preset = presets[presetName];

        if (preset.message) {
            config.message = { ...config.message, ...preset.message };
            if (preset.message.embed) {
                config.message.embed = { ...config.message.embed, ...preset.message.embed };
            }
        }
        if (preset.canvas) {
            config.canvas = { ...config.canvas, ...preset.canvas };
        }

        await this.setConfig(guildId, config);
        return config;
    }

    async handleInteraction(interaction) {
        if (!interaction.isButton()) return;

        if (interaction.customId === 'welcome_wave') {
            await interaction.deferReply({ ephemeral: true });

            const greetings = [
                `**${interaction.user.username}** says hello!`,
                `**${interaction.user.username}** waved at everyone!`,
                `**${interaction.user.username}** just arrived!`
            ];

            const greeting = greetings[Math.floor(Math.random() * greetings.length)];
            await interaction.channel.send({ content: greeting }).catch(() => {});
            await interaction.editReply({ content: 'You waved!' });
        }
    }

    /**
     * Delete welcome message when member leaves
     */
    async deleteWelcomeMessage(member) {
        try {
            const config = await this.getConfig(member.guild.id);
            if (!config.deleteOnLeave) return;

            const leaveData = await this.client.db.get(member.guild.id, 'welcome_messages') || {};
            const data = leaveData[member.id];

            if (data) {
                const channel = await member.guild.channels.fetch(data.channelId).catch(() => null);
                if (channel) {
                    const message = await channel.messages.fetch(data.messageId).catch(() => null);
                    if (message) {
                        await message.delete().catch(() => {});
                    }
                }
                delete leaveData[member.id];
                await this.client.db.set(member.guild.id, 'welcome_messages', leaveData);
            }
        } catch {}
    }
}

module.exports = WelcomeManager;
