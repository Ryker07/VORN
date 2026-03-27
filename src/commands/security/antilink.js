/**
 * Vorn — /antilink Command
 * Configure Anti-Link protection
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antilink')
        .setDescription('Configure Anti-Link protection')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View current Anti-Link settings')
        )
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable or disable Anti-Link system')
                .addBooleanOption(opt =>
                    opt.setName('state')
                        .setDescription('Enable or disable')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('settings')
                .setDescription('Configure blocking rules')
                .addBooleanOption(opt =>
                    opt.setName('block_invites')
                        .setDescription('Block Discord invite links')
                )
                .addBooleanOption(opt =>
                    opt.setName('block_all')
                        .setDescription('Block ALL links (except allowlist)')
                )
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Punishment action')
                        .addChoices(
                            { name: 'Delete Only', value: 'delete' },
                            { name: 'Warn', value: 'warn' },
                            { name: 'Mute', value: 'mute' },
                            { name: 'Kick', value: 'kick' }
                        )
                )
        )
        .addSubcommandGroup(group =>
            group.setName('allowlist')
                .setDescription('Manage allowed domains')
                .addSubcommand(sub =>
                    sub.setName('add')
                        .setDescription('Add a domain to allowlist')
                        .addStringOption(opt =>
                            opt.setName('domain')
                                .setDescription('Domain to allow (e.g. google.com)')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName('remove')
                        .setDescription('Remove a domain from allowlist')
                        .addStringOption(opt =>
                            opt.setName('domain')
                                .setDescription('Domain to remove')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName('list')
                        .setDescription('View allowed domains')
                )
        ),

    async execute(interaction, client) {
        await interaction.deferReply();
        const guildId = interaction.guild.id;
        const config = await client.automod.getConfig(guildId);

        // Ensure enabled if configuring
        if (!config.enabled && interaction.options.getSubcommand() !== 'view') {
            config.enabled = true;
        }

        const subGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        // --- View Settings ---
        if (subcommand === 'view') {
            const s = config.antilink;
            const embed = VornEmbed.create()
                .setTitle('Anti-Link Settings')
                .addFields(
                    { name: 'Status', value: s.enabled ? 'Enabled' : 'Disabled', inline: true },
                    { name: 'Block Invites', value: s.block_invites ? 'Yes' : 'No', inline: true },
                    { name: 'Block All Links', value: s.block_all ? 'Yes' : 'No', inline: true },
                    { name: 'Action', value: `\`${s.action}\``, inline: true },
                    { name: 'Allowed Domains', value: s.allowlist.length ? s.allowlist.join(', ') : 'None', inline: false }
                );

            return interaction.editReply({ embeds: [embed] });
        }

        // --- Toggle System ---
        if (subcommand === 'toggle') {
            const state = interaction.options.getBoolean('state');
            config.antilink.enabled = state;
            await client.automod.setConfig(guildId, config);
            return interaction.editReply({
                embeds: [VornEmbed.success(`${state ? 'Enabled' : 'Disabled'} Anti-Link system.`)]
            });
        }

        // --- General Settings ---
        if (subcommand === 'settings') {
            const blockInvites = interaction.options.getBoolean('block_invites');
            const blockAll = interaction.options.getBoolean('block_all');
            const action = interaction.options.getString('action');

            if (blockInvites !== null) config.antilink.block_invites = blockInvites;
            if (blockAll !== null) config.antilink.block_all = blockAll;
            if (action !== null) config.antilink.action = action;

            await client.automod.setConfig(guildId, config);
            return interaction.editReply({
                embeds: [VornEmbed.success('Updated Anti-Link settings.')]
            });
        }

        // --- Allowlist Management ---
        if (subGroup === 'allowlist') {
            if (subcommand === 'list') {
                const list = config.antilink.allowlist;
                const embed = VornEmbed.info('Allowed Domains', list.length ? list.join('\n') : 'No allowed domains.');
                return interaction.editReply({ embeds: [embed] });
            }

            const domain = interaction.options.getString('domain').toLowerCase();

            if (subcommand === 'add') {
                if (!config.antilink.allowlist.includes(domain)) {
                    config.antilink.allowlist.push(domain);
                    await client.automod.setConfig(guildId, config);
                    return interaction.editReply({
                        embeds: [VornEmbed.success(`Added \`${domain}\` to allowlist.`)]
                    });
                } else {
                    return interaction.editReply({ embeds: [VornEmbed.error('Domain already in allowlist.')] });
                }
            }

            if (subcommand === 'remove') {
                if (config.antilink.allowlist.includes(domain)) {
                    config.antilink.allowlist = config.antilink.allowlist.filter(d => d !== domain);
                    await client.automod.setConfig(guildId, config);
                    return interaction.editReply({
                        embeds: [VornEmbed.success(`Removed \`${domain}\` from allowlist.`)]
                    });
                } else {
                    return interaction.editReply({ embeds: [VornEmbed.error('Domain not found in allowlist.')] });
                }
            }
        }
    }
};
