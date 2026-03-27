/**
 * Vorn — /antispam Command
 * Configure Anti-Spam modules
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

const MODULES = [
    { name: 'Rate Limit', value: 'rate_limit' },
    { name: 'Mentions', value: 'mentions' },
    { name: 'Caps', value: 'caps' },
    { name: 'Newlines', value: 'newlines' },
    { name: 'Duplicates', value: 'duplicates' },
    { name: 'Emojis', value: 'emojis' },
    { name: 'Zalgo', value: 'zalgo' },
    { name: 'Mass Attachments', value: 'mass_attachments' }
];

const ACTIONS = [
    { name: 'Warn (Message)', value: 'warn' },
    { name: 'Mute', value: 'mute' },
    { name: 'Kick', value: 'kick' },
    { name: 'Ban', value: 'ban' },
    { name: 'Delete Only', value: 'delete' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antispam')
        .setDescription('Configure Anti-Spam protection')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View current Anti-Spam settings')
        )
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable or disable a spam module')
                .addStringOption(opt =>
                    opt.setName('module')
                        .setDescription('The module to toggle')
                        .setRequired(true)
                        .addChoices(...MODULES)
                )
                .addBooleanOption(opt =>
                    opt.setName('state')
                        .setDescription('Enable or disable')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('limit')
                .setDescription('Set sensitivity limit for a module')
                .addStringOption(opt =>
                    opt.setName('module')
                        .setDescription('The module to configure')
                        .setRequired(true)
                        .addChoices(...MODULES)
                )
                .addIntegerOption(opt =>
                    opt.setName('value')
                        .setDescription('The new limit/threshold value')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(sub =>
            sub.setName('action')
                .setDescription('Set punishment action for a module')
                .addStringOption(opt =>
                    opt.setName('module')
                        .setDescription('The module to configure')
                        .setRequired(true)
                        .addChoices(...MODULES)
                )
                .addStringOption(opt =>
                    opt.setName('type')
                        .setDescription('The punishment type')
                        .setRequired(true)
                        .addChoices(...ACTIONS)
                )
        )
        .addSubcommand(sub =>
            sub.setName('interval')
                .setDescription('Set time window for rate limits/duplicates')
                .addStringOption(opt =>
                    opt.setName('module')
                        .setDescription('The module (rate_limit or duplicates)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Rate Limit', value: 'rate_limit' },
                            { name: 'Duplicates', value: 'duplicates' }
                        )
                )
                .addIntegerOption(opt =>
                    opt.setName('seconds')
                        .setDescription('Time window in seconds')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(sub =>
            sub.setName('timeout')
                .setDescription('Set mute duration for punishments')
                .addStringOption(opt =>
                    opt.setName('module')
                        .setDescription('The module to configure')
                        .setRequired(true)
                        .addChoices(...MODULES)
                )
                .addIntegerOption(opt =>
                    opt.setName('seconds')
                        .setDescription('Mute duration in seconds')
                        .setRequired(true)
                        .setMinValue(1)
                )
        ),

    async execute(interaction, client) {
        await interaction.deferReply();
        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();

        const config = await client.automod.getConfig(guildId);
        if (!config.enabled) {
            // Auto-enable system if user tries to config
            config.enabled = true;
        }

        // --- View Settings ---
        if (subcommand === 'view') {
            const embed = VornEmbed.create()
                .setTitle('Anti-Spam Settings')
                .setDescription('Use `/antispam <toggle/limit/action>` to edit.');

            for (const mod of MODULES) {
                const s = config.antispam[mod.value];
                const status = s.enabled ? 'On' : 'Off';
                const details = [
                    `**Limit:** ${s.limit || s.threshold || 'N/A'}`,
                    `**Action:** \`${s.action}\``
                ];
                if (s.muteTime && s.action === 'mute') details.push(`**Time:** ${s.muteTime}s`);

                embed.addFields({
                    name: `${mod.name} ─ ${status}`,
                    value: details.join(' • '),
                    inline: true
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        const moduleName = interaction.options.getString('module');
        const moduleKey = moduleName; // Identical
        const currentModule = config.antispam[moduleKey];

        // --- Toggle Module ---
        if (subcommand === 'toggle') {
            const state = interaction.options.getBoolean('state');
            currentModule.enabled = state;
            await client.automod.setConfig(guildId, config);

            return interaction.editReply({
                embeds: [VornEmbed.success(
                    `${state ? 'Enabled' : 'Disabled'} **${MODULES.find(m => m.value === moduleKey).name}** module.`
                )]
            });
        }

        // --- Set Limit ---
        if (subcommand === 'limit') {
            const value = interaction.options.getInteger('value');

            // Handle specific field names
            if (moduleKey === 'caps') currentModule.threshold = value;
            else currentModule.limit = value;

            await client.automod.setConfig(guildId, config);

            return interaction.editReply({
                embeds: [VornEmbed.success(
                    `Set **${MODULES.find(m => m.value === moduleKey).name}** limit to \`${value}\`.`
                )]
            });
        }

        // --- Set Action ---
        if (subcommand === 'action') {
            const action = interaction.options.getString('type');
            currentModule.action = action;
            await client.automod.setConfig(guildId, config);

            return interaction.editReply({
                embeds: [VornEmbed.success(
                    `Set **${MODULES.find(m => m.value === moduleKey).name}** punishment to \`${action}\`.`
                )]
            });
        }

        // --- Set Interval ---
        if (subcommand === 'interval') {
            const seconds = interaction.options.getInteger('seconds');
            // 'module' option is required for this subcommand, so moduleKey is valid
            // Only rate_limit and duplicates have 'time' (stored in ms usually, let's check AutoModManager)
            // AutoModManager uses milliseconds for 'time'. Input is seconds.

            if (currentModule.time !== undefined) {
                currentModule.time = seconds * 1000;
                await client.automod.setConfig(guildId, config);

                return interaction.editReply({
                    embeds: [VornEmbed.success(
                        `Set **${MODULES.find(m => m.value === moduleKey).name}** interval to \`${seconds}s\`.`
                    )]
                });
            } else {
                return interaction.editReply({
                    embeds: [VornEmbed.error('This module does not support time intervals.')]
                });
            }
        }

        // --- Set Timeout Duration ---
        if (subcommand === 'timeout') {
            const seconds = interaction.options.getInteger('seconds');

            // Only updates if the action is mute? Or just store it regardless.
            // Storing it regardless is better for flexibility.

            currentModule.muteTime = seconds;
            await client.automod.setConfig(guildId, config);

            return interaction.editReply({
                embeds: [VornEmbed.success(
                    `Set **${MODULES.find(m => m.value === moduleKey).name}** mute duration to \`${seconds}s\`.`
                )]
            });
        }
    }
};
