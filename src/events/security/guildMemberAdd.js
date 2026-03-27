/**
 * Vorn — Guild Member Add Event (bot_add)
 */

const { AuditLogEvent } = require('discord.js');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        if (!member.guild || !client.antiNuke) return;

        // Only check if it's a bot
        if (!member.user.bot) return;

        setTimeout(async () => {
            try {
                const logs = await member.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.BotAdd
                });

                const log = logs.entries.first();
                if (!log || log.target.id !== member.id) return;

                await client.antiNuke.handleAction(member.guild, log.executor, 'bot_add');
            } catch { }
        }, 500);
    }
};
