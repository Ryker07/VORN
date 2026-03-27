/**
 * Vorn — /whitelist Command
 * Unified whitelist management for Anti-Nuke and Anti-Raid
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Manage trusted users who bypass security checks')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a user to the whitelist')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('The user to whitelist')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('system')
                        .setDescription('Which system to bypass')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Anti-Nuke', value: 'antinuke' },
                            { name: 'Anti-Raid', value: 'antiraid' },
                            { name: 'AutoMod', value: 'automod' },
                            { name: 'All Systems', value: 'all' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('modules')
                        .setDescription('For Anti-Nuke: specific modules (e.g., channel_delete) or "all"')
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a user from the whitelist')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('The user to remove')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('system')
                        .setDescription('Which system to remove from')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Anti-Nuke', value: 'antinuke' },
                            { name: 'Anti-Raid', value: 'antiraid' },
                            { name: 'AutoMod', value: 'automod' },
                            { name: 'All Systems', value: 'all' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('View all whitelisted users')
        )
        .addSubcommand(sub =>
            sub.setName('modules')
                .setDescription('View available Anti-Nuke modules')
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // --- List available modules ---
        if (subcommand === 'modules') {
            const modules = client.antiNuke.MODULES;
            const embed = VornEmbed.create()
                .setDescription([
                    '### Anti-Nuke Modules',
                    '-# Use these names when adding to whitelist',
                    '',
                    modules.map(m => `\`${m}\``).join('\n'),
                    '',
                    '-# Tip: Use "all" to bypass everything'
                ].join('\n'));

            return interaction.editReply({ embeds: [embed] });
        }

        // --- List whitelisted users ---
        if (subcommand === 'list') {
            const antiNukeWhitelist = await client.antiNuke.getWhitelist(guildId);
            const antiRaidConfig = await client.antiRaid.getConfig(guildId);
            const antiRaidWhitelist = antiRaidConfig.whitelist || [];

            const autoModConfig = await client.automod.getConfig(guildId);
            const autoModWhitelist = autoModConfig.whitelist || [];

            const lines = [];

            // Anti-Nuke entries
            if (antiNukeWhitelist.length > 0) {
                lines.push('### Anti-Nuke');
                for (const entry of antiNukeWhitelist) {
                    const user = await client.users.fetch(entry.userId).catch(() => null);
                    const name = user ? user.tag : `Unknown (${entry.userId})`;
                    const mods = entry.modules.includes('*')
                        ? '`all`'
                        : entry.modules.map(m => `\`${m}\``).join(', ');
                    lines.push(`**${name}** ─ ${mods}`);
                }
            }

            // Anti-Raid entries
            if (antiRaidWhitelist.length > 0) {
                lines.push('');
                lines.push('### Anti-Raid');
                for (const userId of antiRaidWhitelist) {
                    const user = await client.users.fetch(userId).catch(() => null);
                    const name = user ? user.tag : `Unknown (${userId})`;
                    lines.push(`**${name}**`);
                }
            }

            // AutoMod entries
            if (autoModWhitelist.length > 0) {
                lines.push('');
                lines.push('### AutoMod');
                for (const userId of autoModWhitelist) {
                    const user = await client.users.fetch(userId).catch(() => null);
                    const name = user ? user.tag : `Unknown (${userId})`;
                    lines.push(`**${name}**`);
                }
            }

            if (lines.length === 0) {
                return interaction.editReply({
                    embeds: [VornEmbed.info('Whitelist', 'No whitelisted users.')]
                });
            }

            const embed = VornEmbed.create()
                .setDescription(lines.join('\n'));

            return interaction.editReply({ embeds: [embed] });
        }

        // --- Add to whitelist ---
        if (subcommand === 'add') {
            const user = interaction.options.getUser('user');
            const system = interaction.options.getString('system');
            const modulesInput = interaction.options.getString('modules')?.toLowerCase().trim() || 'all';

            if (system === 'antinuke' || system === 'all') {
                let modules;
                if (modulesInput === 'all' || modulesInput === '*') {
                    modules = ['*'];
                } else {
                    modules = modulesInput.split(',')
                        .map(m => m.trim())
                        .filter(m => client.antiNuke.MODULES.includes(m));

                    if (modules.length === 0) {
                        return interaction.editReply({
                            embeds: [VornEmbed.error('Invalid modules. Use `/whitelist modules` to see available options.')]
                        });
                    }
                }
                await client.antiNuke.addToWhitelist(guildId, user.id, modules);
            }

            if (system === 'antiraid' || system === 'all') {
                const config = await client.antiRaid.getConfig(guildId);
                if (!config.whitelist) config.whitelist = [];
                if (!config.whitelist.includes(user.id)) {
                    config.whitelist.push(user.id);
                    await client.antiRaid.setConfig(guildId, config);
                }
            }

            if (system === 'automod' || system === 'all') {
                const config = await client.automod.getConfig(guildId);
                if (!config.whitelist) config.whitelist = [];
                if (!config.whitelist.includes(user.id)) {
                    config.whitelist.push(user.id);
                    await client.automod.setConfig(guildId, config);
                }
            }

            return interaction.editReply({
                embeds: [VornEmbed.success(`Added **${user.tag}** to ${system === 'all' ? 'all systems' : system} whitelist.`)]
            });
        }

        // --- Remove from whitelist ---
        if (subcommand === 'remove') {
            const user = interaction.options.getUser('user');
            const system = interaction.options.getString('system');

            if (system === 'antinuke' || system === 'all') {
                await client.antiNuke.removeFromWhitelist(guildId, user.id);
            }

            if (system === 'antiraid' || system === 'all') {
                const config = await client.antiRaid.getConfig(guildId);
                if (!config.whitelist) config.whitelist = [];
                config.whitelist = config.whitelist.filter(id => id !== user.id);
                await client.antiRaid.setConfig(guildId, config);
            }

            if (system === 'automod' || system === 'all') {
                const config = await client.automod.getConfig(guildId);
                if (!config.whitelist) config.whitelist = [];
                config.whitelist = config.whitelist.filter(id => id !== user.id);
                await client.automod.setConfig(guildId, config);
            }

            return interaction.editReply({
                embeds: [VornEmbed.success(`Removed **${user.tag}** from ${system === 'all' ? 'all systems' : system} whitelist.`)]
            });
        }
    }
};
