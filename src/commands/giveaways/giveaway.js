/**
 * Vorn — Giveaway Commands
 * Start, End, Reroll, Delete, Clean, List, Pause, Resume, Drop, Schedule
 */

const {
    SlashCommandBuilder, PermissionFlagsBits,
    ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder
} = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Giveaway management')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        // --- CREATE (Modal Wizard) ---
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a giveaway via wizard')
        )
        // --- START (Full Options) ---
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Start a giveaway with full options')
                .addStringOption(opt => opt.setName('prize').setDescription('Prize name').setRequired(true))
                .addStringOption(opt => opt.setName('duration').setDescription('Duration (10m, 1h, 2d)').setRequired(true))
                .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1).setMaxValue(20))
                .addRoleOption(opt => opt.setName('required_role').setDescription('Required role to enter'))
                .addRoleOption(opt => opt.setName('bonus_role').setDescription('Role that gets bonus entries'))
                .addIntegerOption(opt => opt.setName('bonus_entries').setDescription('Number of bonus entries for the bonus role').setMinValue(1).setMaxValue(10))
                .addIntegerOption(opt => opt.setName('min_account_age').setDescription('Minimum account age in days').setMinValue(1))
                .addIntegerOption(opt => opt.setName('min_server_days').setDescription('Minimum days in server').setMinValue(1))
                // --- Premium Requirements ---
                .addRoleOption(opt => opt.setName('blacklist_role').setDescription('Role to blacklist from entering'))
                .addRoleOption(opt => opt.setName('bypass_role').setDescription('Role that bypasses all requirements'))
                .addBooleanOption(opt => opt.setName('voice_requirement').setDescription('Require users to be in a voice channel'))
                // --- Visuals & Aesthetics ---
                .addRoleOption(opt => opt.setName('ping_role').setDescription('Role to ping when giveaway starts'))
                .addStringOption(opt => opt.setName('color').setDescription('Embed color hex (e.g. #ff0000)'))
                .addStringOption(opt => opt.setName('description').setDescription('Custom description'))
                .addStringOption(opt => opt.setName('banner').setDescription('Image URL for the giveaway embed banner'))
                .addStringOption(opt => opt.setName('sponsor').setDescription('Custom sponsor text/mention (Hosted by)'))
        )
        // --- EDIT ---
        .addSubcommand(sub =>
            sub.setName('edit')
                .setDescription('Edit an active giveaway')
                .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true).setAutocomplete(true))
                .addStringOption(opt => opt.setName('prize').setDescription('New prize name'))
                .addStringOption(opt => opt.setName('duration').setDescription('Add duration (e.g. 1h, -30m) or set new end time'))
                .addIntegerOption(opt => opt.setName('winners').setDescription('New winner count').setMinValue(1).setMaxValue(20))
        )
        // --- DROP ---
        .addSubcommand(sub =>
            sub.setName('drop')
                .setDescription('Start a drop giveaway (first N to click win)')
                .addStringOption(opt => opt.setName('prize').setDescription('Prize name').setRequired(true))
                .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1).setMaxValue(10))
        )
        // --- SCHEDULE ---
        .addSubcommand(sub =>
            sub.setName('schedule')
                .setDescription('Schedule a giveaway to start later')
                .addStringOption(opt => opt.setName('prize').setDescription('Prize name').setRequired(true))
                .addStringOption(opt => opt.setName('starts_in').setDescription('When to start (e.g. 1h, 30m)').setRequired(true))
                .addStringOption(opt => opt.setName('duration').setDescription('Duration after start (e.g. 2h)').setRequired(true))
                .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1).setMaxValue(20))
        )
        // --- PAUSE ---
        .addSubcommand(sub =>
            sub.setName('pause')
                .setDescription('Pause an active giveaway')
                .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
        )
        // --- RESUME ---
        .addSubcommand(sub =>
            sub.setName('resume')
                .setDescription('Resume a paused giveaway')
                .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
        )
        // --- END ---
        .addSubcommand(sub =>
            sub.setName('end')
                .setDescription('End a giveaway early')
                .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true).setAutocomplete(true))
        )
        // --- REROLL ---
        .addSubcommand(sub =>
            sub.setName('reroll')
                .setDescription('Reroll winners for an ended giveaway')
                .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true).setAutocomplete(true))
                .addIntegerOption(opt => opt.setName('winners').setDescription('Number of new winners').setMinValue(1))
        )
        // --- DELETE ---
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a giveaway')
                .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true).setAutocomplete(true))
        )
        // --- CLEAN ---
        .addSubcommand(sub =>
            sub.setName('clean')
                .setDescription('Remove ended giveaways from database')
        )
        // --- LIST ---
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all giveaways')
        ),

    // ═══════════════════════════════════════════════════════════════
    // AUTOCOMPLETE — suggest active giveaway message IDs
    // ═══════════════════════════════════════════════════════════════
    async autocomplete(interaction, client) {
        const config = await client.giveawayManager.getGiveaways(interaction.guild.id);
        const choices = config.giveaways.slice(0, 25).map(g => ({
            name: `${g.prize} (${g.ended ? 'ended' : g.paused ? 'paused' : 'active'})`,
            value: g.messageId
        }));
        await interaction.respond(choices);
    },

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();

        // --- CREATE (Dashboard Wizard) ---
        if (sub === 'create') {
            return client.giveawayWizard.startWizard(interaction);
        }

        await interaction.deferReply({ ephemeral: true });

        // --- START ---
        if (sub === 'start') {
            const prize = interaction.options.getString('prize');
            const durationStr = interaction.options.getString('duration');
            const winners = interaction.options.getInteger('winners');
            const reqRole = interaction.options.getRole('required_role');
            const bonusRole = interaction.options.getRole('bonus_role');
            const bonusCount = interaction.options.getInteger('bonus_entries') || 1;
            const minAccountAge = interaction.options.getInteger('min_account_age') || null;
            const minServerDays = interaction.options.getInteger('min_server_days') || null;
            const blacklistRole = interaction.options.getRole('blacklist_role');
            const bypassRole = interaction.options.getRole('bypass_role');
            const voiceReq = interaction.options.getBoolean('voice_requirement') || false;

            const color = interaction.options.getString('color') || null;
            const description = interaction.options.getString('description') || null;
            const banner = interaction.options.getString('banner') || null;
            const sponsor = interaction.options.getString('sponsor') || null;
            const pingRole = interaction.options.getRole('ping_role');

            const duration = parseDuration(durationStr);
            if (!duration) {
                return interaction.editReply({ embeds: [VornEmbed.error('Invalid duration. Use: 10m, 1h, 2d')] });
            }

            const data = {
                channel: interaction.channel,
                prize,
                duration,
                winners,
                reqRoleIds: reqRole ? [reqRole.id] : [],
                minAccountAge,
                minMemberAge: minServerDays,
                bonusRoles: bonusRole ? [{ roleId: bonusRole.id, bonusEntries: bonusCount }] : [],
                blacklistRoleIds: blacklistRole ? [blacklistRole.id] : [],
                bypassRoleIds: bypassRole ? [bypassRole.id] : [],
                voiceRequirement: voiceReq,
                embedColor: color,
                embedDescription: description,
                bannerUrl: banner,
                sponsorText: sponsor,
                pingRoleId: pingRole ? pingRole.id : null
            };

            await client.giveawayManager.createGiveaway(interaction, data);
            return interaction.editReply({ embeds: [VornEmbed.success(`Giveaway for **${prize}** started!`)] });
        }

        // --- DROP ---
        if (sub === 'drop') {
            const prize = interaction.options.getString('prize');
            const winners = interaction.options.getInteger('winners');

            const data = {
                channel: interaction.channel,
                prize,
                duration: 86400000, // 24h max, but ends when slots fill
                winners,
                dropMode: true,
                dropCount: winners
            };

            await client.giveawayManager.createGiveaway(interaction, data);
            return interaction.editReply({ embeds: [VornEmbed.success(`Drop giveaway for **${prize}** started! First **${winners}** to click win.`)] });
        }

        // --- SCHEDULE ---
        if (sub === 'schedule') {
            const prize = interaction.options.getString('prize');
            const startsInStr = interaction.options.getString('starts_in');
            const durationStr = interaction.options.getString('duration');
            const winners = interaction.options.getInteger('winners');

            const startsIn = parseDuration(startsInStr);
            const duration = parseDuration(durationStr);

            if (!startsIn) return interaction.editReply({ embeds: [VornEmbed.error('Invalid start time.')] });
            if (!duration) return interaction.editReply({ embeds: [VornEmbed.error('Invalid duration.')] });

            const data = {
                channel: interaction.channel,
                prize,
                duration,
                winners,
                startTimestamp: Date.now() + startsIn
            };

            await client.giveawayManager.createGiveaway(interaction, data);
            return interaction.editReply({
                embeds: [VornEmbed.success(`Giveaway for **${prize}** scheduled! Starts in **${startsInStr}**, runs for **${durationStr}**.`)]
            });
        }

        // --- EDIT ---
        if (sub === 'edit') {
            const messageId = interaction.options.getString('message_id');
            const newPrize = interaction.options.getString('prize');
            const newDurationStr = interaction.options.getString('duration');
            const newWinners = interaction.options.getInteger('winners');

            const config = await client.giveawayManager.getGiveaways(interaction.guild.id);
            const giveaway = config.giveaways.find(g => g.messageId === messageId && !g.ended);

            if (!giveaway) return interaction.editReply({ embeds: [VornEmbed.error('Active giveaway not found.')] });

            let updated = false;

            if (newPrize) {
                giveaway.prize = newPrize;
                updated = true;
            }

            if (newWinners) {
                giveaway.winners = newWinners;
                updated = true;
            }

            if (newDurationStr) {
                let addTime = true;
                let parseStr = newDurationStr;
                if (newDurationStr.startsWith('-')) {
                    addTime = false;
                    parseStr = newDurationStr.substring(1);
                } else if (newDurationStr.startsWith('+')) {
                    parseStr = newDurationStr.substring(1);
                }

                const ms = parseDuration(parseStr);
                if (!ms) return interaction.editReply({ embeds: [VornEmbed.error('Invalid duration format. Use: 1h, -30m, +2d')] });

                if (addTime) {
                    giveaway.endTimestamp += ms;
                } else {
                    giveaway.endTimestamp -= ms;
                }
                updated = true;
            }

            if (!updated) {
                return interaction.editReply({ embeds: [VornEmbed.error('You must provide at least one option to edit.')] });
            }

            await client.giveawayManager.setConfig(interaction.guild.id, config);
            await client.giveawayManager.updateGiveawayEmbed(interaction.guild, giveaway);

            return interaction.editReply({ embeds: [VornEmbed.success('Giveaway successfully updated!')] });
        }

        // --- PAUSE ---
        if (sub === 'pause') {
            const messageId = interaction.options.getString('message_id');
            const result = await client.giveawayManager.pauseGiveaway(interaction.guild.id, messageId);

            if (result.success) {
                return interaction.editReply({ embeds: [VornEmbed.success('Giveaway paused')] });
            }
            return interaction.editReply({ embeds: [VornEmbed.error(result.error)] });
        }

        // --- RESUME ---
        if (sub === 'resume') {
            const messageId = interaction.options.getString('message_id');
            const result = await client.giveawayManager.resumeGiveaway(interaction.guild.id, messageId);

            if (result.success) {
                return interaction.editReply({ embeds: [VornEmbed.success('Giveaway resumed')] });
            }
            return interaction.editReply({ embeds: [VornEmbed.error(result.error)] });
        }

        // --- END ---
        if (sub === 'end') {
            const messageId = interaction.options.getString('message_id');
            const winners = await client.giveawayManager.endGiveaway(interaction.guild.id, messageId);

            if (winners) {
                return interaction.editReply({ embeds: [VornEmbed.success('Giveaway ended!')] });
            }
            return interaction.editReply({ embeds: [VornEmbed.error('Giveaway not found or already ended.')] });
        }

        // --- REROLL ---
        if (sub === 'reroll') {
            const messageId = interaction.options.getString('message_id');
            const count = interaction.options.getInteger('winners') || 1;
            const winners = await client.giveawayManager.rerollGiveaway(interaction.guild.id, messageId, count);

            if (winners && winners.length > 0) {
                return interaction.editReply({ embeds: [VornEmbed.success(`Rerolled ${winners.length} winner(s)`)] });
            }
            return interaction.editReply({ embeds: [VornEmbed.error('No eligible entries found for reroll.')] });
        }

        // --- DELETE ---
        if (sub === 'delete') {
            const messageId = interaction.options.getString('message_id');
            const deleted = await client.giveawayManager.deleteGiveaway(interaction.guild.id, messageId);

            if (deleted) {
                return interaction.editReply({ embeds: [VornEmbed.success('Giveaway deleted')] });
            }
            return interaction.editReply({ embeds: [VornEmbed.error('Giveaway not found.')] });
        }

        // --- CLEAN ---
        if (sub === 'clean') {
            const count = await client.giveawayManager.cleanGiveaways(interaction.guild.id);
            return interaction.editReply({ embeds: [VornEmbed.success(`Cleaned **${count}** ended giveaways`)] });
        }

        // --- LIST ---
        if (sub === 'list') {
            const giveaways = await client.giveawayManager.listGiveaways(interaction.guild.id);

            if (giveaways.length === 0) {
                return interaction.editReply({ embeds: [VornEmbed.info('Giveaways', 'No giveaways found.')] });
            }

            const lines = giveaways.slice(0, 15).map(g => {
                let status = g.ended ? '[ENDED]' : g.paused ? '[PAUSED]' : g.dropMode ? '[DROP MODE]' : '[ACTIVE]';
                if (!g.ended && !g.paused && g.startTimestamp > Date.now()) status = '⏰ Scheduled';
                const entries = [...new Set(g.entries)].length;
                return `${status} **${g.prize}** ─ ${entries} entries\n-# ID: \`${g.messageId}\``;
            });

            if (giveaways.length > 15) lines.push(`-# ...and ${giveaways.length - 15} more`);

            return interaction.editReply({
                embeds: [VornEmbed.info('Giveaways', lines.join('\n\n'))]
            });
        }
    }
};

function parseDuration(str) {
    if (!str) return null;
    const match = str.match(/^(\d+)([smhd])$/);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2];
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return val * multipliers[unit];
}
