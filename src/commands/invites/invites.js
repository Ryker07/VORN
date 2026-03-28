/**
 * Vorn — Invite Tracker Commands
 * Full invite management with stats, leaderboard, rewards, and admin tools
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invites')
        .setDescription('Invite tracking and management')

        // /invites user [target?]
        .addSubcommand(sub => sub
            .setName('user')
            .setDescription('View invite statistics')
            .addUserOption(opt => opt
                .setName('target')
                .setDescription('User to check (default: yourself)')
            )
        )

        // /invites leaderboard [page?]
        .addSubcommand(sub => sub
            .setName('leaderboard')
            .setDescription('Server invite leaderboard')
            .addIntegerOption(opt => opt
                .setName('page')
                .setDescription('Page number')
                .setMinValue(1)
            )
        )

        // /invites codes [target?]
        .addSubcommand(sub => sub
            .setName('codes')
            .setDescription('View active invite codes')
            .addUserOption(opt => opt
                .setName('target')
                .setDescription('User to check (default: yourself)')
            )
        )

        // /invites enable
        .addSubcommand(sub => sub
            .setName('enable')
            .setDescription('Enable invite tracking')
        )

        // /invites disable
        .addSubcommand(sub => sub
            .setName('disable')
            .setDescription('Disable invite tracking')
        )

        // /invites config
        .addSubcommand(sub => sub
            .setName('config')
            .setDescription('Configure invite tracking settings')
            .addChannelOption(opt => opt
                .setName('channel')
                .setDescription('Log channel for invite events')
            )
            .addIntegerOption(opt => opt
                .setName('fake_days')
                .setDescription('Account age threshold for fake detection (days)')
                .setMinValue(0)
                .setMaxValue(365)
            )
            .addIntegerOption(opt => opt
                .setName('fake_leave')
                .setDescription('Leave threshold for fake detection (minutes)')
                .setMinValue(0)
                .setMaxValue(10080)
            )
        )

        // /invites reset [target?]
        .addSubcommand(sub => sub
            .setName('reset')
            .setDescription('Reset invite data')
            .addUserOption(opt => opt
                .setName('target')
                .setDescription('User to reset (omit to reset all)')
            )
            .addBooleanOption(opt => opt
                .setName('confirm')
                .setDescription('Confirm reset (required for reset all)')
            )
        )

        // /invites bonus add/remove
        .addSubcommandGroup(group => group
            .setName('bonus')
            .setDescription('Manage bonus invites')
            .addSubcommand(sub => sub
                .setName('add')
                .setDescription('Add bonus invites to a user')
                .addUserOption(opt => opt
                    .setName('user')
                    .setDescription('User to add bonus to')
                    .setRequired(true)
                )
                .addIntegerOption(opt => opt
                    .setName('amount')
                    .setDescription('Amount of bonus invites')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(1000)
                )
            )
            .addSubcommand(sub => sub
                .setName('remove')
                .setDescription('Remove bonus invites from a user')
                .addUserOption(opt => opt
                    .setName('user')
                    .setDescription('User to remove bonus from')
                    .setRequired(true)
                )
                .addIntegerOption(opt => opt
                    .setName('amount')
                    .setDescription('Amount of bonus invites to remove')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(1000)
                )
            )
        )

        // /invites rewards add/remove/list
        .addSubcommandGroup(group => group
            .setName('rewards')
            .setDescription('Manage invite milestone rewards')
            .addSubcommand(sub => sub
                .setName('add')
                .setDescription('Add an invite milestone reward')
                .addIntegerOption(opt => opt
                    .setName('count')
                    .setDescription('Number of invites required')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(10000)
                )
                .addRoleOption(opt => opt
                    .setName('role')
                    .setDescription('Role to award')
                    .setRequired(true)
                )
            )
            .addSubcommand(sub => sub
                .setName('remove')
                .setDescription('Remove an invite milestone reward')
                .addRoleOption(opt => opt
                    .setName('role')
                    .setDescription('Role to remove from rewards')
                    .setRequired(true)
                )
            )
            .addSubcommand(sub => sub
                .setName('list')
                .setDescription('List all invite milestone rewards')
            )
        ),

    async execute(interaction, client) {
        if (!client.invites) {
            return interaction.reply({ embeds: [VornEmbed.error('Invite system is not initialized')], ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup();

        // Permission check for admin commands
        const adminCommands = ['enable', 'disable', 'config', 'reset'];
        const adminGroups = ['bonus', 'rewards'];

        if (adminCommands.includes(sub) || adminGroups.includes(group)) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({
                    embeds: [VornEmbed.error('You need **Manage Server** permission')],
                    ephemeral: true
                });
            }
        }

        // Route to handler
        if (group === 'bonus') {
            return this.handleBonus(interaction, client, sub);
        }
        if (group === 'rewards') {
            return this.handleRewards(interaction, client, sub);
        }

        switch (sub) {
            case 'user': return this.handleUser(interaction, client);
            case 'leaderboard': return this.handleLeaderboard(interaction, client);
            case 'codes': return this.handleCodes(interaction, client);
            case 'enable': return this.handleEnable(interaction, client);
            case 'disable': return this.handleDisable(interaction, client);
            case 'config': return this.handleConfig(interaction, client);
            case 'reset': return this.handleReset(interaction, client);
        }
    },

    async handleUser(interaction, client) {
        await interaction.deferReply();

        const target = interaction.options.getUser('target') || interaction.user;
        const stats = await client.invites.getStats(interaction.guild.id, target.id);
        const recent = await client.invites.getRecentInvites(interaction.guild.id, target.id, 5);
        const inviter = await client.invites.getInviter(interaction.guild.id, target.id);

        const pad = (label) => label.padEnd(12);

        const lines = [
            `<@${target.id}>`,
            '',
            `**${pad('Total')}** ──  ${stats.total}`,
            `**${pad('Regular')}** ──  ${stats.regular}`,
            `**${pad('Left')}** ──  ${stats.left}`,
            `**${pad('Fake')}** ──  ${stats.fake}`,
            `**${pad('Bonus')}** ──  ${stats.bonus}`
        ];

        if (recent.length > 0) {
            lines.push('');
            lines.push('── Recent Invites ──');
            for (const entry of recent) {
                const relativeTime = `<t:${Math.floor(entry.timestamp / 1000)}:R>`;
                lines.push(VornEmbed.format.bullet(`<@${entry.memberId}> ── ${relativeTime}`));
            }
        }

        if (inviter) {
            lines.push('');
            lines.push(`Invited by <@${inviter.id}>`);
        }

        const embed = VornEmbed.info('Invite Statistics', lines.join('\n'))
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .setFooter({ text: '/invites user' });

        await interaction.editReply({ embeds: [embed] });
    },

    async handleLeaderboard(interaction, client) {
        await interaction.deferReply();

        const page = interaction.options.getInteger('page') || 1;
        const lb = await client.invites.getLeaderboard(interaction.guild.id, page);

        if (lb.entries.length === 0) {
            return interaction.editReply({
                embeds: [VornEmbed.info('Invite Leaderboard', 'No invite data yet')]
            });
        }

        // Try canvas render first
        const LeaderboardRenderer = require('../../utils/LeaderboardRenderer');
        if (LeaderboardRenderer.isAvailable()) {
            try {
                // Build enriched entries with usernames and avatar buffers
                const enriched = [];
                for (const entry of lb.entries) {
                    let username = 'Unknown';
                    let avatarBuffer = null;

                    try {
                        const user = await client.users.fetch(entry.userId);
                        username = user.displayName || user.username;

                        // Fetch avatar as buffer
                        const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 64 });
                        const res = await fetch(avatarUrl);
                        if (res.ok) avatarBuffer = Buffer.from(await res.arrayBuffer());
                    } catch {}

                    enriched.push({
                        userId: entry.userId,
                        username,
                        total: entry.total,
                        avatarBuffer
                    });
                }

                const buffer = await LeaderboardRenderer.render(enriched, {
                    page: lb.page,
                    totalPages: lb.totalPages,
                    guildName: interaction.guild.name
                });

                const { AttachmentBuilder } = require('discord.js');
                const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });

                return interaction.editReply({
                    files: [attachment]
                });
            } catch (err) {
                console.error('[Vorn Invites] Canvas render failed, falling back to embed:', err.message);
            }
        }

        // Fallback: plain text embed
        const lines = [];
        const startRank = (lb.page - 1) * 10;

        for (let i = 0; i < lb.entries.length; i++) {
            const entry = lb.entries[i];
            const rank = String(startRank + i + 1).padStart(2, '0');
            let username;
            try {
                const user = await client.users.fetch(entry.userId);
                username = user.username;
            } catch {
                username = 'Unknown';
            }
            const padding = ' '.repeat(Math.max(1, 20 - username.length));
            lines.push(`\`${rank}.\`  ${username}${padding}──  **${entry.total}** invites`);
        }

        const embed = VornEmbed.info('Invite Leaderboard', lines.join('\n'))
            .setFooter({ text: `Page ${lb.page}/${lb.totalPages} ── /invites leaderboard` });

        await interaction.editReply({ embeds: [embed] });
    },

    async handleCodes(interaction, client) {
        await interaction.deferReply();

        const target = interaction.options.getUser('target') || interaction.user;
        const codes = await client.invites.getCodes(interaction.guild, target.id);

        if (codes.length === 0) {
            return interaction.editReply({
                embeds: [VornEmbed.info('Invite Codes', `<@${target.id}> has no active invite codes`)]
            });
        }

        const lines = [`<@${target.id}>`, ''];

        for (const code of codes) {
            const uses = code.maxUses ? `${code.uses}/${code.maxUses}` : `${code.uses}`;
            const expires = code.expiresAt
                ? `<t:${Math.floor(code.expiresAt / 1000)}:R>`
                : 'Never';

            lines.push(VornEmbed.format.field(`\`${code.code}\``, `${uses} uses ── ${code.channel}`));
            lines.push(VornEmbed.format.bullet(`Expires: ${expires}`));
        }

        const embed = VornEmbed.info('Invite Codes', lines.join('\n'))
            .setFooter({ text: '/invites codes' });

        await interaction.editReply({ embeds: [embed] });
    },

    async handleEnable(interaction, client) {
        const config = await client.invites.getConfig(interaction.guild.id);
        config.enabled = true;
        await client.invites.setConfig(interaction.guild.id, config);

        // Initialize cache for this guild
        try {
            const invites = await interaction.guild.invites.fetch();
            client.invites.inviteCache.set(
                interaction.guild.id,
                new Map(invites.map(i => [i.code, i.uses]))
            );
        } catch { }

        await interaction.reply({
            embeds: [VornEmbed.success('Invite tracking enabled')]
        });
    },

    async handleDisable(interaction, client) {
        const config = await client.invites.getConfig(interaction.guild.id);
        config.enabled = false;
        await client.invites.setConfig(interaction.guild.id, config);

        await interaction.reply({
            embeds: [VornEmbed.success('Invite tracking disabled')]
        });
    },

    async handleConfig(interaction, client) {
        const config = await client.invites.getConfig(interaction.guild.id);
        const channel = interaction.options.getChannel('channel');
        const fakeDays = interaction.options.getInteger('fake_days');
        const fakeLeave = interaction.options.getInteger('fake_leave');

        let changed = false;

        if (channel !== null) {
            config.channelId = channel.id;
            changed = true;
        }
        if (fakeDays !== null) {
            config.fakeDays = fakeDays;
            changed = true;
        }
        if (fakeLeave !== null) {
            config.fakeLeave = fakeLeave;
            changed = true;
        }

        if (!changed) {
            // Show current config
            const lines = [
                VornEmbed.format.field('Status', config.enabled ? 'Enabled' : 'Disabled'),
                VornEmbed.format.field('Log Channel', config.channelId ? `<#${config.channelId}>` : 'Not set'),
                VornEmbed.format.field('Fake Days', `${config.fakeDays} days`),
                VornEmbed.format.field('Fake Leave', `${config.fakeLeave} minutes`),
                VornEmbed.format.field('Rewards', `${config.rewards.length} configured`)
            ];

            return interaction.reply({
                embeds: [VornEmbed.info('Invite Configuration', lines.join('\n'))]
            });
        }

        await client.invites.setConfig(interaction.guild.id, config);

        const updates = [];
        if (channel !== null) updates.push(`Log channel set to <#${channel.id}>`);
        if (fakeDays !== null) updates.push(`Fake detection set to ${fakeDays} days`);
        if (fakeLeave !== null) updates.push(`Quick leave threshold set to ${fakeLeave} minutes`);

        await interaction.reply({
            embeds: [VornEmbed.success(updates.join('\n'))]
        });
    },

    async handleReset(interaction, client) {
        const target = interaction.options.getUser('target');
        const confirm = interaction.options.getBoolean('confirm');

        if (target) {
            await client.invites.resetUser(interaction.guild.id, target.id);
            return interaction.reply({
                embeds: [VornEmbed.success(`Reset invite data for <@${target.id}>`)]
            });
        }

        // Reset all requires confirmation
        if (!confirm) {
            return interaction.reply({
                embeds: [VornEmbed.warning('This will reset **all** invite data for the server. Run again with `confirm: True` to proceed.')],
                ephemeral: true
            });
        }

        await client.invites.resetAll(interaction.guild.id);
        await interaction.reply({
            embeds: [VornEmbed.success('All invite data has been reset')]
        });
    },

    async handleBonus(interaction, client, sub) {
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (sub === 'add') {
            const newTotal = await client.invites.addBonus(interaction.guild.id, user.id, amount);
            await interaction.reply({
                embeds: [VornEmbed.success(`Added **${amount}** bonus invites to <@${user.id}> ── Now has **${newTotal}** total`)]
            });
        } else if (sub === 'remove') {
            const newTotal = await client.invites.removeBonus(interaction.guild.id, user.id, amount);
            await interaction.reply({
                embeds: [VornEmbed.success(`Removed **${amount}** bonus invites from <@${user.id}> ── Now has **${newTotal}** total`)]
            });
        }
    },

    async handleRewards(interaction, client, sub) {
        if (sub === 'add') {
            const count = interaction.options.getInteger('count');
            const role = interaction.options.getRole('role');

            await client.invites.addReward(interaction.guild.id, count, role.id);
            await interaction.reply({
                embeds: [VornEmbed.success(`Reward added ── **${count}** invites awards <@&${role.id}>`)]
            });

        } else if (sub === 'remove') {
            const role = interaction.options.getRole('role');

            await client.invites.removeReward(interaction.guild.id, role.id);
            await interaction.reply({
                embeds: [VornEmbed.success(`Removed reward for <@&${role.id}>`)]
            });

        } else if (sub === 'list') {
            const config = await client.invites.getConfig(interaction.guild.id);

            if (config.rewards.length === 0) {
                return interaction.reply({
                    embeds: [VornEmbed.info('Invite Rewards', 'No rewards configured\n\nUse `/invites rewards add` to create one')]
                });
            }

            const lines = config.rewards.map(r =>
                VornEmbed.format.field(`${r.count} invites`, `<@&${r.roleId}>`)
            );

            await interaction.reply({
                embeds: [VornEmbed.info('Invite Rewards', lines.join('\n'))
                    .setFooter({ text: '/invites rewards' })]
            });
        }
    }
};
