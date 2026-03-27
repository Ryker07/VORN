/**
 * Vorn — Join-to-Create (Temp Voice) Manager
 * Dynamic voice channel system with full owner control dashboard
 */

const {
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const VornEmbed = require('../utils/embedBuilder');

class VoiceManager {
    constructor(client) {
        this.client = client;

        // Cache active temp channels { channelId: { ownerId, guildId, created } }
        this.activeChannels = new Map();

        // Max channel lifetime: 2 days (in ms)
        this.MAX_LIFETIME = 2 * 24 * 60 * 60 * 1000;

        // Cleanup interval reference
        this.cleanupInterval = null;

        // Load active channels from DB on startup
        this.loadChannels();

        this.setupEvents();

        // Start cleanup cycle (every 30 minutes)
        this.startCleanupCycle();
    }

    startCleanupCycle() {
        // Run cleanup every 30 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredChannels();
        }, 30 * 60 * 1000);

        // Run once on startup after a short delay
        setTimeout(() => this.cleanupExpiredChannels(), 10000);
    }

    stopCleanupCycle() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    async cleanupExpiredChannels() {
        const now = Date.now();
        const expiredChannels = [];

        // Find expired channels
        for (const [channelId, data] of this.activeChannels) {
            if (now - data.created > this.MAX_LIFETIME) {
                expiredChannels.push({ channelId, data });
            }
        }

        // Delete expired channels
        for (const { channelId, data } of expiredChannels) {
            try {
                const channel = this.client.channels.cache.get(channelId);
                if (channel) {
                    await channel.delete().catch(() => {});
                }
                await this.removeChannelData(data.guildId, channelId);
                console.log(`[Vorn Voice] Auto-terminated expired channel: ${channelId}`);
            } catch (e) {
                // Ignore errors, channel might already be gone
            }
        }
    }

    async removeChannelData(guildId, channelId) {
        // Remove from cache
        this.activeChannels.delete(channelId);

        // Remove from DB
        try {
            const active = await this.client.db.get(guildId, 'voice_active') || {};
            if (active[channelId]) {
                delete active[channelId];
                await this.client.db.set(guildId, 'voice_active', active);
            }
        } catch (e) {
            // Ignore DB errors
        }
    }

    async loadChannels() {
        const now = Date.now();

        // Load from all guilds on ready
        for (const [guildId] of this.client.guilds.cache) {
            try {
                const active = await this.client.db.get(guildId, 'voice_active') || {};
                let modified = false;

                for (const [channelId, data] of Object.entries(active)) {
                    const channel = this.client.channels.cache.get(channelId);

                    // Check if channel exists and isn't expired
                    if (channel && (now - data.created) < this.MAX_LIFETIME) {
                        this.activeChannels.set(channelId, data);
                    } else {
                        // Clean up - channel doesn't exist or expired
                        delete active[channelId];
                        modified = true;

                        // If channel exists but expired, delete it
                        if (channel) {
                            await channel.delete().catch(() => {});
                        }
                    }
                }

                // Save cleaned up data
                if (modified) {
                    await this.client.db.set(guildId, 'voice_active', active);
                }
            } catch (e) {
                // Ignore load errors
            }
        }
    }

    setupEvents() {
        // Voice State Update (Join/Leave)
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            const member = newState.member;
            const guild = newState.guild;

            // User Joined a channel
            if (newState.channelId && newState.channelId !== oldState.channelId) {
                const config = await this.getConfig(guild.id);
                if (config.enabled && config.hubId && newState.channelId === config.hubId) {
                    await this.createVoiceChannel(member, config);
                }
            }

            // User Left a channel (or switched)
            if (oldState.channelId && oldState.channelId !== newState.channelId) {
                const channel = oldState.channel;
                if (channel && this.isTempChannel(channel.id)) {
                    await this.checkEmpty(channel);
                }
            }
        });

        // Channel Delete Event - cleanup data when channel is manually deleted
        this.client.on('channelDelete', async (channel) => {
            if (this.isTempChannel(channel.id)) {
                const data = this.getChannelData(channel.id);
                if (data) {
                    await this.removeChannelData(data.guildId, channel.id);
                }
            }
        });

        // Interaction Handler (All JTC interactions)
        this.client.on('interactionCreate', async (interaction) => {
            // Handle buttons
            if (interaction.isButton() && interaction.customId.startsWith('jtc_')) {
                await this.handleDashboard(interaction);
                return;
            }

            // Handle modals
            if (interaction.isModalSubmit() && interaction.customId.startsWith('jtc_modal_')) {
                await this.handleModal(interaction);
                return;
            }

            // Handle select menus
            if (interaction.isStringSelectMenu() && interaction.customId.startsWith('jtc_select_')) {
                await this.handleSelect(interaction);
                return;
            }
        });
    }

    async getConfig(guildId) {
        const config = await this.client.db.get(guildId, 'voice') || {};
        return {
            enabled: false,
            hubId: null,
            categoryId: null,
            defaultLimit: 0,
            defaultName: "{user}'s Channel",
            ...config
        };
    }

    async setConfig(guildId, config) {
        await this.client.db.set(guildId, 'voice', config);
    }

    isTempChannel(channelId) {
        return this.activeChannels.has(channelId);
    }

    getChannelData(channelId) {
        return this.activeChannels.get(channelId);
    }

    async createVoiceChannel(member, config) {
        try {
            const guild = member.guild;
            const hubChannel = guild.channels.cache.get(config.hubId);
            if (!hubChannel) return;

            // Load user preferences
            const userPrefs = await this.client.db.get(guild.id, `voice_prefs_${member.id}`) || {};

            // Determine name (User Pref > Config Default)
            let name = userPrefs.name || config.defaultName.replace(/{user}/g, member.user.username);

            // Determine limit (User Pref > Config Default)
            let limit = userPrefs.limit !== undefined ? userPrefs.limit : config.defaultLimit;

            // Determine parent category (inherit from hub or custom)
            const parent = config.categoryId ? config.categoryId : hubChannel.parentId;

            const voiceChannel = await guild.channels.create({
                name: name,
                type: ChannelType.GuildVoice,
                parent: parent,
                userLimit: limit,
                permissionOverwrites: [
                    // Owner permissions
                    {
                        id: member.id,
                        allow: [
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                            PermissionFlagsBits.Stream,
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.MuteMembers
                        ]
                    },
                    // Default permissions
                    {
                        id: guild.id,
                        allow: [PermissionFlagsBits.Connect]
                    }
                ]
            });

            // Move member
            await member.voice.setChannel(voiceChannel);

            // Register channel
            const channelData = {
                id: voiceChannel.id,
                ownerId: member.id,
                guildId: guild.id,
                created: Date.now()
            };

            // Save to DB (persist state)
            const active = await this.client.db.get(guild.id, 'voice_active') || {};
            active[voiceChannel.id] = channelData;
            await this.client.db.set(guild.id, 'voice_active', active);

            // Update cache
            this.activeChannels.set(voiceChannel.id, channelData);

            // Send Control Panel
            await this.sendControlPanel(voiceChannel, member);

        } catch (err) {
            console.error(`[Vorn Voice] Failed to create channel: ${err.message}`);
        }
    }

    async checkEmpty(channel) {
        if (channel.members.size === 0) {
            try {
                const guildId = channel.guild.id;
                const channelId = channel.id;

                // Delete the channel
                await channel.delete().catch(() => {});

                // Clean up data
                await this.removeChannelData(guildId, channelId);
            } catch (e) {
                // Channel might already be deleted
            }
        }
    }

    async sendControlPanel(channel, owner) {
        const embed = VornEmbed.create()
            .setTitle('Voice Interface')
            .setDescription(`**Owner:** <@${owner.id}>\nManage your temporary voice channel below.`)
            .setColor('#2b2d31');

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('jtc_lock').setLabel('Lock').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('jtc_unlock').setLabel('Unlock').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('jtc_hide').setLabel('Hide').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('jtc_unhide').setLabel('Unhide').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('jtc_limit').setLabel('Limit').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('jtc_rename').setLabel('Rename').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('jtc_kick').setLabel('Kick').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('jtc_permit').setLabel('Permit').setStyle(ButtonStyle.Success)
        );

        await channel.send({ embeds: [embed], components: [row1, row2] });
    }

    // Check ownership
    isOwnerOrAdmin(interaction, channelData) {
        return interaction.user.id === channelData.ownerId ||
               interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    }

    // Get the voice channel from interaction (text channel of voice)
    async getVoiceChannel(interaction) {
        // The interaction channel is the text part of the voice channel
        const channel = interaction.channel;
        if (!channel) return null;

        // For voice channels with text, the channel itself is the voice channel
        if (channel.type === ChannelType.GuildVoice) {
            return channel;
        }

        return null;
    }

    async handleDashboard(interaction) {
        const voiceChannel = await this.getVoiceChannel(interaction);
        if (!voiceChannel) {
            return interaction.reply({ content: 'Could not find voice channel.', ephemeral: true });
        }

        const channelData = this.getChannelData(voiceChannel.id);
        if (!channelData) {
            return interaction.reply({ content: 'This is not a managed voice channel.', ephemeral: true });
        }

        // Check permissions
        if (!this.isOwnerOrAdmin(interaction, channelData)) {
            return interaction.reply({ content: 'Only the channel owner can use this.', ephemeral: true });
        }

        const action = interaction.customId.replace('jtc_', '');

        try {
            switch (action) {
                case 'lock':
                    await voiceChannel.permissionOverwrites.edit(voiceChannel.guild.roles.everyone, { Connect: false });
                    await interaction.reply({ content: 'Channel locked.', ephemeral: true });
                    break;

                case 'unlock':
                    await voiceChannel.permissionOverwrites.edit(voiceChannel.guild.roles.everyone, { Connect: null });
                    await interaction.reply({ content: 'Channel unlocked.', ephemeral: true });
                    break;

                case 'hide':
                    await voiceChannel.permissionOverwrites.edit(voiceChannel.guild.roles.everyone, { ViewChannel: false });
                    await interaction.reply({ content: 'Channel hidden.', ephemeral: true });
                    break;

                case 'unhide':
                    await voiceChannel.permissionOverwrites.edit(voiceChannel.guild.roles.everyone, { ViewChannel: null });
                    await interaction.reply({ content: 'Channel visible.', ephemeral: true });
                    break;

                case 'limit':
                    await this.showLimitModal(interaction, voiceChannel);
                    break;

                case 'rename':
                    await this.showRenameModal(interaction, voiceChannel);
                    break;

                case 'kick':
                    await this.showKickMenu(interaction, voiceChannel, channelData);
                    break;

                case 'permit':
                    await this.showPermitModal(interaction, voiceChannel);
                    break;
            }
        } catch (error) {
            console.error(`[Vorn Voice] Dashboard error: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: `Error: ${error.message}`, ephemeral: true }).catch(() => {});
            }
        }
    }

    // Show rename modal
    async showRenameModal(interaction, channel) {
        const modal = new ModalBuilder()
            .setCustomId(`jtc_modal_rename_${channel.id}`)
            .setTitle('Rename Channel');

        const input = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('New Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(channel.name)
            .setMaxLength(100)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    // Show limit modal
    async showLimitModal(interaction, channel) {
        const modal = new ModalBuilder()
            .setCustomId(`jtc_modal_limit_${channel.id}`)
            .setTitle('Set User Limit');

        const input = new TextInputBuilder()
            .setCustomId('limit')
            .setLabel('User Limit (0 = unlimited, max 99)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(channel.userLimit.toString())
            .setMaxLength(2)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    // Show permit modal (user enters ID or mention)
    async showPermitModal(interaction, channel) {
        const modal = new ModalBuilder()
            .setCustomId(`jtc_modal_permit_${channel.id}`)
            .setTitle('Permit User');

        const input = new TextInputBuilder()
            .setCustomId('user')
            .setLabel('User ID or @mention')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('123456789012345678 or @username')
            .setMaxLength(50)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    // Show kick menu with ONLY members in the voice channel
    async showKickMenu(interaction, voiceChannel, channelData) {
        // Get members currently in the voice channel
        const membersInVC = voiceChannel.members.filter(m => m.id !== channelData.ownerId);

        if (membersInVC.size === 0) {
            return interaction.reply({ content: 'No other members in the channel to kick.', ephemeral: true });
        }

        // Build options from members in the channel (max 25)
        const options = membersInVC.first(25).map(member => ({
            label: member.user.username,
            description: member.user.tag,
            value: member.id
        }));

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`jtc_select_kick_${voiceChannel.id}`)
                .setPlaceholder('Select member to kick')
                .addOptions(options)
        );

        await interaction.reply({
            content: 'Select a member to disconnect from the channel:',
            components: [row],
            ephemeral: true
        });
    }

    // Handle modal submissions
    async handleModal(interaction) {
        const customId = interaction.customId;
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        try {
            // Rename modal
            if (customId.startsWith('jtc_modal_rename_')) {
                const channelId = customId.replace('jtc_modal_rename_', '');
                const channel = interaction.guild.channels.cache.get(channelId);

                if (!channel) {
                    return interaction.reply({ content: 'Channel not found.', ephemeral: true });
                }

                const channelData = this.getChannelData(channelId);
                if (!channelData || !this.isOwnerOrAdmin(interaction, channelData)) {
                    return interaction.reply({ content: 'Permission denied.', ephemeral: true });
                }

                const name = interaction.fields.getTextInputValue('name').trim();
                if (!name) {
                    return interaction.reply({ content: 'Name cannot be empty.', ephemeral: true });
                }

                await channel.setName(name);

                // Save preference for future channels
                const prefs = await this.client.db.get(guildId, `voice_prefs_${userId}`) || {};
                prefs.name = name;
                await this.client.db.set(guildId, `voice_prefs_${userId}`, prefs);

                await interaction.reply({ content: `Channel renamed to **${name}**`, ephemeral: true });
            }

            // Limit modal
            if (customId.startsWith('jtc_modal_limit_')) {
                const channelId = customId.replace('jtc_modal_limit_', '');
                const channel = interaction.guild.channels.cache.get(channelId);

                if (!channel) {
                    return interaction.reply({ content: 'Channel not found.', ephemeral: true });
                }

                const channelData = this.getChannelData(channelId);
                if (!channelData || !this.isOwnerOrAdmin(interaction, channelData)) {
                    return interaction.reply({ content: 'Permission denied.', ephemeral: true });
                }

                const limitStr = interaction.fields.getTextInputValue('limit').trim();
                const limit = parseInt(limitStr);

                if (isNaN(limit) || limit < 0 || limit > 99) {
                    return interaction.reply({ content: 'Invalid limit. Enter a number between 0 and 99.', ephemeral: true });
                }

                await channel.setUserLimit(limit);

                // Save preference
                const prefs = await this.client.db.get(guildId, `voice_prefs_${userId}`) || {};
                prefs.limit = limit;
                await this.client.db.set(guildId, `voice_prefs_${userId}`, prefs);

                const limitText = limit === 0 ? 'unlimited' : limit.toString();
                await interaction.reply({ content: `User limit set to **${limitText}**`, ephemeral: true });
            }

            // Permit modal
            if (customId.startsWith('jtc_modal_permit_')) {
                const channelId = customId.replace('jtc_modal_permit_', '');
                const channel = interaction.guild.channels.cache.get(channelId);

                if (!channel) {
                    return interaction.reply({ content: 'Channel not found.', ephemeral: true });
                }

                const channelData = this.getChannelData(channelId);
                if (!channelData || !this.isOwnerOrAdmin(interaction, channelData)) {
                    return interaction.reply({ content: 'Permission denied.', ephemeral: true });
                }

                let userInput = interaction.fields.getTextInputValue('user').trim();

                // Extract ID from mention format <@123456789> or <@!123456789>
                const mentionMatch = userInput.match(/<@!?(\d+)>/);
                if (mentionMatch) {
                    userInput = mentionMatch[1];
                }

                // Validate it's a snowflake ID
                if (!/^\d{17,20}$/.test(userInput)) {
                    return interaction.reply({ content: 'Invalid user. Enter a valid user ID or @mention.', ephemeral: true });
                }

                const member = await interaction.guild.members.fetch(userInput).catch(() => null);
                if (!member) {
                    return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
                }

                await channel.permissionOverwrites.edit(member, {
                    Connect: true,
                    ViewChannel: true
                });

                await interaction.reply({ content: `**${member.user.username}** can now join your channel.`, ephemeral: true });
            }

        } catch (error) {
            console.error(`[Vorn Voice] Modal error: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: `Error: ${error.message}`, ephemeral: true }).catch(() => {});
            }
        }
    }

    // Handle select menu for kick
    async handleSelect(interaction) {
        const customId = interaction.customId;

        try {
            if (customId.startsWith('jtc_select_kick_')) {
                const channelId = customId.replace('jtc_select_kick_', '');
                const channel = interaction.guild.channels.cache.get(channelId);

                if (!channel) {
                    return interaction.reply({ content: 'Channel not found.', ephemeral: true });
                }

                const channelData = this.getChannelData(channelId);
                if (!channelData || !this.isOwnerOrAdmin(interaction, channelData)) {
                    return interaction.reply({ content: 'Permission denied.', ephemeral: true });
                }

                const targetId = interaction.values[0];
                const member = await interaction.guild.members.fetch(targetId).catch(() => null);

                if (!member) {
                    return interaction.reply({ content: 'User not found.', ephemeral: true });
                }

                // Verify they're still in the channel
                if (member.voice.channelId !== channelId) {
                    return interaction.reply({ content: 'User is no longer in the channel.', ephemeral: true });
                }

                await member.voice.disconnect();
                await interaction.reply({ content: `**${member.user.username}** has been disconnected.`, ephemeral: true });
            }

        } catch (error) {
            console.error(`[Vorn Voice] Select error: ${error.message}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: `Error: ${error.message}`, ephemeral: true }).catch(() => {});
            }
        }
    }
}

module.exports = VoiceManager;
