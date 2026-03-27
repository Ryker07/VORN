/**
 * Vorn — Premium Embed Builder
 * Typography-focused, invisible embeds for premium aesthetic
 */

const { EmbedBuilder } = require('discord.js');

// Invisible embed color (matches Discord dark theme)
const INVISIBLE_COLOR = 0x2b2d31;

class VornEmbed {
    /**
     * Create a base premium embed
     * @returns {EmbedBuilder}
     */
    static create() {
        return new EmbedBuilder()
            .setColor(INVISIBLE_COLOR)
            .setTimestamp();
    }

    /**
     * Create an info embed with title
     * @param {string} title - Embed title
     * @param {string} description - Embed description
     * @returns {EmbedBuilder}
     */
    static info(title, description) {
        return this.create()
            .setTitle(title)
            .setDescription(description);
    }

    /**
     * Create a success embed
     * @param {string} message - Success message
     * @returns {EmbedBuilder}
     */
    static success(message) {
        return this.create()
            .setDescription(`**Success** ─ ${message}`);
    }

    /**
     * Create an error embed
     * @param {string} message - Error message
     * @returns {EmbedBuilder}
     */
    static error(message) {
        return this.create()
            .setDescription(`**Error** ─ ${message}`);
    }

    /**
     * Create a warning embed
     * @param {string} message - Warning message
     * @returns {EmbedBuilder}
     */
    static warning(message) {
        return this.create()
            .setDescription(`**Warning** ─ ${message}`);
    }

    /**
     * Format text with Discord typography
     */
    static format = {
        /**
         * Bold text
         */
        bold: (text) => `**${text}**`,

        /**
         * Italic text
         */
        italic: (text) => `*${text}*`,

        /**
         * Underline text
         */
        underline: (text) => `__${text}__`,

        /**
         * Strikethrough text
         */
        strike: (text) => `~~${text}~~`,

        /**
         * Inline code
         */
        code: (text) => `\`${text}\``,

        /**
         * Code block
         */
        codeblock: (text, lang = '') => `\`\`\`${lang}\n${text}\n\`\`\``,

        /**
         * Spoiler text
         */
        spoiler: (text) => `||${text}||`,

        /**
         * Header style (bold + underline)
         */
        header: (text) => `**__${text}__**`,

        /**
         * Subheader style (bold)
         */
        subheader: (text) => `**${text}**`,

        /**
         * Muted/dim text style (italic)
         */
        muted: (text) => `*${text}*`,

        /**
         * Create a clean separator line
         */
        separator: () => '─'.repeat(30),

        /**
         * Create a labeled value pair
         */
        field: (label, value) => `**${label}** ─ ${value}`,

        /**
         * Create a bullet list item
         */
        bullet: (text) => `  ▸ ${text}`,

        /**
         * Create a numbered list item
         */
        numbered: (num, text) => `  **${num}.** ${text}`
    };

    /**
     * Add formatted fields to embed
     * @param {EmbedBuilder} embed - The embed
     * @param {Array<{name: string, value: string, inline?: boolean}>} fields - Fields to add
     * @returns {EmbedBuilder}
     */
    static addFields(embed, fields) {
        for (const field of fields) {
            embed.addFields({
                name: field.name,
                value: String(field.value),
                inline: field.inline ?? false
            });
        }
        return embed;
    }

    /**
     * Set the embed footer with Vorn branding
     * @param {EmbedBuilder} embed - The embed
     * @param {string} text - Footer text (optional)
     * @returns {EmbedBuilder}
     */
    static setFooter(embed, text = '') {
        if (!text) return embed;
        return embed.setFooter({ text: text });
    }
}

module.exports = VornEmbed;
