/**
 * Vorn — Logging: Member Events
 * Tracks joins, leaves, nickname changes, role changes, bans, unbans, timeouts
 */

const { AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'logging_members',
    once: false,

    async register(client) {
        // Member Join
        client.on('guildMemberAdd', async (member) => {
            try {
                if (!client.logging) return;
                if (member.user.bot && !await client.logging.shouldLogBots(member.guild.id)) return;

                if (await client.logging.shouldIgnore(member.guild.id, {
                    userId: member.id
                })) return;

                const embed = client.logging.memberJoinEmbed(member);
                await client.logging.send(member.guild, 'members', embed);
            } catch { }
        });

        // Member Leave
        client.on('guildMemberRemove', async (member) => {
            try {
                if (!client.logging) return;
                if (member.user.bot && !await client.logging.shouldLogBots(member.guild.id)) return;

                if (await client.logging.shouldIgnore(member.guild.id, {
                    userId: member.id
                })) return;

                const embed = client.logging.memberLeaveEmbed(member);
                await client.logging.send(member.guild, 'members', embed);
            } catch { }
        });

        // Member Update (nickname, roles, avatar, timeout)
        client.on('guildMemberUpdate', async (oldMember, newMember) => {
            try {
                if (!client.logging) return;
                if (newMember.user.bot && !await client.logging.shouldLogBots(newMember.guild.id)) return;

                if (await client.logging.shouldIgnore(newMember.guild.id, {
                    userId: newMember.id
                })) return;

                const changes = [];

                // Nickname change
                if (oldMember.nickname !== newMember.nickname) {
                    changes.push(`**Nickname** ─ \`${oldMember.nickname || 'None'}\` → \`${newMember.nickname || 'None'}\``);
                }

                // Role changes
                const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
                const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

                if (addedRoles.size > 0) {
                    changes.push(`**Role Added** ─ ${addedRoles.map(r => `<@&${r.id}>`).join(' ')}`);
                }
                if (removedRoles.size > 0) {
                    changes.push(`**Role Removed** ─ ${removedRoles.map(r => `<@&${r.id}>`).join(' ')}`);
                }

                // Timeout change
                if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
                    if (newMember.communicationDisabledUntilTimestamp) {
                        const until = Math.floor(newMember.communicationDisabledUntilTimestamp / 1000);
                        const duration = newMember.communicationDisabledUntilTimestamp - Date.now();
                        const config = await client.logging.getConfig(newMember.guild.id);
                        const actor = await client.logging.getAuditActor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id, config);

                        const embed = client.logging.memberTimeoutEmbed(
                            newMember,
                            client.logging.formatDuration(duration),
                            actor
                        );
                        await client.logging.send(newMember.guild, 'moderation', embed);
                        return; // Don't send as member update too
                    } else {
                        changes.push(`**Timeout** ─ Removed`);
                    }
                }

                // Avatar change
                if (oldMember.avatar !== newMember.avatar) {
                    changes.push(`**Server Avatar** ─ Changed`);
                }

                // Boost
                if (!oldMember.premiumSince && newMember.premiumSince) {
                    changes.push(`**Boost** ─ Started boosting`);
                } else if (oldMember.premiumSince && !newMember.premiumSince) {
                    changes.push(`**Boost** ─ Stopped boosting`);
                }

                if (changes.length === 0) return;

                const embed = client.logging.memberUpdateEmbed(oldMember, newMember, changes);
                await client.logging.send(newMember.guild, 'members', embed);
            } catch { }
        });

        // Ban
        client.on('guildBanAdd', async (ban) => {
            try {
                if (!client.logging) return;

                const config = await client.logging.getConfig(ban.guild.id);
                const actor = await client.logging.getAuditActor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id, config);

                const embed = client.logging.memberBanEmbed(ban, actor);
                await client.logging.send(ban.guild, 'moderation', embed);
            } catch { }
        });

        // Unban
        client.on('guildBanRemove', async (ban) => {
            try {
                if (!client.logging) return;

                const config = await client.logging.getConfig(ban.guild.id);
                const actor = await client.logging.getAuditActor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id, config);

                const embed = client.logging.memberUnbanEmbed(ban, actor);
                await client.logging.send(ban.guild, 'moderation', embed);
            } catch { }
        });
    }
};
