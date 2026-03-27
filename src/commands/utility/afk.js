/**
 * Vorn — /afk Command
 * Set your status to Away From Keyboard
 */

const { SlashCommandBuilder } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set your status to away')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Why are you going away?')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        // Defer because database operations might take a ms
        await interaction.deferReply({ ephemeral: true }); // Ephemeral so we don't spam chat

        const reason = interaction.options.getString('reason') || 'AFK';

        await client.afk.setAfk(interaction.guild.id, interaction.user.id, reason);

        // Update nickname if possible (Optional polish)
        if (interaction.member.manageable && !interaction.member.displayName.startsWith('[AFK]')) {
            try {
                const newName = `[AFK] ${interaction.member.displayName}`.slice(0, 32);
                await interaction.member.setNickname(newName);
            } catch (e) {
                // Ignore permissions errors
            }
        }

        return interaction.editReply({
            embeds: [VornEmbed.success(`**Status Updated**\nI've set your status to **AFK**: ${reason}`)]
        });
    }
};
