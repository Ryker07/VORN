const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client) {
        if (!newMember.guild || !client.logging) return;

        const changes = [];

        // Nickname change
        if (oldMember.nickname !== newMember.nickname) {
            changes.push(`**Nickname:** \`${oldMember.nickname || oldMember.user.username}\` ➔ \`${newMember.nickname || newMember.user.username}\``);
        }

        // Role changes
        if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
            const added = newMember.roles.cache.filter(x => !oldMember.roles.cache.has(x.id));
            const removed = oldMember.roles.cache.filter(x => !newMember.roles.cache.has(x.id));

            if (added.size > 0) changes.push(`**Roles Added:** ${added.map(r => `<@&${r.id}>`).join(' ')}`);
            if (removed.size > 0) changes.push(`**Roles Removed:** ${removed.map(r => `<@&${r.id}>`).join(' ')}`);
        }

        // Avatar changes (Member Avatar vs User Avatar - D.js checks this depending on intent)
        if (oldMember.avatar !== newMember.avatar) {
            changes.push(`**Server Avatar Changed**`);
        }

        if (changes.length === 0) return;

        if (await client.logging.shouldIgnore(newMember.guild.id, { userId: newMember.id })) return;

        const embed = client.logging.memberUpdateEmbed(oldMember, newMember, changes);
        await client.logging.send(newMember.guild, 'members', embed);
    }
};
