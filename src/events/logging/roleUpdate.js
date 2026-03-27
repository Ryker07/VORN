const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildRoleUpdate,
    async execute(oldRole, newRole, client) {
        if (!newRole.guild || !client.logging) return;

        if (await client.logging.shouldIgnore(newRole.guild.id, { roleIds: [newRole.id] })) return;

        const changes = [];

        if (oldRole.name !== newRole.name) {
            changes.push(`**Name:** \`${oldRole.name}\` ➔ \`${newRole.name}\``);
        }

        if (oldRole.hexColor !== newRole.hexColor) {
            changes.push(`**Color:** \`${oldRole.hexColor}\` ➔ \`${newRole.hexColor}\``);
        }

        if (oldRole.hoist !== newRole.hoist) {
            changes.push(`**Hoisted:** ${oldRole.hoist ? 'Yes' : 'No'} ➔ ${newRole.hoist ? 'Yes' : 'No'}`);
        }

        if (oldRole.mentionable !== newRole.mentionable) {
            changes.push(`**Mentionable:** ${oldRole.mentionable ? 'Yes' : 'No'} ➔ ${newRole.mentionable ? 'Yes' : 'No'}`);
        }

        if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
            changes.push(`**Permissions Changed**`); // Full diffs are complex, keep it simple for now
        }

        if (changes.length === 0) return;

        const embed = client.logging.roleUpdateEmbed(oldRole, newRole, changes);
        await client.logging.send(newRole.guild, 'roles', embed);
    }
};
