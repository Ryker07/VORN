const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');
const ReelsManager = require('../../systems/social/ReelsManager');

// Lazy load manager instance
let reelsManager = null;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reels')
        .setDescription('Advanced Instagram Reels Manager')
        .addSubcommand(sub =>
            sub.setName('post')
                .setDescription('Post an Instagram reel (Downloads video natively)')
                .addStringOption(opt =>
                    opt.setName('url')
                        .setDescription('The Instagram Reel URL')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('caption')
                        .setDescription('Optional context to add to the post')
                        .setRequired(false)
                )
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Specific channel to post to (Overrides default setting)')
                        .setRequired(false)
                )
        )
        .addSubcommandGroup(group =>
            group.setName('setup')
                .setDescription('Configure the Reels system')
                .addSubcommand(sub =>
                    sub.setName('channel')
                        .setDescription('Set the target channel for reels')
                        .addChannelOption(opt =>
                            opt.setName('target')
                                .setDescription('The channel to post in')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName('role')
                        .setDescription('Add/Remove publisher roles')
                        .addRoleOption(opt =>
                            opt.setName('role')
                                .setDescription('The role to allow/disallow')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName('ping')
                        .setDescription('Set a notification role (ping on post)')
                        .addRoleOption(opt =>
                            opt.setName('role')
                                .setDescription('The role to ping (leave empty to disable)')
                                .setRequired(false)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName('template')
                        .setDescription('Set message template')
                        .addStringOption(opt =>
                            opt.setName('format')
                                .setDescription('{caption}, {url}, {user}, {author} supported')
                                .setRequired(true)
                        )
                )
        ),

    async execute(interaction, client) {
        if (!reelsManager) {
            reelsManager = new ReelsManager(client);
        }

        const subcommand = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup();
        const guildId = interaction.guild.id;

        // POST Command
        if (subcommand === 'post') {
            const url = interaction.options.getString('url');
            const caption = interaction.options.getString('caption');
            const targetChannel = interaction.options.getChannel('channel');
            return client.reelsManager.postReel(interaction, url, caption, targetChannel);
        }

        // Configuration Commands (Requires Admin)
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                embeds: [VornEmbed.error('Permission Denied', 'You need Administrator permissions to configure this.')],
                flags: MessageFlags.Ephemeral
            });
        }

        const config = await reelsManager.getConfig(guildId);

        if (group === 'setup') {
            if (subcommand === 'channel') {
                const channel = interaction.options.getChannel('target');
                config.channelId = channel.id;
                config.enabled = true;
                await reelsManager.setConfig(guildId, config);

                return interaction.reply({
                    embeds: [VornEmbed.success('Configuration Updated', `Reels will now be posted in ${channel}`)],
                    flags: MessageFlags.Ephemeral
                });
            }

            if (subcommand === 'role') {
                const role = interaction.options.getRole('role');
                if (config.roleIds.includes(role.id)) {
                    config.roleIds = config.roleIds.filter(id => id !== role.id);
                    await reelsManager.setConfig(guildId, config);
                    return interaction.reply({
                        embeds: [VornEmbed.success('Role Removed', `${role} removed from publishers.`)],
                        flags: MessageFlags.Ephemeral
                    });
                } else {
                    config.roleIds.push(role.id);
                    await reelsManager.setConfig(guildId, config);
                    return interaction.reply({
                        embeds: [VornEmbed.success('Role Added', `${role} added to publishers.`)],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            if (subcommand === 'ping') {
                const role = interaction.options.getRole('role');
                config.pingRoleId = role ? role.id : null;
                await reelsManager.setConfig(guildId, config);

                return interaction.reply({
                    embeds: [VornEmbed.success('Notification Role', role ? `Set ping role to ${role}` : 'Disabled notifications.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            if (subcommand === 'template') {
                const format = interaction.options.getString('format');
                config.template = format;
                await reelsManager.setConfig(guildId, config);

                return interaction.reply({
                    embeds: [VornEmbed.success('Template Updated', `New format:\n\`${format}\``)],
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};
