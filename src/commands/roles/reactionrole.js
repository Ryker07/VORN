/**
 * Vorn — Reaction Role Commands
 * Advanced panel management with full customization
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Manage reaction role panels')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .setDMPermission(false)
        // --- CREATE ---
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a new panel')
                .addStringOption(opt =>
                    opt.setName('type')
                        .setDescription('Panel type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Buttons', value: 'BUTTON' },
                            { name: 'Dropdown Menu', value: 'SELECT' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('title')
                        .setDescription('Panel title')
                        .setRequired(true)
                )
                .addRoleOption(opt =>
                    opt.setName('role1')
                        .setDescription('First role')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('emoji1')
                        .setDescription('Emoji for first role')
                )
                .addRoleOption(opt => opt.setName('role2').setDescription('Second role'))
                .addStringOption(opt => opt.setName('emoji2').setDescription('Emoji for role 2'))
                .addRoleOption(opt => opt.setName('role3').setDescription('Third role'))
                .addStringOption(opt => opt.setName('emoji3').setDescription('Emoji for role 3'))
                .addRoleOption(opt => opt.setName('role4').setDescription('Fourth role'))
                .addStringOption(opt => opt.setName('emoji4').setDescription('Emoji for role 4'))
                .addRoleOption(opt => opt.setName('role5').setDescription('Fifth role'))
                .addStringOption(opt => opt.setName('emoji5').setDescription('Emoji for role 5'))
                .addStringOption(opt =>
                    opt.setName('description')
                        .setDescription('Panel description')
                )
                .addStringOption(opt =>
                    opt.setName('mode')
                        .setDescription('Role mode')
                        .addChoices(
                            { name: 'Normal (Toggle)', value: 'normal' },
                            { name: 'Unique (One at a time)', value: 'unique' },
                            { name: 'Verify (Can only add)', value: 'verify' },
                            { name: 'Reversed (Remove only)', value: 'reversed' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('style')
                        .setDescription('Button style (for button panels)')
                        .addChoices(
                            { name: 'Blue', value: 'Primary' },
                            { name: 'Grey', value: 'Secondary' },
                            { name: 'Green', value: 'Success' },
                            { name: 'Red', value: 'Danger' }
                        )
                )
        )
        // --- ADD ROLE ---
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a role to existing panel')
                .addStringOption(opt =>
                    opt.setName('message_id')
                        .setDescription('Panel message ID')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Role to add')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('emoji')
                        .setDescription('Emoji for button/option')
                )
                .addStringOption(opt =>
                    opt.setName('label')
                        .setDescription('Custom label')
                )
        )
        // --- REMOVE ROLE ---
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a role from panel')
                .addStringOption(opt =>
                    opt.setName('message_id')
                        .setDescription('Panel message ID')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Role to remove')
                        .setRequired(true)
                )
        )
        // --- MODE ---
        .addSubcommand(sub =>
            sub.setName('mode')
                .setDescription('Change panel mode')
                .addStringOption(opt =>
                    opt.setName('message_id')
                        .setDescription('Panel message ID')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(opt =>
                    opt.setName('new_mode')
                        .setDescription('New mode')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Normal (Toggle)', value: 'normal' },
                            { name: 'Unique (One at a time)', value: 'unique' },
                            { name: 'Verify (Can only add)', value: 'verify' },
                            { name: 'Reversed (Remove only)', value: 'reversed' }
                        )
                )
        )
        // --- DELETE ---
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a panel')
                .addStringOption(opt =>
                    opt.setName('message_id')
                        .setDescription('Panel message ID')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        // --- LIST ---
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all panels')
        ),

    async autocomplete(interaction, client) {
        const config = await client.reactionRoles.getConfig(interaction.guild.id);
        const panels = config.panels || [];

        const choices = panels.map(p => ({
            name: `${p.embed?.title || 'Panel'} (${p.type}) - ${p.roles.length} roles`,
            value: p.messageId
        }));

        const focused = interaction.options.getFocused();
        const filtered = choices.filter(c => c.name.toLowerCase().includes(focused.toLowerCase()));
        await interaction.respond(filtered.slice(0, 25));
    },

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        if (subcommand === 'create') {
            const type = interaction.options.getString('type');
            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');
            const mode = interaction.options.getString('mode') || 'normal';
            const style = interaction.options.getString('style') || 'Primary';

            // Collect roles
            const roles = [];
            for (let i = 1; i <= 5; i++) {
                const role = interaction.options.getRole(`role${i}`);
                if (role) {
                    const emoji = interaction.options.getString(`emoji${i}`);
                    roles.push({
                        roleId: role.id,
                        roleName: role.name,
                        label: role.name,
                        emoji: emoji || undefined,
                        style
                    });
                }
            }

            if (roles.length === 0) {
                return interaction.editReply({ embeds: [VornEmbed.error('No roles provided.')] });
            }

            try {
                const message = await client.reactionRoles.createPanel(interaction.channel, {
                    type,
                    mode,
                    title,
                    description,
                    roles
                });

                return interaction.editReply({
                    embeds: [VornEmbed.success(`Panel created with ${roles.length} roles!`)]
                });
            } catch (error) {
                return interaction.editReply({ embeds: [VornEmbed.error(`Failed: ${error.message}`)] });
            }
        }

        if (subcommand === 'add') {
            const messageId = interaction.options.getString('message_id');
            const role = interaction.options.getRole('role');
            const emoji = interaction.options.getString('emoji');
            const label = interaction.options.getString('label') || role.name;

            const success = await client.reactionRoles.addRoleToPanel(guild.id, messageId, {
                roleId: role.id,
                roleName: role.name,
                label,
                emoji: emoji || undefined,
                style: 'Primary'
            });

            if (success) {
                return interaction.editReply({ embeds: [VornEmbed.success(`Added ${role} to panel.`)] });
            } else {
                return interaction.editReply({ embeds: [VornEmbed.error('Panel not found.')] });
            }
        }

        if (subcommand === 'remove') {
            const messageId = interaction.options.getString('message_id');
            const role = interaction.options.getRole('role');

            const success = await client.reactionRoles.removeRoleFromPanel(guild.id, messageId, role.id);

            if (success) {
                return interaction.editReply({ embeds: [VornEmbed.success(`Removed ${role} from panel.`)] });
            } else {
                return interaction.editReply({ embeds: [VornEmbed.error('Panel or role not found.')] });
            }
        }

        if (subcommand === 'mode') {
            const messageId = interaction.options.getString('message_id');
            const newMode = interaction.options.getString('new_mode');

            const config = await client.reactionRoles.getConfig(guild.id);
            const panelIndex = config.panels.findIndex(p => p.messageId === messageId);

            if (panelIndex === -1) {
                return interaction.editReply({ embeds: [VornEmbed.error('Panel not found.')] });
            }

            config.panels[panelIndex].mode = newMode;
            await client.reactionRoles.setConfig(guild.id, config);

            return interaction.editReply({ embeds: [VornEmbed.success(`Mode changed to **${newMode}**.`)] });
        }

        if (subcommand === 'delete') {
            const messageId = interaction.options.getString('message_id');

            const success = await client.reactionRoles.deletePanel(guild.id, messageId);

            if (success) {
                return interaction.editReply({ embeds: [VornEmbed.success('Panel deleted.')] });
            } else {
                return interaction.editReply({ embeds: [VornEmbed.error('Panel not found.')] });
            }
        }

        if (subcommand === 'list') {
            const config = await client.reactionRoles.getConfig(guild.id);
            const panels = config.panels;

            if (panels.length === 0) {
                return interaction.editReply({ embeds: [VornEmbed.info('Panels', 'No reaction role panels.')] });
            }

            const lines = panels.map(p => {
                const roles = p.roles.map(r => `<@&${r.roleId}>`).join(', ');
                return `**${p.embed?.title || 'Panel'}** [${p.type}]\nMode: \`${p.mode}\` | Roles: ${roles}`;
            });

            const embed = VornEmbed.create()
                .setTitle('Reaction Role Panels')
                .setDescription(lines.join('\n\n'));

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
