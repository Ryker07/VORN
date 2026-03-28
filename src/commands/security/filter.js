/**
 * Vorn — /filter Command
 * Premium unified content filtering and AutoMod dashboard
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

const ACTIONS = [
    { name: 'Warn (Message)', value: 'warn' },
    { name: 'Mute', value: 'mute' },
    { name: 'Kick', value: 'kick' },
    { name: 'Ban', value: 'ban' },
    { name: 'Delete Only', value: 'delete' }
];

const SPAM_MODULES = [
    { name: 'Rate Limit', value: 'rate_limit' },
    { name: 'Mentions', value: 'mentions' },
    { name: 'Caps', value: 'caps' },
    { name: 'Newlines', value: 'newlines' },
    { name: 'Duplicates', value: 'duplicates' },
    { name: 'Emojis', value: 'emojis' },
    { name: 'Zalgo', value: 'zalgo' },
    { name: 'Mass Attachments', value: 'mass_attachments' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filter')
        .setDescription('Advanced AutoMod filters and content blocking')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // --- Word Filter ---
        .addSubcommandGroup(group =>
            group.setName('words')
                .setDescription('Manage the custom word/phrase filter')
                .addSubcommand(sub =>
                    sub.setName('add')
                        .setDescription('Add a new word to the filter')
                        .addStringOption(opt => opt.setName('word').setDescription('The exact word, phrase, or regex').setRequired(true))
                        .addStringOption(opt =>
                            opt.setName('type')
                                .setDescription('How to match this word')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Exact Match', value: 'exact' },
                                    { name: 'Contains', value: 'contains' },
                                    { name: 'Regex Pattern', value: 'regex' }
                                )
                        )
                )
                .addSubcommand(sub =>
                    sub.setName('remove')
                        .setDescription('Remove a word from the filter')
                        .addStringOption(opt => opt.setName('word').setDescription('The word to remove').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('toggle')
                        .setDescription('Enable or disable the word filter globally')
                        .addBooleanOption(opt => opt.setName('state').setDescription('Enabled?').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('config')
                        .setDescription('Configure word filter punishments')
                        .addStringOption(opt => opt.setName('action').setDescription('Punishment type').addChoices(...ACTIONS))
                        .addStringOption(opt => opt.setName('warning').setDescription('Custom DM warning message'))
                )
        )

        // --- Invite Filter ---
        .addSubcommandGroup(group =>
            group.setName('invites')
                .setDescription('Manage Discord invite link blocking')
                .addSubcommand(sub =>
                    sub.setName('toggle')
                        .setDescription('Enable or disable invite blocking')
                        .addBooleanOption(opt => opt.setName('state').setDescription('Enabled?').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('config')
                        .setDescription('Configure invite filter settings')
                        .addStringOption(opt => opt.setName('action').setDescription('Punishment type').addChoices(...ACTIONS))
                        .addStringOption(opt => opt.setName('warning').setDescription('Custom DM warning message'))
                )
        )

        // --- Extensions Filter ---
        .addSubcommandGroup(group =>
            group.setName('files')
                .setDescription('Block specific file extensions (e.g. .exe)')
                .addSubcommand(sub =>
                    sub.setName('block')
                        .setDescription('Block a file extension')
                        .addStringOption(opt => opt.setName('extension').setDescription('Extension to block (eg: .exe, .apk)').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('allow')
                        .setDescription('Remove a file extension from the blocklist')
                        .addStringOption(opt => opt.setName('extension').setDescription('Extension to allow').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('toggle')
                        .setDescription('Enable or disable file extension blocking globally')
                        .addBooleanOption(opt => opt.setName('state').setDescription('Enabled?').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('config')
                        .setDescription('Configure file filter punishments')
                        .addStringOption(opt => opt.setName('action').setDescription('Punishment type').addChoices(...ACTIONS))
                        .addStringOption(opt => opt.setName('warning').setDescription('Custom DM warning message'))
                )
        )

        // --- Spam Modules (Caps, Emojis, Mentions) ---
        .addSubcommandGroup(group =>
            group.setName('spam')
                .setDescription('Configure sensitivity and warnings for spam tracking')
                .addSubcommand(sub =>
                    sub.setName('setup')
                        .setDescription('Set limits, actions, and custom warnings for a specific spam module')
                        .addStringOption(opt => opt.setName('module').setDescription('Spam module to configure').setRequired(true).addChoices(...SPAM_MODULES))
                        .addIntegerOption(opt => opt.setName('limit').setDescription('Max allowed threshold/count'))
                        .addStringOption(opt => opt.setName('action').setDescription('Punishment type').addChoices(...ACTIONS))
                        .addStringOption(opt => opt.setName('warning').setDescription('Custom DM warning message'))
                )
                .addSubcommand(sub =>
                    sub.setName('toggle')
                        .setDescription('Enable or disable a specific spam module')
                        .addStringOption(opt => opt.setName('module').setDescription('Spam module to toggle').setRequired(true).addChoices(...SPAM_MODULES))
                        .addBooleanOption(opt => opt.setName('state').setDescription('Enabled?').setRequired(true))
                )
        )

        // --- View All ---
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View the entire AutoMod framework configuration')
        ),

    async execute(interaction, client) {
        await interaction.deferReply();
        const guildId = interaction.guild.id;
        const config = await client.automod.getConfig(guildId);

        const subGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'view') {
            const embed = VornEmbed.create()
                .setTitle('AutoMod Framework')
                .setDescription('Use `/filter` to manage rules, limits, and custom warnings.');

            // Words
            const wordStatus = config.words.enabled ? 'ON' : 'OFF';
            embed.addFields({
                name: `Word Phrases — [${wordStatus}]`,
                value: `**Words:** ${config.words.list.length}\n**Action:** \`${config.words.action}\`\n**Warn:** ${config.words.warningMessage}`,
                inline: true
            });

            // Invites
            const invStatus = config.antilink.block_invites ? 'ON' : 'OFF';
            embed.addFields({
                name: `Discord Invites — [${invStatus}]`,
                value: `**Action:** \`${config.antilink.invite_action || config.antilink.action}\`\n**Warn:** ${config.antilink.invite_warning}`,
                inline: true
            });

            // Files
            const fileStatus = config.files.enabled ? 'ON' : 'OFF';
            embed.addFields({
                name: `File Extensions — [${fileStatus}]`,
                value: `**Blocked:** ${config.files.blocked_extensions.length || 'None'}\n**Action:** \`${config.files.action}\``,
                inline: true
            });

            // Mention Spam checks
            for (const mod of ['caps', 'emojis', 'mentions']) {
                const s = config.antispam[mod];
                const status = s.enabled ? 'ON' : 'OFF';
                embed.addFields({
                    name: `Spam — ${mod.toUpperCase()} — [${status}]`,
                    value: `**Limit:** ${s.limit || s.threshold}\n**Action:** \`${s.action}\`\n**Warn:** ${s.warningMessage}`,
                    inline: true
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        // --- Words Logic ---
        if (subGroup === 'words') {
            if (subcommand === 'toggle') {
                const state = interaction.options.getBoolean('state');
                config.words.enabled = state;
                await client.automod.setConfig(guildId, config);
                return interaction.editReply({ embeds: [VornEmbed.success(`Word Filter is now **${state ? 'ENABLED' : 'DISABLED'}**.`)] });
            }

            if (subcommand === 'add') {
                config.words.enabled = true; // Auto-enable on add
                const word = interaction.options.getString('word').toLowerCase();
                const type = interaction.options.getString('type');

                if (config.words.list.some(w => w.word === word)) {
                    return interaction.editReply({ embeds: [VornEmbed.error('This word is already in the filter.')] });
                }

                config.words.list.push({ word, type });
                await client.automod.setConfig(guildId, config);
                return interaction.editReply({ embeds: [VornEmbed.success(`Added \`${word}\` (${type}) to the word filter.`)] });
            }

            if (subcommand === 'remove') {
                const word = interaction.options.getString('word').toLowerCase();
                const initialLen = config.words.list.length;
                config.words.list = config.words.list.filter(w => w.word !== word);

                if (config.words.list.length === initialLen) {
                    return interaction.editReply({ embeds: [VornEmbed.error('Word not found in the filter.')] });
                }

                if (config.words.list.length === 0) config.words.enabled = false;
                await client.automod.setConfig(guildId, config);
                return interaction.editReply({ embeds: [VornEmbed.success(`Removed \`${word}\` from the word filter.`)] });
            }

            if (subcommand === 'config') {
                config.words.enabled = true; // Auto-enable on config
                const action = interaction.options.getString('action');
                const warning = interaction.options.getString('warning');

                if (action) config.words.action = action;
                if (warning) config.words.warningMessage = warning;

                await client.automod.setConfig(guildId, config);
                return interaction.editReply({ embeds: [VornEmbed.success('Word filter config updated.')] });
            }
        }

        // --- Invites Logic ---
        if (subGroup === 'invites') {
            config.antilink.enabled = true;

            if (subcommand === 'toggle') {
                const state = interaction.options.getBoolean('state');
                config.antilink.block_invites = state;
                await client.automod.setConfig(guildId, config);
                return interaction.editReply({ embeds: [VornEmbed.success(`Invite blocking is now **${state ? 'Enabled' : 'Disabled'}**.`)] });
            }

            if (subcommand === 'config') {
                const action = interaction.options.getString('action');
                const warning = interaction.options.getString('warning');

                if (action) config.antilink.invite_action = action;
                if (warning) config.antilink.invite_warning = warning;

                await client.automod.setConfig(guildId, config);
                return interaction.editReply({ embeds: [VornEmbed.success('Invite filter config updated.')] });
            }
        }

        // --- Files Logic ---
        if (subGroup === 'files') {
            if (subcommand === 'toggle') {
                const state = interaction.options.getBoolean('state');
                config.files.enabled = state;
                await client.automod.setConfig(guildId, config);
                return interaction.editReply({ embeds: [VornEmbed.success(`File Extension Filter is now **${state ? 'ENABLED' : 'DISABLED'}**.`)] });
            }

            if (subcommand === 'block') {
                config.files.enabled = true; // Auto-enable on block
                let ext = interaction.options.getString('extension').toLowerCase();
                if (!ext.startsWith('.')) ext = `.${ext}`;

                if (config.files.blocked_extensions.includes(ext)) {
                    return interaction.editReply({ embeds: [VornEmbed.error('This extension is already blocked.')] });
                }

                config.files.blocked_extensions.push(ext);
                await client.automod.setConfig(guildId, config);
                return interaction.editReply({ embeds: [VornEmbed.success(`Blocked \`${ext}\` files.`)] });
            }

            if (subcommand === 'allow') {
                let ext = interaction.options.getString('extension').toLowerCase();
                if (!ext.startsWith('.')) ext = `.${ext}`;

                const initialLen = config.files.blocked_extensions.length;
                config.files.blocked_extensions = config.files.blocked_extensions.filter(e => e !== ext);

                if (config.files.blocked_extensions.length === initialLen) {
                    return interaction.editReply({ embeds: [VornEmbed.error('Extension not found in blocklist.')] });
                }

                if (config.files.blocked_extensions.length === 0) config.files.enabled = false;
                await client.automod.setConfig(guildId, config);
                return interaction.editReply({ embeds: [VornEmbed.success(`Allowed \`${ext}\` files.`)] });
            }

            if (subcommand === 'config') {
                config.files.enabled = true; // Auto-enable on config
                const action = interaction.options.getString('action');
                const warning = interaction.options.getString('warning');

                if (action) config.files.action = action;
                if (warning) config.files.warningMessage = warning;

                await client.automod.setConfig(guildId, config);
                return interaction.editReply({ embeds: [VornEmbed.success('File filter config updated.')] });
            }
        }

        // --- Spam Logic ---
        if (subGroup === 'spam') {
            if (subcommand === 'toggle') {
                const moduleName = interaction.options.getString('module');
                const state = interaction.options.getBoolean('state');
                
                config.antispam[moduleName].enabled = state;
                await client.automod.setConfig(guildId, config);
                return interaction.editReply({ 
                    embeds: [VornEmbed.success(`Spam module **${SPAM_MODULES.find(m => m.value === moduleName).name}** is now **${state ? 'ENABLED' : 'DISABLED'}**.`)]
                });
            }

            if (subcommand === 'setup') {
                const moduleName = interaction.options.getString('module');
                const limit = interaction.options.getInteger('limit');
                const action = interaction.options.getString('action');
                const warning = interaction.options.getString('warning');

                const current = config.antispam[moduleName];
                current.enabled = true;

                let changes = [];
                if (limit) {
                    if (moduleName === 'caps') current.threshold = limit;
                    else current.limit = limit;
                    changes.push(`Limit: \`${limit}\``);
                }
                if (action) {
                    current.action = action;
                    changes.push(`Action: \`${action}\``);
                }
                if (warning) {
                    current.warningMessage = warning;
                    changes.push(`Warning: "${warning}"`);
                }

                await client.automod.setConfig(guildId, config);
                return interaction.editReply({
                    embeds: [VornEmbed.success(
                        `Updated **${SPAM_MODULES.find(m => m.value === moduleName).name}** module:\n${changes.length > 0 ? changes.join(', ') : 'Enabled with current settings.'}`
                    )]
                });
            }
        }
    }
};
