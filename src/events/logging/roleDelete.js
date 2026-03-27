const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildRoleDelete,
    async execute(role, client) {
        if (!role.guild || !client.logging) return;

        const embed = client.logging.roleDeleteEmbed(role);
        await client.logging.send(role.guild, 'roles', embed);
    }
};
