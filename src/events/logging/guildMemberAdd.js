const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        if (!member.guild || !client.logging) return;

        if (await client.logging.shouldIgnore(member.guild.id, { userId: member.id })) return;

        const embed = client.logging.memberJoinEmbed(member);
        await client.logging.send(member.guild, 'members', embed);
    }
};
