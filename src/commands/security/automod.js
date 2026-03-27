/**
 * Vorn — /automod Command
 * Global AutoMod settings (Exemptions & Logging)
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Global AutoMod settings (Exemptions & Logging)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(group =>
            group.setName('ignore')
                .setDescription('Manage exempt channels and roles')
                .addSubcommand(sub =>
                    sub.setName('channel')
                        .setDescription('Exempt a channel from AutoMod')
                        .addStringOption(opt =>
                            opt.setName('action')
                                .setDescription('Add or Remove')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Add', value: 'add' },
                                    { name: 'Remove', value: 'remove' }
                                )
                        )
                        .addChannelOption(opt =>
                            opt.setName('channel')
                                .setDescription('The channel to exempt')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName('role')
                        .setDescription('Exempt a role from AutoMod')
                        .addStringOption(opt =>
                            opt.setName('action')
                                .setDescription('Add or Remove')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Add', value: 'add' },
                                    { name: 'Remove', value: 'remove' }
                                )
                        )
                        .addRoleOption(opt =>
                            opt.setName('role')
                                .setDescription('The role to exempt')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName('list')
                        .setDescription('View exempted channels and roles')
                )
        )
        .addSubcommand(sub =>
            sub.setName('log')
                .setDescription('Set the AutoMod log channel')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('The channel for logs (leave empty to disable)')
                )
        )
        .addSubcommand(sub =>
            sub.setName('admin')
                .setDescription('Toggle whether Admins are immune to AutoMod')
                .addBooleanOption(opt =>
                    opt.setName('immune')
                        .setDescription('True = Admins ignored, False = Admins checked (Default)')
                        .setRequired(true)
                )
        ),

    async execute(interaction, client) {
        await interaction.deferReply();
        const guildId = interaction.guild.id;
        const config = await client.automod.getConfig(guildId);

        const subGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        // --- Log Channel ---
        if (subcommand === 'log') {
            const channel = interaction.options.getChannel('channel');
            config.logChannelId = channel ? channel.id : null;
            await client.automod.setConfig(guildId, config);

            return interaction.editReply({
                embeds: [VornEmbed.success(
                    channel
                        ? `Set AutoMod log channel to ${channel}.`
                        : 'Disabled AutoMod logging.'
                )]
            });
        }

        // --- Admin Immunity ---
        if (subcommand === 'admin') {
            const immune = interaction.options.getBoolean('immune');
            config.ignoreAdmins = immune;
            await client.automod.setConfig(guildId, config);

            return interaction.editReply({
                embeds: [VornEmbed.success(
                    immune
                        ? 'Admins are now **ignored** by AutoMod.'
                        : 'Admins are now **checked** by AutoMod (Caution!).'
                )]
            });
        }

        // --- Exemptions ---
        if (subGroup === 'ignore') {
            // LIST
            if (subcommand === 'list') {
                const channels = config.exemptChannels.map(id => `<#${id}>`).join(', ') || 'None';
                const roles = config.exemptRoles.map(id => `<@&${id}>`).join(', ') || 'None';

                const embed = VornEmbed.create()
                    .setTitle('AutoMod Exemptions')
                    .addFields(
                        { name: 'Exempt Channels', value: channels },
                        { name: 'Exempt Roles', value: roles }
                    );
                return interaction.editReply({ embeds: [embed] });
            }

            const action = interaction.options.getString('action');

            // IGNORING CHANNELS
            if (subcommand === 'channel') {
                const channel = interaction.options.getChannel('channel');

                if (action === 'add') {
                    if (!config.exemptChannels.includes(channel.id)) {
                        config.exemptChannels.push(channel.id);
                        await client.automod.setConfig(guildId, config);
                        return interaction.editReply({ embeds: [VornEmbed.success(`Added ${channel} to exemptions.`)] });
                    }
                    return interaction.editReply({ embeds: [VornEmbed.error('Channel already exempt.')] });
                }

                if (action === 'remove') {
                    if (config.exemptChannels.includes(channel.id)) {
                        config.exemptChannels = config.exemptChannels.filter(id => id !== channel.id);
                        await client.automod.setConfig(guildId, config);
                        return interaction.editReply({ embeds: [VornEmbed.success(`Removed ${channel} from exemptions.`)] });
                    }
                    return interaction.editReply({ embeds: [VornEmbed.error('Channel not found in exemptions.')] });
                }
            }

            // IGNORING ROLES
            if (subcommand === 'role') {
                const role = interaction.options.getRole('role');

                if (action === 'add') {
                    if (!config.exemptRoles.includes(role.id)) {
                        config.exemptRoles.push(role.id);
                        await client.automod.setConfig(guildId, config);
                        return interaction.editReply({ embeds: [VornEmbed.success(`Added ${role} to exemptions.`)] });
                    }
                    return interaction.editReply({ embeds: [VornEmbed.error('Role already exempt.')] });
                }

                if (action === 'remove') {
                    if (config.exemptRoles.includes(role.id)) {
                        config.exemptRoles = config.exemptRoles.filter(id => id !== role.id);
                        await client.automod.setConfig(guildId, config);
                        return interaction.editReply({ embeds: [VornEmbed.success(`Removed ${role} from exemptions.`)] });
                    }
                    return interaction.editReply({ embeds: [VornEmbed.error('Role not found in exemptions.')] });
                }
            }
        }
    }
};
