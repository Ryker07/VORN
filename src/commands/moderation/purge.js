/**
 * Vorn — Message Purge Commands
 * Smart purging with advanced filters
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Bulk delete messages')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        // --- ALL ---
        .addSubcommand(sub =>
            sub.setName('all')
                .setDescription('Delete a number of messages')
                .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
        )
        // --- USER ---
        .addSubcommand(sub =>
            sub.setName('user')
                .setDescription('Delete messages from a specific user')
                .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to check').setRequired(true).setMinValue(1).setMaxValue(100))
                .addUserOption(opt => opt.setName('target').setDescription('The user').setRequired(true))
        )
        // --- BOTS ---
        .addSubcommand(sub =>
            sub.setName('bots')
                .setDescription('Delete messages from bots only')
                .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to check').setRequired(true).setMinValue(1).setMaxValue(100))
        )
        // --- LINKS ---
        .addSubcommand(sub =>
            sub.setName('links')
                .setDescription('Delete messages containing links')
                .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to check').setRequired(true).setMinValue(1).setMaxValue(100))
        )
        // --- IMAGES ---
        .addSubcommand(sub =>
            sub.setName('images')
                .setDescription('Delete messages containing images/attachments')
                .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to check').setRequired(true).setMinValue(1).setMaxValue(100))
        )
        // --- CONTAINS ---
        .addSubcommand(sub =>
            sub.setName('contains')
                .setDescription('Delete messages containing specific text')
                .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to check').setRequired(true).setMinValue(1).setMaxValue(100))
                .addStringOption(opt => opt.setName('text').setDescription('Text to search for').setRequired(true))
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const amount = interaction.options.getInteger('amount');
        const channel = interaction.channel;

        // Verify channel allows bulk delete (messages < 14 days old)
        // We'll let Discord handle the 14-day error naturally or filter it

        let messages = await channel.messages.fetch({ limit: amount });
        let toDelete = [];

        // --- FILTER LOGIC ---
        if (subcommand === 'all') {
            toDelete = messages;
        } else if (subcommand === 'user') {
            const target = interaction.options.getUser('target');
            toDelete = messages.filter(m => m.author.id === target.id);
        } else if (subcommand === 'bots') {
            toDelete = messages.filter(m => m.author.bot);
        } else if (subcommand === 'links') {
            const linkRegex = /https?:\/\/[^\s]+/;
            toDelete = messages.filter(m => linkRegex.test(m.content));
        } else if (subcommand === 'images') {
            toDelete = messages.filter(m => m.attachments.size > 0 || m.embeds.some(e => e.image || e.thumbnail));
        } else if (subcommand === 'contains') {
            const text = interaction.options.getString('text').toLowerCase();
            toDelete = messages.filter(m => m.content.toLowerCase().includes(text));
        }

        if (toDelete.size === 0) {
            return interaction.editReply({ embeds: [VornEmbed.info('Purge', 'No messages found matching criteria.')] });
        }

        try {
            const deleted = await channel.bulkDelete(toDelete, true);

            // Log to modlogs if configured
            if (deleted.size > 0) {
                try {
                    const modConfig = await client.moderation.getConfig(interaction.guild.id);
                    if (modConfig.logChannelId) {
                        const logChannel = interaction.guild.channels.cache.get(modConfig.logChannelId);
                        if (logChannel?.isTextBased()) {
                            const embed = VornEmbed.create()
                                .setDescription([
                                    `### Purge`,
                                    '',
                                    `**Channel** ─ ${channel}`,
                                    `**Deleted** ─ \`${deleted.size}\` messages`,
                                    `**Filter** ─ \`${subcommand}\``,
                                    `**Moderator** ─ ${interaction.user}`,
                                    '',
                                    `-# <t:${Math.floor(Date.now() / 1000)}:R>`
                                ].join('\n'));
                            logChannel.send({ embeds: [embed] }).catch(() => { });
                        }
                    }
                } catch { }
            }

            return interaction.editReply({
                embeds: [VornEmbed.success(`Purged **${deleted.size}** messages.`)]
            });
        } catch (error) {
            return interaction.editReply({
                embeds: [VornEmbed.error(`Purge failed: ${error.message}`)]
            });
        }
    }
};
