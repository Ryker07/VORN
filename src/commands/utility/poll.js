/**
 * Vorn — /poll Command
 * Create timed polls with up to 10 options
 */

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');

const activePolls = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a poll')
        .addStringOption(opt =>
            opt.setName('question')
                .setDescription('The poll question')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('options')
                .setDescription('Comma-separated options (max 10)')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('duration')
                .setDescription('Poll duration (e.g. 10m, 1h, 1d) — default 1h')
        ),

    async execute(interaction, client) {
        const question = interaction.options.getString('question');
        const rawOptions = interaction.options.getString('options');
        const durationStr = interaction.options.getString('duration') || '1h';

        // Parse options
        const options = rawOptions.split(',').map(o => o.trim()).filter(Boolean);

        if (options.length < 2) {
            return interaction.reply({
                embeds: [VornEmbed.error('You need at least 2 options. Separate with commas.')],
                ephemeral: true
            });
        }

        if (options.length > 10) {
            return interaction.reply({
                embeds: [VornEmbed.error('Maximum 10 options allowed.')],
                ephemeral: true
            });
        }

        // Parse duration
        const duration = parseDuration(durationStr);
        if (!duration || duration < 60000 || duration > 7 * 24 * 60 * 60 * 1000) {
            return interaction.reply({
                embeds: [VornEmbed.error('Duration must be between 1 minute and 7 days.')],
                ephemeral: true
            });
        }

        const endsAt = Date.now() + duration;
        const endsTimestamp = Math.floor(endsAt / 1000);

        // Labels for options
        const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

        // Initialize vote tracking
        const votes = {};
        const voters = new Map(); // userId -> optionIndex
        options.forEach((_, i) => { votes[i] = 0; });

        // Build embed
        const buildPollEmbed = (ended = false) => {
            const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
            const lines = options.map((opt, i) => {
                const count = votes[i];
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const barLen = totalVotes > 0 ? Math.round((count / totalVotes) * 16) : 0;
                const bar = '█'.repeat(barLen) + '░'.repeat(16 - barLen);
                return `**${labels[i]}** ─ ${opt}\n┃ ${bar} \`${pct}%\` (${count})`;
            });

            const embed = VornEmbed.create()
                .setTitle(question)
                .setDescription([
                    ...lines,
                    '',
                    ended
                        ? `-# Poll ended · ${totalVotes} total votes`
                        : `-# Ends <t:${endsTimestamp}:R> · ${totalVotes} votes`
                ].join('\n'));

            return embed;
        };

        // Build buttons (max 5 per row)
        const buildButtons = (disabled = false) => {
            const rows = [];
            for (let i = 0; i < options.length; i += 5) {
                const chunk = options.slice(i, i + 5);
                const row = new ActionRowBuilder().addComponents(
                    ...chunk.map((_, j) => {
                        const idx = i + j;
                        return new ButtonBuilder()
                            .setCustomId(`poll_vote_${idx}`)
                            .setLabel(labels[idx])
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(disabled);
                    })
                );
                rows.push(row);
            }
            return rows;
        };

        await interaction.reply({
            embeds: [buildPollEmbed()],
            components: buildButtons()
        });

        const message = await interaction.fetchReply();
        const pollId = message.id;

        // Collector
        const collector = message.createMessageComponentCollector({
            filter: (i) => i.customId.startsWith('poll_vote_'),
            time: duration
        });

        collector.on('collect', async (i) => {
            const optionIndex = parseInt(i.customId.replace('poll_vote_', ''));

            // Check if already voted
            const previousVote = voters.get(i.user.id);
            if (previousVote !== undefined) {
                // Switch vote
                votes[previousVote]--;
            }

            votes[optionIndex]++;
            voters.set(i.user.id, optionIndex);

            await i.update({
                embeds: [buildPollEmbed()],
                components: buildButtons()
            });
        });

        collector.on('end', async () => {
            try {
                await message.edit({
                    embeds: [buildPollEmbed(true)],
                    components: buildButtons(true)
                });
            } catch { }
        });
    }
};

/**
 * Parse duration string to milliseconds
 */
function parseDuration(str) {
    if (!str) return null;
    const match = str.match(/^(\d+)(m|h|d|w)$/i);
    if (!match) return null;

    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = { m: 60000, h: 3600000, d: 86400000, w: 604800000 };
    return num * (multipliers[unit] || 0);
}
