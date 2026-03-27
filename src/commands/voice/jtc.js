/**
 * Vorn — Join-to-Create Commands
 * Setup and manage dynamic voice hubs
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jtc')
        .setDescription('Manage Join-to-Create voice system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Set up a new voice hub')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Existing voice channel to use (optional)')
                        .addChannelTypes(ChannelType.GuildVoice)
                )
                .addStringOption(opt =>
                    opt.setName('default_name')
                        .setDescription('Default name pattern (use {user} for username)')
                )
        )
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Disable the JTC system')
        )
        .addSubcommand(sub =>
            sub.setName('config')
                .setDescription('View current configuration')
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;

        if (sub === 'setup') {
            let channel = interaction.options.getChannel('channel');
            const defaultName = interaction.options.getString('default_name') || "{user}'s Channel";

            // If no channel provided, create one
            if (!channel) {
                try {
                    channel = await guild.channels.create({
                        name: '➕ Join to Create',
                        type: ChannelType.GuildVoice,
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone,
                                allow: [PermissionFlagsBits.Connect]
                            }
                        ]
                    });
                } catch (err) {
                    return interaction.editReply({
                        embeds: [VornEmbed.error(`Failed to create channel: ${err.message}`)]
                    });
                }
            }

            // Save config
            const config = {
                enabled: true,
                hubId: channel.id,
                categoryId: channel.parentId,
                defaultName: defaultName,
                defaultLimit: 0
            };

            await client.voiceManager.setConfig(guild.id, config);

            return interaction.editReply({
                embeds: [
                    VornEmbed.success('Join-to-Create Hub Configured')
                        .setDescription(`**Hub Channel:** ${channel}\n**Name Pattern:** \`${defaultName}\`\n\nJoin the channel to create your own temp voice!`)
                ]
            });
        }

        if (sub === 'disable') {
            await client.voiceManager.setConfig(guild.id, { enabled: false, hubId: null });
            return interaction.editReply({
                embeds: [VornEmbed.success('Join-to-Create system disabled.')]
            });
        }

        if (sub === 'config') {
            const config = await client.voiceManager.getConfig(guild.id);

            const hub = config.hubId ? `<#${config.hubId}>` : 'None';
            const status = config.enabled && config.hubId ? 'Active' : 'Inactive';

            const embed = VornEmbed.create()
                .setTitle('Voice System Configuration')
                .addFields(
                    { name: 'Status', value: status, inline: true },
                    { name: 'Hub Channel', value: hub, inline: true },
                    { name: 'Name Pattern', value: `\`${config.defaultName || "{user}'s Channel"}\``, inline: true },
                    { name: 'Active Channels', value: client.voiceManager.activeChannels.size.toString(), inline: true }
                );

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
