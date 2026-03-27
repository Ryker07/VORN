/**
 * Vorn — Logging: Voice Events
 * Tracks voice join, leave, move, server mute/deafen, stream, video
 */

module.exports = {
    name: 'logging_voice',
    once: false,

    async register(client) {
        client.on('voiceStateUpdate', async (oldState, newState) => {
            try {
                if (!client.logging) return;

                const member = newState.member || oldState.member;
                if (!member) return;

                const guild = newState.guild || oldState.guild;
                if (!guild) return;

                if (member.user.bot && !await client.logging.shouldLogBots(guild.id)) return;

                if (await client.logging.shouldIgnore(guild.id, {
                    userId: member.id
                })) return;

                // Join
                if (!oldState.channelId && newState.channelId) {
                    const embed = client.logging.voiceStateEmbed(member, 'Join', {
                        channel: newState.channel
                    });
                    await client.logging.send(guild, 'voice', embed);
                    return;
                }

                // Leave
                if (oldState.channelId && !newState.channelId) {
                    const embed = client.logging.voiceStateEmbed(member, 'Leave', {
                        channel: oldState.channel
                    });
                    await client.logging.send(guild, 'voice', embed);
                    return;
                }

                // Move
                if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                    const embed = client.logging.voiceStateEmbed(member, 'Move', {
                        oldChannel: oldState.channel,
                        newChannel: newState.channel
                    });
                    await client.logging.send(guild, 'voice', embed);
                    return;
                }

                // State changes (mute, deafen, stream, video)
                const stateChanges = [];

                if (oldState.serverMute !== newState.serverMute) {
                    stateChanges.push(`**Server Mute** ─ ${newState.serverMute ? 'Muted' : 'Unmuted'}`);
                }
                if (oldState.serverDeaf !== newState.serverDeaf) {
                    stateChanges.push(`**Server Deafen** ─ ${newState.serverDeaf ? 'Deafened' : 'Undeafened'}`);
                }
                if (oldState.streaming !== newState.streaming) {
                    stateChanges.push(`**Stream** ─ ${newState.streaming ? 'Started' : 'Stopped'}`);
                }
                if (oldState.selfVideo !== newState.selfVideo) {
                    stateChanges.push(`**Camera** ─ ${newState.selfVideo ? 'Enabled' : 'Disabled'}`);
                }

                if (stateChanges.length > 0) {
                    const embed = client.logging.createEmbed(client.logging.COLORS.update)
                        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                        .setDescription([
                            `### Voice State`,
                            '',
                            `**User** ─ ${member} \`${member.user.tag}\``,
                            `**Channel** ─ <#${newState.channelId}>`,
                            '',
                            ...stateChanges
                        ].join('\n'))
                        .setFooter({ text: `ID: ${member.id}` });

                    await client.logging.send(guild, 'voice', embed);
                }
            } catch { }
        });
    }
};
