/**
 * Vorn — Voice Moderation Commands
 * Mute, Unmute, Deafen, Undeafen, Kick, Move
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Voice moderation commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
        .addSubcommand(sub =>
            sub.setName('mute')
                .setDescription('Server mute a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('unmute')
                .setDescription('Server unmute a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('deafen')
                .setDescription('Server deafen a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('undeafen')
                .setDescription('Server undeafen a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('kick')
                .setDescription('Disconnect a user from voice')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('move')
                .setDescription('Move a user to another channel')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildVoice).setRequired(true))
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: false });

        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user');
        const guild = interaction.guild;

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.editReply({ embeds: [VornEmbed.error('User not found.')] });
        if (!member.voice.channel) return interaction.editReply({ embeds: [VornEmbed.error('User is not in a voice channel.')] });

        if (subcommand === 'mute') {
            await member.voice.setMute(true);
            return interaction.editReply({ embeds: [VornEmbed.success(`Server muted **${user.tag}**`)] });
        }
        if (subcommand === 'unmute') {
            await member.voice.setMute(false);
            return interaction.editReply({ embeds: [VornEmbed.success(`Server unmuted **${user.tag}**`)] });
        }
        if (subcommand === 'deafen') {
            await member.voice.setDeaf(true);
            return interaction.editReply({ embeds: [VornEmbed.success(`Server deafened **${user.tag}**`)] });
        }
        if (subcommand === 'undeafen') {
            await member.voice.setDeaf(false);
            return interaction.editReply({ embeds: [VornEmbed.success(`Server undeafened **${user.tag}**`)] });
        }
        if (subcommand === 'kick') {
            await member.voice.disconnect();
            return interaction.editReply({ embeds: [VornEmbed.success(`Disconnected **${user.tag}**`)] });
        }
        if (subcommand === 'move') {
            const channel = interaction.options.getChannel('channel');
            await member.voice.setChannel(channel);
            return interaction.editReply({ embeds: [VornEmbed.success(`Moved **${user.tag}** to ${channel.name}`)] });
        }
    }
};
