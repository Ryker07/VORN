const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editor')
        .setDescription('Open the visual welcome card editor')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction, client) {
        if (!client.welcomeEditor) {
            return interaction.reply({
                embeds: [VornEmbed.error('Editor not initialized.')],
                ephemeral: true
            });
        }

        await client.welcomeEditor.start(interaction);
    }
};
