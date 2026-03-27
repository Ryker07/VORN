/**
 * Vorn — User Moderation Commands
 * Ban, Tempban, Softban, Kick, Timeout, Untimeout, Unban
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('User moderation commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        // --- TIMEOUT ---
        .addSubcommand(sub =>
            sub.setName('timeout')
                .setDescription('Timeout (mute) a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                .addStringOption(opt => opt.setName('duration').setDescription('Duration (1m, 1h, 1d)').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for timeout'))
        )
        // --- UNTIMEOUT ---
        .addSubcommand(sub =>
            sub.setName('untimeout')
                .setDescription('Remove timeout from a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for untimeout'))
        )
        // --- KICK ---
        .addSubcommand(sub =>
            sub.setName('kick')
                .setDescription('Kick a user from the server')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick'))
        )
        // --- BAN ---
        .addSubcommand(sub =>
            sub.setName('ban')
                .setDescription('Ban a user from the server')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(false))
                .addStringOption(opt => opt.setName('userid').setDescription('Target user ID (if not in server)').setRequired(false))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban'))
                .addStringOption(opt =>
                    opt.setName('duration')
                        .setDescription('Temp-ban duration (e.g. 1d, 7d) — leave empty for permanent')
                )
                .addStringOption(opt =>
                    opt.setName('delete_messages')
                        .setDescription('Delete message history')
                        .addChoices(
                            { name: 'None', value: '0' },
                            { name: 'Previous Hour', value: '3600' },
                            { name: 'Previous 6 Hours', value: '21600' },
                            { name: 'Previous 12 Hours', value: '43200' },
                            { name: 'Previous 24 Hours', value: '86400' },
                            { name: 'Previous 3 Days', value: '259200' },
                            { name: 'Previous 7 Days', value: '604800' }
                        )
                )
        )
        // --- SOFTBAN ---
        .addSubcommand(sub =>
            sub.setName('softban')
                .setDescription('Ban and immediately unban to clear messages')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for softban'))
        )
        // --- UNBAN ---
        .addSubcommand(sub =>
            sub.setName('unban')
                .setDescription('Unban a user by ID')
                .addStringOption(opt => opt.setName('userid').setDescription('ID of user to unban').setRequired(true))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for unban'))
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: false });

        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const moderator = interaction.user;
        const guild = interaction.guild;

        if (user && user.id === moderator.id) {
            return interaction.editReply({ embeds: [VornEmbed.error('You cannot moderate yourself.')] });
        }

        if (user && user.id === client.user.id) {
            return interaction.editReply({ embeds: [VornEmbed.error('I cannot moderate myself.')] });
        }

        // --- TIMEOUT ---
        if (subcommand === 'timeout') {
            const durationStr = interaction.options.getString('duration');
            const member = await guild.members.fetch(user.id).catch(() => null);

            if (!member) return interaction.editReply({ embeds: [VornEmbed.error('User not found in server.')] });
            if (!member.moderatable) return interaction.editReply({ embeds: [VornEmbed.error('I cannot timeout this user (Hierarchy check).')] });

            const ms = parseDuration(durationStr);
            if (!ms) return interaction.editReply({ embeds: [VornEmbed.error('Invalid duration format. Use 1m, 1h, 1d.')] });

            await member.timeout(ms, reason);
            const caseId = await client.moderation.createCase(guild, 'TIMEOUT', user, moderator, reason, { duration: durationStr });

            return interaction.editReply({
                embeds: [VornEmbed.success(`#${caseId} · Timed out **${user.tag}** for **${durationStr}**`)]
            });
        }

        // --- UNTIMEOUT ---
        if (subcommand === 'untimeout') {
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return interaction.editReply({ embeds: [VornEmbed.error('User not found in server.')] });
            if (!member.isCommunicationDisabled()) return interaction.editReply({ embeds: [VornEmbed.error('User is not timed out.')] });

            await member.timeout(null, reason);
            const caseId = await client.moderation.createCase(guild, 'UNTIMEOUT', user, moderator, reason);

            return interaction.editReply({
                embeds: [VornEmbed.success(`#${caseId} · Removed timeout from **${user.tag}**`)]
            });
        }

        // --- KICK ---
        if (subcommand === 'kick') {
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return interaction.editReply({ embeds: [VornEmbed.error('User not found in server.')] });
            if (!member.kickable) return interaction.editReply({ embeds: [VornEmbed.error('I cannot kick this user (Hierarchy check).')] });

            await member.kick(reason);
            const caseId = await client.moderation.createCase(guild, 'KICK', user, moderator, reason);

            return interaction.editReply({
                embeds: [VornEmbed.success(`#${caseId} · Kicked **${user.tag}**`)]
            });
        }

        // --- BAN ---
        if (subcommand === 'ban') {
            const userOpt = interaction.options.getUser('user');
            const userIdOpt = interaction.options.getString('userid');
            const targetId = userOpt ? userOpt.id : userIdOpt;

            if (!targetId) {
                return interaction.editReply({ embeds: [VornEmbed.error('Please provide either a user or a userid.')] });
            }

            const deleteSeconds = parseInt(interaction.options.getString('delete_messages') || '0');
            const durationStr = interaction.options.getString('duration');
            const reasonWithRaw = reason + (userIdOpt && !userOpt ? ' (Used Raw ID)' : '');

            const member = await guild.members.fetch(targetId).catch(() => null);

            if (member && !member.bannable) return interaction.editReply({ embeds: [VornEmbed.error('I cannot ban this user (Hierarchy check).')] });

            try {
                await guild.members.ban(targetId, { reason: reasonWithRaw, deleteMessageSeconds: deleteSeconds });
            } catch (err) {
                return interaction.editReply({ embeds: [VornEmbed.error(`Ban failed (Invalid ID or unknown user): ${err.message}`)] });
            }

            // Persist ban to explicit database blacklist
            const persistentBans = await client.db.get(guild.id, 'persistent_bans') || [];
            if (!persistentBans.includes(targetId)) {
                persistentBans.push(targetId);
                await client.db.set(guild.id, 'persistent_bans', persistentBans);
            }

            const targetUserObj = userOpt || { id: targetId, tag: `ID:${targetId}` };

            if (durationStr) {
                // Temp-ban
                const ms = parseDuration(durationStr);
                if (!ms) return interaction.editReply({ embeds: [VornEmbed.error('Invalid duration format for temp-ban.')] });

                await client.moderation.addTempAction(guild.id, targetId, 'TEMPBAN', Date.now() + ms);
                const caseId = await client.moderation.createCase(guild, 'TEMPBAN', targetUserObj, moderator, reasonWithRaw, { duration: durationStr });

                return interaction.editReply({
                    embeds: [VornEmbed.success(`#${caseId} · Temp-banned **${targetUserObj.tag}** for **${durationStr}**`)]
                });
            } else {
                const caseId = await client.moderation.createCase(guild, 'BAN', targetUserObj, moderator, reasonWithRaw);
                return interaction.editReply({
                    embeds: [VornEmbed.success(`#${caseId} · Banned **${targetUserObj.tag}**`)]
                });
            }
        }

        // --- SOFTBAN ---
        if (subcommand === 'softban') {
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (member && !member.bannable) return interaction.editReply({ embeds: [VornEmbed.error('I cannot ban this user.')] });

            await guild.members.ban(user.id, { reason, deleteMessageSeconds: 604800 }); // 7 days
            await guild.members.unban(user.id, 'Softban unban');

            const caseId = await client.moderation.createCase(guild, 'SOFTBAN', user, moderator, reason);

            return interaction.editReply({
                embeds: [VornEmbed.success(`#${caseId} · Softbanned **${user.tag}**`)]
            });
        }

        // --- UNBAN ---
        if (subcommand === 'unban') {
            const userId = interaction.options.getString('userid');
            try {
                await guild.members.unban(userId, reason);
                const mockUser = { id: userId, tag: `ID:${userId}` };
                const caseId = await client.moderation.createCase(guild, 'UNBAN', mockUser, moderator, reason);

                return interaction.editReply({
                    embeds: [VornEmbed.success(`#${caseId} · Unbanned **${userId}**`)]
                });
            } catch (error) {
                return interaction.editReply({ embeds: [VornEmbed.error(`Failed to unban: ${error.message}`)] });
            }
        }
    }
};

function parseDuration(str) {
    const match = str.match(/^(\d+)([smhd])$/);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2];
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return val * multipliers[unit];
}
