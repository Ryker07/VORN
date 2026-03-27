/**
 * Vorn — Permission Guard
 * Centralized voice channel permission and validation logic
 */

const VornEmbed = require('./embedBuilder');
const { PermissionsBitField } = require('discord.js');

class PermissionGuard {
    /**
     * Validate that the user is in a voice channel
     * @param {Interaction} interaction 
     * @returns {boolean}
     */
    static async checkUserInVoice(interaction) {
        if (!interaction.member.voice.channel) {
            await this.replyError(interaction, 'You must be in a voice channel.');
            return false;
        }
        return true;
    }

    /**
     * Validate bot permissions in the user's voice channel
     * @param {Interaction} interaction 
     * @returns {boolean}
     */
    static async checkBotPermissions(interaction) {
        const channel = interaction.member.voice.channel;
        if (!channel) return false;

        const me = interaction.guild.members.me;
        const permissions = channel.permissionsFor(me);

        const missing = [];
        if (!permissions.has(PermissionsBitField.Flags.Connect)) missing.push('Connect');
        if (!permissions.has(PermissionsBitField.Flags.Speak)) missing.push('Speak');
        if (!permissions.has(PermissionsBitField.Flags.ViewChannel)) missing.push('View Channel');

        if (missing.length > 0) {
            await this.replyError(interaction, `I need the following permissions in your voice channel: **${missing.join(', ')}**`);
            return false;
        }

        return true;
    }

    /**
     * Validate that user is in the SAME voice channel as the bot (if bot is playing)
     * @param {Interaction} interaction 
     * @returns {boolean}
     */
    static async checkSameVoiceChannel(interaction) {
        const botChannel = interaction.guild.members.me.voice.channel;
        const userChannel = interaction.member.voice.channel;

        // If bot isn't in a channel, strict checking isn't needed (or implies bot is free)
        if (!botChannel) return true;

        if (botChannel.id !== userChannel.id) {
            await this.replyError(interaction, `You must be in the same voice channel as me to control the music.\nI'm currently in **${botChannel.name}**.`);
            return false;
        }

        return true;
    }

    /**
     * Helper to reply with error
     */
    static async replyError(interaction, message) {
        const payload = { 
            embeds: [VornEmbed.error(message)], 
            ephemeral: true 
        };

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(payload).catch(() => {});
        } else {
            await interaction.reply(payload).catch(() => {});
        }
    }
}

module.exports = PermissionGuard;
