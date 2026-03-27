/**
 * Vorn — Enterprise Ticket Manager
 * Best-in-market ticket system with logs, stats, priorities, auto-close, transcripts
 */

const {
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const VornEmbed = require('../utils/embedBuilder');

class TicketManager {
    constructor(client) {
        this.client = client;

        // Auto-close check interval
        this.autoCloseInterval = null;

        // Start auto-close cycle
        this.startAutoCloseCycle();
    }

    // ═══════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════

    async getConfig(guildId) {
        const config = await this.client.db.get(guildId, 'ticket_config') || {};
        return {
            panels: config.panels || [],
            activeTickets: config.activeTickets || {},
            ticketCount: config.ticketCount || 0,
            // Settings
            logChannelId: config.logChannelId || null,
            transcriptChannelId: config.transcriptChannelId || null,
            // Auto-close settings
            autoClose: {
                enabled: config.autoClose?.enabled ?? false,
                inactiveHours: config.autoClose?.inactiveHours ?? 48,
                warnHours: config.autoClose?.warnHours ?? 24
            },
            // Stats
            stats: config.stats || {
                totalOpened: 0,
                totalClosed: 0,
                totalResponseTime: 0,
                respondedCount: 0
            },
            // Feedback
            feedbackEnabled: config.feedbackEnabled ?? true,
            // Default staff role
            defaultStaffRoleId: config.defaultStaffRoleId || null,
            // Ticket naming
            namingFormat: config.namingFormat || 'ticket-{id}',
            // Canned responses
            cannedResponses: config.cannedResponses || [],
            // Blacklist
            blacklistedUsers: config.blacklistedUsers || [],
            // Predefined close reasons
            closeReasons: config.closeReasons || [],
            // Close reason stats
            closeReasonStats: config.closeReasonStats || {},
            // SLA settings
            sla: {
                firstResponseMinutes: config.sla?.firstResponseMinutes ?? null,
                resolveMinutes: config.sla?.resolveMinutes ?? null
            },
            // Staff performance
            staffPerformance: config.staffPerformance || {},
            ...config
        };
    }

    async setConfig(guildId, config) {
        await this.client.db.set(guildId, 'ticket_config', config);
    }

    async updateSettings(guildId, settings) {
        const config = await this.getConfig(guildId);
        Object.assign(config, settings);
        await this.setConfig(guildId, config);
        return config;
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTO-CLOSE CYCLE
    // ═══════════════════════════════════════════════════════════════

    startAutoCloseCycle() {
        // Check every 30 minutes
        this.autoCloseInterval = setInterval(() => {
            this.processAutoClose();
        }, 30 * 60 * 1000);

        // Run once after startup
        setTimeout(() => this.processAutoClose(), 15000);
    }

    stopAutoCloseCycle() {
        if (this.autoCloseInterval) {
            clearInterval(this.autoCloseInterval);
            this.autoCloseInterval = null;
        }
    }

    async processAutoClose() {
        const now = Date.now();

        for (const [guildId] of this.client.guilds.cache) {
            try {
                const config = await this.getConfig(guildId);
                if (!config.autoClose.enabled) continue;

                const warnMs = config.autoClose.warnHours * 60 * 60 * 1000;
                const closeMs = config.autoClose.inactiveHours * 60 * 60 * 1000;

                for (const [channelId, ticket] of Object.entries(config.activeTickets)) {
                    const lastActivity = ticket.lastActivity || ticket.timestamp;
                    const inactiveTime = now - lastActivity;

                    const channel = this.client.channels.cache.get(channelId);
                    if (!channel) {
                        // Channel deleted, clean up
                        delete config.activeTickets[channelId];
                        continue;
                    }

                    // Check for close
                    if (inactiveTime >= closeMs && !ticket.autoCloseWarned) {
                        // Shouldn't happen but close anyway
                        await this.autoCloseTicket(channel, config, guildId);
                    } else if (inactiveTime >= closeMs && ticket.autoCloseWarned) {
                        // Time to close
                        await this.autoCloseTicket(channel, config, guildId);
                    } else if (inactiveTime >= warnMs && !ticket.autoCloseWarned) {
                        // Send warning
                        ticket.autoCloseWarned = true;
                        config.activeTickets[channelId] = ticket;

                        const hoursLeft = Math.round((closeMs - inactiveTime) / (60 * 60 * 1000));
                        const embed = VornEmbed.warning(`This ticket will be automatically closed in **${hoursLeft} hours** due to inactivity.\n\nSend a message to keep it open.`);
                        await channel.send({ embeds: [embed] }).catch(() => { });
                    }
                }

                await this.setConfig(guildId, config);
            } catch (e) {
                // Ignore errors per guild
            }
        }
    }

    async autoCloseTicket(channel, config, guildId) {
        const ticket = config.activeTickets[channel.id];
        if (!ticket) return;

        // Generate transcript
        await this.generateTranscript(channel, ticket, 'Auto-Close (Inactivity)');

        // Log it
        await this.logTicketAction(guildId, {
            action: 'AUTO_CLOSED',
            ticketId: ticket.id,
            ownerId: ticket.ownerId,
            closedBy: this.client.user.id,
            reason: 'Inactivity',
            duration: Date.now() - ticket.timestamp
        });

        // Update stats
        config.stats.totalClosed++;
        delete config.activeTickets[channel.id];
        await this.setConfig(guildId, config);

        // Delete channel
        await channel.delete().catch(() => { });
    }

    // ═══════════════════════════════════════════════════════════════
    // TICKET CREATION
    // ═══════════════════════════════════════════════════════════════

    async createTicket(interaction, option, formData) {
        const guild = interaction.guild;
        const user = interaction.user;
        const config = await this.getConfig(guild.id);

        // Check blacklist
        if (config.blacklistedUsers.includes(user.id)) {
            return { success: false, error: 'You are blacklisted from creating tickets.' };
        }

        config.ticketCount++;
        const ticketId = config.ticketCount.toString().padStart(4, '0');

        // Format channel name
        let channelName = config.namingFormat
            .replace(/{id}/g, ticketId)
            .replace(/{user}/g, user.username.toLowerCase().slice(0, 10))
            .replace(/{type}/g, (option.label || 'ticket').toLowerCase().slice(0, 10));

        // Permissions
        const permissionOverwrites = [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks]
            },
            {
                id: this.client.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages]
            }
        ];

        // Add staff role
        const staffRoleId = option.roleId || config.defaultStaffRoleId;
        if (staffRoleId) {
            permissionOverwrites.push({
                id: staffRoleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
            });
        }

        // Create channel
        const parent = option.categoryId ? guild.channels.cache.get(option.categoryId) : null;

        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: parent,
            permissionOverwrites,
            topic: `Ticket #${ticketId} | ${user.tag} | ${option.label || 'Support'} | Priority: Normal`
        });

        // Store ticket data
        const ticketData = {
            id: ticketId,
            ownerId: user.id,
            type: option.label || 'Support',
            priority: 'normal',
            claimedBy: null,
            participants: [user.id],
            timestamp: Date.now(),
            lastActivity: Date.now(),
            firstResponseAt: null,
            metadata: formData,
            autoCloseWarned: false,
            messageCount: 0
        };

        config.activeTickets[channel.id] = ticketData;
        config.stats.totalOpened++;
        await this.setConfig(guild.id, config);

        // Build control panel
        const embed = VornEmbed.create()
            .setTitle(`Ticket #${ticketId}`)
            .setDescription([
                `**Type** — ${option.label || 'Support'}`,
                `**User** — <@${user.id}>`,
                `**Priority** — Normal`,
                '',
                `**Subject**`,
                `> ${formData.subject}`,
                '',
                `**Description**`,
                `> ${formData.description}`,
                '',
                '-# Staff will respond shortly. Use the buttons below to manage this ticket.'
            ].join('\n'));

        // Control buttons
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('ticket_priority').setLabel('Priority').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_add_user').setLabel('Add User').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_transcript').setLabel('Save Transcript').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_rename').setLabel('Rename').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_transfer').setLabel('Transfer').setStyle(ButtonStyle.Secondary)
        );

        const msg = await channel.send({
            content: staffRoleId ? `<@&${staffRoleId}>` : `<@${user.id}>`,
            embeds: [embed],
            components: [row1, row2]
        });
        await msg.pin().catch(() => { });

        // Log ticket creation
        await this.logTicketAction(guild.id, {
            action: 'OPENED',
            ticketId: ticketId,
            ownerId: user.id,
            type: option.label || 'Support',
            channelId: channel.id
        });

        return channel;
    }

    // ═══════════════════════════════════════════════════════════════
    // TICKET ACTIONS
    // ═══════════════════════════════════════════════════════════════

    async claimTicket(channel, staffMember) {
        const config = await this.getConfig(channel.guild.id);
        const ticket = config.activeTickets[channel.id];
        if (!ticket) return { success: false, error: 'Ticket not found' };
        if (ticket.claimedBy) return { success: false, error: `Already claimed by <@${ticket.claimedBy}>` };

        ticket.claimedBy = staffMember.id;
        ticket.lastActivity = Date.now();

        // Track first response time
        if (!ticket.firstResponseAt && staffMember.id !== ticket.ownerId) {
            ticket.firstResponseAt = Date.now();
            const responseTime = ticket.firstResponseAt - ticket.timestamp;
            config.stats.totalResponseTime += responseTime;
            config.stats.respondedCount++;
        }

        if (!ticket.participants.includes(staffMember.id)) {
            ticket.participants.push(staffMember.id);
        }

        config.activeTickets[channel.id] = ticket;
        await this.setConfig(channel.guild.id, config);

        await channel.setTopic(`Ticket #${ticket.id} | ${staffMember.user.tag} | ${ticket.type} | Priority: ${ticket.priority}`);

        await this.logTicketAction(channel.guild.id, {
            action: 'CLAIMED',
            ticketId: ticket.id,
            staffId: staffMember.id
        });

        return { success: true, ticket };
    }

    async setPriority(channel, priority) {
        const config = await this.getConfig(channel.guild.id);
        const ticket = config.activeTickets[channel.id];
        if (!ticket) return { success: false, error: 'Ticket not found' };

        const oldPriority = ticket.priority;
        ticket.priority = priority;
        ticket.lastActivity = Date.now();
        config.activeTickets[channel.id] = ticket;
        await this.setConfig(channel.guild.id, config);

        // Update channel name with priority prefix
        const priorityPrefix = { low: '', normal: '', high: 'urgent-', urgent: 'urgent-' };
        const baseName = channel.name.replace(/^urgent-/, '');
        await channel.setName(`${priorityPrefix[priority] || ''}${baseName}`).catch(() => { });

        await channel.setTopic(`Ticket #${ticket.id} | ${ticket.claimedBy ? `Claimed` : 'Unclaimed'} | ${ticket.type} | Priority: ${priority}`);

        await this.logTicketAction(channel.guild.id, {
            action: 'PRIORITY_CHANGED',
            ticketId: ticket.id,
            from: oldPriority,
            to: priority
        });

        return { success: true, oldPriority, newPriority: priority };
    }

    async addUser(channel, user) {
        const config = await this.getConfig(channel.guild.id);
        const ticket = config.activeTickets[channel.id];
        if (!ticket) return { success: false, error: 'Ticket not found' };

        await channel.permissionOverwrites.edit(user, {
            ViewChannel: true,
            SendMessages: true,
            AttachFiles: true
        });

        if (!ticket.participants.includes(user.id)) {
            ticket.participants.push(user.id);
        }
        ticket.lastActivity = Date.now();
        config.activeTickets[channel.id] = ticket;
        await this.setConfig(channel.guild.id, config);

        await this.logTicketAction(channel.guild.id, {
            action: 'USER_ADDED',
            ticketId: ticket.id,
            userId: user.id
        });

        return { success: true };
    }

    async removeUser(channel, user) {
        const config = await this.getConfig(channel.guild.id);
        const ticket = config.activeTickets[channel.id];
        if (!ticket) return { success: false, error: 'Ticket not found' };

        if (user.id === ticket.ownerId) {
            return { success: false, error: 'Cannot remove ticket owner' };
        }

        await channel.permissionOverwrites.delete(user);

        ticket.participants = ticket.participants.filter(id => id !== user.id);
        ticket.lastActivity = Date.now();
        config.activeTickets[channel.id] = ticket;
        await this.setConfig(channel.guild.id, config);

        await this.logTicketAction(channel.guild.id, {
            action: 'USER_REMOVED',
            ticketId: ticket.id,
            userId: user.id
        });

        return { success: true };
    }

    async transferOwnership(channel, newOwner) {
        const config = await this.getConfig(channel.guild.id);
        const ticket = config.activeTickets[channel.id];
        if (!ticket) return { success: false, error: 'Ticket not found' };

        const oldOwnerId = ticket.ownerId;
        ticket.ownerId = newOwner.id;
        ticket.lastActivity = Date.now();

        if (!ticket.participants.includes(newOwner.id)) {
            ticket.participants.push(newOwner.id);
        }

        config.activeTickets[channel.id] = ticket;
        await this.setConfig(channel.guild.id, config);

        // Update permissions
        await channel.permissionOverwrites.edit(newOwner, {
            ViewChannel: true,
            SendMessages: true,
            AttachFiles: true
        });

        await this.logTicketAction(channel.guild.id, {
            action: 'TRANSFERRED',
            ticketId: ticket.id,
            from: oldOwnerId,
            to: newOwner.id
        });

        return { success: true, oldOwner: oldOwnerId };
    }

    async renameTicket(channel, newName) {
        const config = await this.getConfig(channel.guild.id);
        const ticket = config.activeTickets[channel.id];
        if (!ticket) return { success: false, error: 'Ticket not found' };

        const oldName = channel.name;
        await channel.setName(newName);
        ticket.lastActivity = Date.now();
        config.activeTickets[channel.id] = ticket;
        await this.setConfig(channel.guild.id, config);

        return { success: true, oldName, newName };
    }

    // ═══════════════════════════════════════════════════════════════
    // TICKET CLOSE
    // ═══════════════════════════════════════════════════════════════

    async closeTicket(channel, closedBy, reason = 'No reason provided') {
        const config = await this.getConfig(channel.guild.id);
        const ticket = config.activeTickets[channel.id];
        if (!ticket) return { success: false, error: 'Ticket not found' };

        const duration = Date.now() - ticket.timestamp;

        // Generate transcript
        await this.generateTranscript(channel, ticket, reason);

        // Log
        await this.logTicketAction(channel.guild.id, {
            action: 'CLOSED',
            ticketId: ticket.id,
            ownerId: ticket.ownerId,
            closedBy: closedBy.id,
            reason: reason,
            duration: duration,
            messageCount: ticket.messageCount,
            participants: ticket.participants
        });

        // Update stats
        config.stats.totalClosed++;

        // Track close reason stats
        if (reason && reason !== 'No reason provided') {
            config.closeReasonStats[reason] = (config.closeReasonStats[reason] || 0) + 1;
        }

        // Track staff performance
        if (ticket.claimedBy) {
            if (!config.staffPerformance[ticket.claimedBy]) {
                config.staffPerformance[ticket.claimedBy] = { ticketsClosed: 0, totalResolveTime: 0, totalRating: 0, ratingCount: 0 };
            }
            config.staffPerformance[ticket.claimedBy].ticketsClosed++;
            config.staffPerformance[ticket.claimedBy].totalResolveTime += duration;
        }

        // Ask for feedback if enabled
        if (config.feedbackEnabled) {
            await this.sendFeedbackRequest(channel.guild, ticket);
        }

        // Clean up
        delete config.activeTickets[channel.id];
        await this.setConfig(channel.guild.id, config);

        return { success: true, ticket, duration };
    }

    // ═══════════════════════════════════════════════════════════════
    // TRANSCRIPT GENERATION
    // ═══════════════════════════════════════════════════════════════

    async generateTranscript(channel, ticket, closeReason) {
        const config = await this.getConfig(channel.guild.id);
        const transcriptChannel = config.transcriptChannelId
            ? channel.guild.channels.cache.get(config.transcriptChannelId)
            : null;

        if (!transcriptChannel) return;

        try {
            // Generate HTML Transcript
            const attachment = await discordTranscripts.createTranscript(channel, {
                limit: -1,
                returnType: 'attachment',
                filename: `transcript-${ticket.id}.html`,
                saveImages: true,
                poweredBy: false,
                useCDN: true
            });

            // Create embed summary
            const embed = VornEmbed.create()
                .setTitle(`Transcript: Ticket #${ticket.id}`)
                .addFields(
                    { name: 'Owner', value: `<@${ticket.ownerId}>`, inline: true },
                    { name: 'Type', value: ticket.type, inline: true },
                    { name: 'Priority', value: ticket.priority, inline: true },
                    { name: 'Claimed By', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Unclaimed', inline: true },
                    { name: 'Duration', value: this.formatDuration(Date.now() - ticket.timestamp), inline: true },
                    { name: 'Close Reason', value: closeReason, inline: false }
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Download Transcript')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/channels/${channel.guild.id}/${transcriptChannel.id}`)
                    .setDisabled(true) // Visual indicator
            );

            // Fetch the owner to get their avatar for the embed author
            const owner = await this.client.users.fetch(ticket.ownerId).catch(() => null);
            if (owner) {
                embed.setAuthor({ name: owner.tag, iconURL: owner.displayAvatarURL() });
            }

            // Send to transcript channel
            await transcriptChannel.send({
                embeds: [embed],
                files: [attachment]
            }).catch(() => { });

        } catch (e) {
            console.error(`[Vorn Tickets] Transcript error: ${e.message}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // LOGGING
    // ═══════════════════════════════════════════════════════════════

    async logTicketAction(guildId, data) {
        const config = await this.getConfig(guildId);
        if (!config.logChannelId) return;

        const logChannel = this.client.channels.cache.get(config.logChannelId);
        if (!logChannel) return;

        try {
            let embed;

            switch (data.action) {
                case 'OPENED':
                    embed = VornEmbed.create()
                        .setTitle('Ticket Opened')
                        .setColor('#57F287')
                        .addFields(
                            { name: 'Ticket', value: `#${data.ticketId}`, inline: true },
                            { name: 'User', value: `<@${data.ownerId}>`, inline: true },
                            { name: 'Type', value: data.type, inline: true },
                            { name: 'Channel', value: `<#${data.channelId}>`, inline: true }
                        );
                    break;

                case 'CLOSED':
                    embed = VornEmbed.create()
                        .setTitle('Ticket Closed')
                        .setColor('#ED4245')
                        .addFields(
                            { name: 'Ticket', value: `#${data.ticketId}`, inline: true },
                            { name: 'Owner', value: `<@${data.ownerId}>`, inline: true },
                            { name: 'Closed By', value: `<@${data.closedBy}>`, inline: true },
                            { name: 'Duration', value: this.formatDuration(data.duration), inline: true },
                            { name: 'Messages', value: (data.messageCount || 0).toString(), inline: true },
                            { name: 'Reason', value: data.reason || 'None', inline: false }
                        );
                    break;

                case 'AUTO_CLOSED':
                    embed = VornEmbed.create()
                        .setTitle('Ticket Auto-Closed')
                        .setColor('#FEE75C')
                        .addFields(
                            { name: 'Ticket', value: `#${data.ticketId}`, inline: true },
                            { name: 'Owner', value: `<@${data.ownerId}>`, inline: true },
                            { name: 'Reason', value: 'Inactivity', inline: true },
                            { name: 'Duration', value: this.formatDuration(data.duration), inline: true }
                        );
                    break;

                case 'CLAIMED':
                    embed = VornEmbed.create()
                        .setTitle('Ticket Claimed')
                        .setColor('#5865F2')
                        .addFields(
                            { name: 'Ticket', value: `#${data.ticketId}`, inline: true },
                            { name: 'Staff', value: `<@${data.staffId}>`, inline: true }
                        );
                    break;

                case 'PRIORITY_CHANGED':
                    embed = VornEmbed.create()
                        .setTitle('Priority Changed')
                        .setColor('#EB459E')
                        .addFields(
                            { name: 'Ticket', value: `#${data.ticketId}`, inline: true },
                            { name: 'From', value: data.from, inline: true },
                            { name: 'To', value: data.to, inline: true }
                        );
                    break;

                case 'USER_ADDED':
                    embed = VornEmbed.create()
                        .setTitle('User Added')
                        .setColor('#57F287')
                        .addFields(
                            { name: 'Ticket', value: `#${data.ticketId}`, inline: true },
                            { name: 'User', value: `<@${data.userId}>`, inline: true }
                        );
                    break;

                case 'USER_REMOVED':
                    embed = VornEmbed.create()
                        .setTitle('User Removed')
                        .setColor('#ED4245')
                        .addFields(
                            { name: 'Ticket', value: `#${data.ticketId}`, inline: true },
                            { name: 'User', value: `<@${data.userId}>`, inline: true }
                        );
                    break;

                case 'TRANSFERRED':
                    embed = VornEmbed.create()
                        .setTitle('Ticket Transferred')
                        .setColor('#5865F2')
                        .addFields(
                            { name: 'Ticket', value: `#${data.ticketId}`, inline: true },
                            { name: 'From', value: `<@${data.from}>`, inline: true },
                            { name: 'To', value: `<@${data.to}>`, inline: true }
                        );
                    break;

                default:
                    return;
            }

            await logChannel.send({ embeds: [embed] });
        } catch (e) {
            // Ignore log errors
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // FEEDBACK
    // ═══════════════════════════════════════════════════════════════

    async sendFeedbackRequest(guild, ticket) {
        try {
            const owner = await this.client.users.fetch(ticket.ownerId).catch(() => null);
            if (!owner) return;

            const embed = VornEmbed.create()
                .setTitle('How was your support experience?')
                .setDescription([
                    `Your ticket **#${ticket.id}** in **${guild.name}** has been closed.`,
                    '',
                    'Please rate your experience:'
                ].join('\n'));

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`feedback_${guild.id}_${ticket.id}_5`).setLabel('Excellent').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`feedback_${guild.id}_${ticket.id}_4`).setLabel('Good').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`feedback_${guild.id}_${ticket.id}_3`).setLabel('Okay').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`feedback_${guild.id}_${ticket.id}_2`).setLabel('Poor').setStyle(ButtonStyle.Danger)
            );

            await owner.send({ embeds: [embed], components: [row] }).catch(() => { });
        } catch (e) {
            // User might have DMs disabled
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // STATISTICS
    // ═══════════════════════════════════════════════════════════════

    async getStats(guildId) {
        const config = await this.getConfig(guildId);
        const activeCount = Object.keys(config.activeTickets).length;

        const avgResponseTime = config.stats.respondedCount > 0
            ? config.stats.totalResponseTime / config.stats.respondedCount
            : 0;

        // Count by priority
        let priorityCounts = { low: 0, normal: 0, high: 0, urgent: 0 };
        for (const ticket of Object.values(config.activeTickets)) {
            priorityCounts[ticket.priority] = (priorityCounts[ticket.priority] || 0) + 1;
        }

        // Count unclaimed
        let unclaimedCount = 0;
        for (const ticket of Object.values(config.activeTickets)) {
            if (!ticket.claimedBy) unclaimedCount++;
        }

        return {
            totalOpened: config.stats.totalOpened,
            totalClosed: config.stats.totalClosed,
            activeTickets: activeCount,
            unclaimedTickets: unclaimedCount,
            avgResponseTime: avgResponseTime,
            avgResponseTimeFormatted: this.formatDuration(avgResponseTime),
            priorityCounts
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTIVITY TRACKING
    // ═══════════════════════════════════════════════════════════════

    async trackActivity(channelId, guildId, userId) {
        const config = await this.getConfig(guildId);
        const ticket = config.activeTickets[channelId];
        if (!ticket) return;

        ticket.lastActivity = Date.now();
        ticket.messageCount = (ticket.messageCount || 0) + 1;
        ticket.autoCloseWarned = false; // Reset warning on activity

        // Track first response
        if (!ticket.firstResponseAt && userId !== ticket.ownerId) {
            ticket.firstResponseAt = Date.now();
            const responseTime = ticket.firstResponseAt - ticket.timestamp;
            config.stats.totalResponseTime += responseTime;
            config.stats.respondedCount++;
        }

        if (!ticket.participants.includes(userId)) {
            ticket.participants.push(userId);
        }

        config.activeTickets[channelId] = ticket;
        await this.setConfig(guildId, config);
    }

    // ═══════════════════════════════════════════════════════════════
    // PANEL MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    async addPanel(guildId, panelData) {
        const config = await this.getConfig(guildId);
        config.panels.push(panelData);
        await this.setConfig(guildId, config);
    }

    async removePanel(guildId, panelId) {
        const config = await this.getConfig(guildId);
        config.panels = config.panels.filter(p => p.id !== panelId);
        await this.setConfig(guildId, config);
    }

    async getPanel(guildId, panelId) {
        const config = await this.getConfig(guildId);
        return config.panels.find(p => p.id === panelId);
    }

    // ═══════════════════════════════════════════════════════════════
    // CANNED RESPONSES
    // ═══════════════════════════════════════════════════════════════

    async addCannedResponse(guildId, name, content, createdBy) {
        const config = await this.getConfig(guildId);
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
        config.cannedResponses.push({ id, name, content, createdBy });
        await this.setConfig(guildId, config);
        return id;
    }

    async removeCannedResponse(guildId, name) {
        const config = await this.getConfig(guildId);
        const idx = config.cannedResponses.findIndex(r => r.name.toLowerCase() === name.toLowerCase());
        if (idx === -1) return false;
        config.cannedResponses.splice(idx, 1);
        await this.setConfig(guildId, config);
        return true;
    }

    async getCannedResponses(guildId) {
        const config = await this.getConfig(guildId);
        return config.cannedResponses;
    }

    async useCannedResponse(channel, name) {
        const config = await this.getConfig(channel.guild.id);
        const response = config.cannedResponses.find(r => r.name.toLowerCase() === name.toLowerCase());
        if (!response) return { success: false, error: 'Response not found' };

        const embed = VornEmbed.create()
            .setDescription(response.content);

        await channel.send({ embeds: [embed] });
        return { success: true, response };
    }

    // ═══════════════════════════════════════════════════════════════
    // BLACKLIST
    // ═══════════════════════════════════════════════════════════════

    async addToBlacklist(guildId, userId) {
        const config = await this.getConfig(guildId);
        if (config.blacklistedUsers.includes(userId)) return false;
        config.blacklistedUsers.push(userId);
        await this.setConfig(guildId, config);
        return true;
    }

    async removeFromBlacklist(guildId, userId) {
        const config = await this.getConfig(guildId);
        const idx = config.blacklistedUsers.indexOf(userId);
        if (idx === -1) return false;
        config.blacklistedUsers.splice(idx, 1);
        await this.setConfig(guildId, config);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    // CLOSE REASONS
    // ═══════════════════════════════════════════════════════════════

    async addCloseReason(guildId, reason) {
        const config = await this.getConfig(guildId);
        if (config.closeReasons.includes(reason)) return false;
        config.closeReasons.push(reason);
        await this.setConfig(guildId, config);
        return true;
    }

    async removeCloseReason(guildId, reason) {
        const config = await this.getConfig(guildId);
        const idx = config.closeReasons.findIndex(r => r.toLowerCase() === reason.toLowerCase());
        if (idx === -1) return false;
        config.closeReasons.splice(idx, 1);
        await this.setConfig(guildId, config);
        return true;
    }

    async getCloseReasonStats(guildId) {
        const config = await this.getConfig(guildId);
        return config.closeReasonStats;
    }

    // ═══════════════════════════════════════════════════════════════
    // SLA MONITORING
    // ═══════════════════════════════════════════════════════════════

    async checkSLAViolations(guildId) {
        const config = await this.getConfig(guildId);
        const violations = [];
        const now = Date.now();

        for (const [channelId, ticket] of Object.entries(config.activeTickets)) {
            // First response SLA
            if (config.sla.firstResponseMinutes && !ticket.firstResponseAt) {
                const elapsed = (now - ticket.timestamp) / 60000;
                if (elapsed > config.sla.firstResponseMinutes) {
                    violations.push({ type: 'FIRST_RESPONSE', ticketId: ticket.id, channelId, elapsed: Math.round(elapsed), sla: config.sla.firstResponseMinutes });
                }
            }

            // Resolve SLA
            if (config.sla.resolveMinutes) {
                const elapsed = (now - ticket.timestamp) / 60000;
                if (elapsed > config.sla.resolveMinutes) {
                    violations.push({ type: 'RESOLVE', ticketId: ticket.id, channelId, elapsed: Math.round(elapsed), sla: config.sla.resolveMinutes });
                }
            }
        }

        return violations;
    }

    // ═══════════════════════════════════════════════════════════════
    // STAFF PERFORMANCE
    // ═══════════════════════════════════════════════════════════════

    async getStaffPerformance(guildId) {
        const config = await this.getConfig(guildId);
        const result = [];

        for (const [staffId, perf] of Object.entries(config.staffPerformance)) {
            const avgResolve = perf.ticketsClosed > 0 ? perf.totalResolveTime / perf.ticketsClosed : 0;
            const avgRating = perf.ratingCount > 0 ? (perf.totalRating / perf.ratingCount).toFixed(1) : 'N/A';

            result.push({
                staffId,
                ticketsClosed: perf.ticketsClosed,
                avgResolveTime: avgResolve,
                avgResolveFormatted: this.formatDuration(avgResolve),
                avgRating,
                totalRatings: perf.ratingCount
            });
        }

        // Sort by tickets closed descending
        result.sort((a, b) => b.ticketsClosed - a.ticketsClosed);
        return result;
    }

    async recordFeedbackRating(guildId, staffId, rating) {
        const config = await this.getConfig(guildId);
        if (!config.staffPerformance[staffId]) {
            config.staffPerformance[staffId] = { ticketsClosed: 0, totalResolveTime: 0, totalRating: 0, ratingCount: 0 };
        }
        config.staffPerformance[staffId].totalRating += rating;
        config.staffPerformance[staffId].ratingCount++;
        await this.setConfig(guildId, config);
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════════

    formatDuration(ms) {
        if (!ms || ms < 0) return '0s';

        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    isTicketChannel(channelId, guildId) {
        // Quick check without async
        return false; // Will need async version
    }

    async isTicket(channelId, guildId) {
        const config = await this.getConfig(guildId);
        return !!config.activeTickets[channelId];
    }

    async getTicket(channelId, guildId) {
        const config = await this.getConfig(guildId);
        return config.activeTickets[channelId] || null;
    }
}

module.exports = TicketManager;
