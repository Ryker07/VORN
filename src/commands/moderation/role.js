/**
 * Vorn — Role Management Commands
 * Add, Remove, Strip, Mass Add (Humans/Bots)
 */

const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Role management commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        // --- ADD ---
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a role to a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))
        )
        // --- REMOVE ---
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a role from a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
        )
        // --- STRIP ---
        .addSubcommand(sub =>
            sub.setName('strip')
                .setDescription('Remove ALL roles from a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        )
        // --- HUMANS (Mass Add) ---
        .addSubcommand(sub =>
            sub.setName('humans')
                .setDescription('Add a role to ALL humans')
                .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))
        )
        // --- BOTS (Mass Add) ---
        .addSubcommand(sub =>
            sub.setName('bots')
                .setDescription('Add a role to ALL bots')
                .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: false });

        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const guild = interaction.guild;
        const moderator = interaction.member;

        // --- SINGLE USER COMMANDS ---
        if (subcommand === 'add' || subcommand === 'remove' || subcommand === 'strip') {
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return interaction.editReply({ embeds: [VornEmbed.error('User not found.')] });

            if (role && role.position >= moderator.roles.highest.position) {
                return interaction.editReply({ embeds: [VornEmbed.error('You cannot manage this role (Hierarchy check).')] });
            }

            if (subcommand === 'add') {
                await member.roles.add(role);
                return interaction.editReply({ embeds: [VornEmbed.success(`Added ${role} to **${user.tag}**`)] });
            }

            if (subcommand === 'remove') {
                await member.roles.remove(role);
                return interaction.editReply({ embeds: [VornEmbed.success(`Removed ${role} from **${user.tag}**`)] });
            }

            if (subcommand === 'strip') {
                const roles = member.roles.cache.filter(r => r.name !== '@everyone' && r.editable);
                await member.roles.remove(roles);
                return interaction.editReply({ embeds: [VornEmbed.success(`Stripped **${roles.size}** roles from **${user.tag}**`)] });
            }
        }

        // --- MASS ROLE COMMANDS ---
        if (subcommand === 'humans' || subcommand === 'bots') {
            if (role.position >= moderator.roles.highest.position) {
                return interaction.editReply({ embeds: [VornEmbed.error('You cannot manage this role.')] });
            }

            const targetType = subcommand === 'humans' ? 'Humans' : 'Bots';

            // Confirmation
            const confirmButton = new ButtonBuilder()
                .setCustomId('confirm_mass_role')
                .setLabel(`Add to All ${targetType}`)
                .setStyle(ButtonStyle.Danger);
            const row = new ActionRowBuilder().addComponents(confirmButton);

            const msg = await interaction.editReply({
                embeds: [VornEmbed.warning(`Adding ${role} to ALL ${targetType}. This may take a while. Continue?`)],
                components: [row]
            });

            const filter = i => i.user.id === interaction.user.id;
            try {
                const confirmation = await msg.awaitMessageComponent({ filter, time: 15000 });
                if (confirmation.customId === 'confirm_mass_role') {
                    await interaction.editReply({ embeds: [VornEmbed.info('Processing...', 'Please wait.')], components: [] });

                    const members = await guild.members.fetch();
                    const targets = members.filter(m => subcommand === 'humans' ? !m.user.bot : m.user.bot);

                    let count = 0;
                    for (const [id, member] of targets) {
                        // Skip if already has role
                        if (!member.roles.cache.has(role.id)) {
                            await member.roles.add(role).catch(() => { });
                            count++;
                            // delay to avoid rate limits
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }

                    return interaction.editReply({ embeds: [VornEmbed.success(`Added ${role} to **${count}** ${targetType}.`)] });
                }
            } catch {
                await interaction.editReply({ embeds: [VornEmbed.info('Action cancelled.')], components: [] });
            }
        }
    }
};
