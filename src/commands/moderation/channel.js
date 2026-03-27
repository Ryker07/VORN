/**
 * Vorn — Channel Control Commands
 * Lock, Unlock, Hide, Unhide, Nuke — with modlog integration
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('channel')
        .setDescription('Channel management commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub => sub.setName('lock').setDescription('Deny SendMessages for @everyone'))
        .addSubcommand(sub => sub.setName('unlock').setDescription('Allow SendMessages for @everyone'))
        .addSubcommand(sub => sub.setName('hide').setDescription('Deny ViewChannel for @everyone'))
        .addSubcommand(sub => sub.setName('unhide').setDescription('Allow ViewChannel for @everyone'))
        .addSubcommand(sub => sub.setName('nuke').setDescription('Clone and recreate channel (Clears history)')),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: false });

        const subcommand = interaction.options.getSubcommand();
        const channel = interaction.channel;
        const everyone = interaction.guild.roles.everyone;

        if (subcommand === 'lock') {
            await channel.permissionOverwrites.edit(everyone, { SendMessages: false });
            await interaction.editReply({ embeds: [VornEmbed.success('Channel **locked** for everyone.')] });
            await logChannelAction(client, interaction, 'Lock', channel);
            return;
        }

        if (subcommand === 'unlock') {
            await channel.permissionOverwrites.edit(everyone, { SendMessages: null });
            await interaction.editReply({ embeds: [VornEmbed.success('Channel **unlocked**.')] });
            await logChannelAction(client, interaction, 'Unlock', channel);
            return;
        }

        if (subcommand === 'hide') {
            await channel.permissionOverwrites.edit(everyone, { ViewChannel: false });
            await interaction.editReply({ embeds: [VornEmbed.success('Channel **hidden** from everyone.')] });
            await logChannelAction(client, interaction, 'Hide', channel);
            return;
        }

        if (subcommand === 'unhide') {
            await channel.permissionOverwrites.edit(everyone, { ViewChannel: null });
            await interaction.editReply({ embeds: [VornEmbed.success('Channel **unhidden**.')] });
            await logChannelAction(client, interaction, 'Unhide', channel);
            return;
        }

        if (subcommand === 'nuke') {
            const confirmButton = new ButtonBuilder()
                .setCustomId('confirm_nuke')
                .setLabel('Confirm Nuke')
                .setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_nuke')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            const msg = await interaction.editReply({
                embeds: [VornEmbed.warning('This will delete and recreate this channel. All history will be lost.')],
                components: [row]
            });

            const filter = i => i.user.id === interaction.user.id;
            try {
                const confirmation = await msg.awaitMessageComponent({ filter, time: 15000 });

                if (confirmation.customId === 'confirm_nuke') {
                    const channelName = channel.name;
                    const position = channel.position;
                    const newChannel = await channel.clone();
                    await channel.delete();
                    await newChannel.setPosition(position);
                    await newChannel.send({ embeds: [VornEmbed.success('Channel nuked successfully.')] });

                    // Log nuke action
                    await logChannelAction(client, interaction, 'Nuke', null, channelName);
                } else {
                    await interaction.editReply({ embeds: [VornEmbed.info('Nuke cancelled.')], components: [] });
                }
            } catch {
                await interaction.editReply({ embeds: [VornEmbed.info('Nuke timed out.')], components: [] });
            }
        }
    }
};

/**
 * Log channel action to modlogs channel
 */
async function logChannelAction(client, interaction, action, channel, channelName) {
    try {
        const config = await client.moderation.getConfig(interaction.guild.id);
        if (!config.logChannelId) return;

        const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
        if (!logChannel?.isTextBased()) return;

        const target = channel ? `${channel}` : `#${channelName} (deleted)`;

        const embed = VornEmbed.create()
            .setDescription([
                `### Channel ${action}`,
                '',
                `**Channel** ─ ${target}`,
                `**Moderator** ─ ${interaction.user}`,
                '',
                `-# <t:${Math.floor(Date.now() / 1000)}:R>`
            ].join('\n'));

        logChannel.send({ embeds: [embed] }).catch(() => { });
    } catch { }
}
