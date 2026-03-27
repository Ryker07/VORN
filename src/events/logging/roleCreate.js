const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildRoleCreate,
    async execute(role, client) {
        if (!role.guild || !client.logging) return;

        const embed = client.logging.roleCreateEmbed(role);
        await client.logging.send(role.guild, 'roles', embed);
    }
};
