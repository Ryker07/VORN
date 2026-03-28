/**
 * Vorn — Premium Giveaway Setup Wizard
 * Provides an interactive, button-based dashboard to draft giveaways
 */

const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder
} = require('discord.js');
const VornEmbed = require('../utils/embedBuilder');

class GiveawayWizard {
    constructor(client) {
        this.client = client;
        // memory cache: { interactionId: { channelId, data } }
        this.drafts = new Map();
    }

    // Initialize the wizard
    async startWizard(interaction) {
        const draftId = interaction.id;

        const draft = {
            prize: 'Not set',
            durationStr: 'Not set',
            durationMs: 0,
            winners: 1,
            color: null,
            description: null,
            bannerUrl: null,
            sponsorText: null,
            minAccountAge: null,
            minMemberAge: null,
            voiceRequirement: false,
            reqRoleIds: [],
            bypassRoleIds: [],
            pingRoleId: null
        };

        this.drafts.set(draftId, {
            userId: interaction.user.id,
            channelId: interaction.channel.id,
            draft
        });

        await interaction.reply({
            embeds: [this.buildDraftEmbed(draft)],
            components: this.buildComponents(draftId),
            ephemeral: true
        });

        // Cleanup after 15 mins
        setTimeout(() => this.drafts.delete(draftId), 900000);
    }

    buildDraftEmbed(draft) {
        return VornEmbed.create()
            .setTitle('🛠️ Giveaway Creator Dashboard')
            .setDescription('Construct your premium giveaway step-by-step. Click the buttons below to modify sections, then click **Start Giveaway** when ready.')
            .addFields(
                {
                    name: '📝 Basic Info',
                    value: `**Prize:** ${draft.prize}\n**Duration:** ${draft.durationStr}\n**Winners:** ${draft.winners}`,
                    inline: false
                },
                {
                    name: '⚙️ Requirements',
                    value: `**Account Age:** ${draft.minAccountAge ? draft.minAccountAge + 'd' : 'None'}\n**Server Time:** ${draft.minMemberAge ? draft.minMemberAge + 'd' : 'None'}\n**Voice Required:** ${draft.voiceRequirement ? 'Yes' : 'No'}`,
                    inline: true
                },
                {
                    name: '🎨 Aesthetics',
                    value: `**Color:** ${draft.color || 'Default'}\n**Sponsor:** ${draft.sponsorText || 'Self'}\n**Banner:** ${draft.bannerUrl ? 'Set' : 'None'}`,
                    inline: true
                }
            );
    }

    buildComponents(draftId) {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gwdraft_basic_${draftId}`).setLabel('Edit Basics').setEmoji('📝').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`gwdraft_reqs_${draftId}`).setLabel('Edit Reqs').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`gwdraft_visuals_${draftId}`).setLabel('Edit Visuals').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`gwdraft_toggle_voice_${draftId}`).setLabel('Toggle Voice Reqs').setEmoji('🎙️').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gwdraft_roles_${draftId}`).setLabel('Select Roles').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`gwdraft_start_${draftId}`).setLabel('🚀 Start Giveaway').setStyle(ButtonStyle.Success)
        );

        return [row1, row2];
    }

    async handleInteraction(interaction) {
        if (!interaction.customId.startsWith('gwdraft_')) return false;

        const parts = interaction.customId.split('_');
        const action = parts[1];
        // Handle toggle voice button which has 3 parts before ID
        let draftId = parts[2];
        if (action === 'toggle' && parts[2] === 'voice') draftId = parts[3];

        const session = this.drafts.get(draftId);

        if (!session) {
            await interaction.reply({ content: '❌ This wizard session has expired. Run `/giveaway create` again.', ephemeral: true });
            return true;
        }

        if (session.userId !== interaction.user.id) {
            await interaction.reply({ content: '❌ This is not your wizard session.', ephemeral: true });
            return true;
        }

        if (action === 'basic') {
            const modal = new ModalBuilder().setCustomId(`gWModal_basic_${draftId}`).setTitle('Basic Settings');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('prize').setLabel('Prize').setStyle(TextInputStyle.Short).setValue(session.draft.prize !== 'Not set' ? session.draft.prize : '').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('duration').setLabel('Duration (10m, 1h, 1d)').setStyle(TextInputStyle.Short).setValue(session.draft.durationStr !== 'Not set' ? session.draft.durationStr : '').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('winners').setLabel('Number of Winners').setStyle(TextInputStyle.Short).setValue(session.draft.winners.toString()).setRequired(true))
            );
            await interaction.showModal(modal);
            return true;
        }

        if (action === 'reqs') {
            const modal = new ModalBuilder().setCustomId(`gWModal_reqs_${draftId}`).setTitle('Requirements');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('accAge').setLabel('Min Account Age (Days)').setStyle(TextInputStyle.Short).setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mbrAge').setLabel('Min Server Time (Days)').setStyle(TextInputStyle.Short).setRequired(false))
            );
            await interaction.showModal(modal);
            return true;
        }

        if (action === 'visuals') {
            const modal = new ModalBuilder().setCustomId(`gWModal_visuals_${draftId}`).setTitle('Aesthetics');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Embed Hex Color (e.g. #ff0000)').setStyle(TextInputStyle.Short).setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sponsor').setLabel('Custom Sponsor / Hosted By').setStyle(TextInputStyle.Short).setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('banner').setLabel('Banner Image URL').setStyle(TextInputStyle.Short).setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Custom Description').setStyle(TextInputStyle.Paragraph).setRequired(false))
            );
            await interaction.showModal(modal);
            return true;
        }

        if (action === 'toggle') {
            session.draft.voiceRequirement = !session.draft.voiceRequirement;
            await interaction.update({ embeds: [this.buildDraftEmbed(session.draft)], components: this.buildComponents(draftId) });
            return true;
        }

        if (action === 'roles') {
            const embed = VornEmbed.create()
                .setTitle('Role Selection')
                .setDescription('Select the roles using the menus below. You can assign Required Roles and Bypass Roles.');

            const reqMenu = new RoleSelectMenuBuilder()
                .setCustomId(`gWSelect_req_${draftId}`)
                .setPlaceholder('Select Required Roles (Max 5)')
                .setMinValues(0)
                .setMaxValues(5);

            const bypassMenu = new RoleSelectMenuBuilder()
                .setCustomId(`gWSelect_bypass_${draftId}`)
                .setPlaceholder('Select Bypass Roles (Max 5)')
                .setMinValues(0)
                .setMaxValues(5);

            await interaction.reply({
                embeds: [embed],
                components: [
                    new ActionRowBuilder().addComponents(reqMenu),
                    new ActionRowBuilder().addComponents(bypassMenu)
                ],
                ephemeral: true
            });
            return true;
        }

        if (action === 'start') {
            if (session.draft.prize === 'Not set' || session.draft.durationMs === 0) {
                return interaction.reply({ content: '❌ You must set at least a Prize and Duration before starting.', ephemeral: true });
            }

            await interaction.update({ content: '🚀 Starting giveaway...', embeds: [], components: [] });

            const channel = interaction.guild.channels.cache.get(session.channelId);

            const data = {
                channel: channel,
                prize: session.draft.prize,
                duration: session.draft.durationMs,
                winners: session.draft.winners,
                reqRoleIds: session.draft.reqRoleIds,
                bypassRoleIds: session.draft.bypassRoleIds,
                minAccountAge: session.draft.minAccountAge,
                minMemberAge: session.draft.minMemberAge,
                voiceRequirement: session.draft.voiceRequirement,
                embedColor: session.draft.color,
                embedDescription: session.draft.description,
                bannerUrl: session.draft.bannerUrl,
                sponsorText: session.draft.sponsorText,
                pingRoleId: session.draft.pingRoleId,
                bonusRoles: [],
                blacklistRoleIds: [],
                blacklistUserIds: []
            };

            await this.client.giveawayManager.createGiveaway(interaction, data);

            this.drafts.delete(draftId);
            return true;
        }

        return false;
    }

    async handleModalSubmit(interaction) {
        if (!interaction.customId.startsWith('gWModal_')) return false;

        const parts = interaction.customId.split('_');
        const type = parts[1];
        const draftId = parts[2];
        const session = this.drafts.get(draftId);

        if (!session) {
            await interaction.reply({ content: '❌ Session expired.', ephemeral: true });
            return true;
        }

        if (type === 'basic') {
            const prize = interaction.fields.getTextInputValue('prize');
            const durationStr = interaction.fields.getTextInputValue('duration');
            const winners = parseInt(interaction.fields.getTextInputValue('winners'));

            const ms = this.parseDuration(durationStr);
            if (!ms) return interaction.reply({ content: '❌ Invalid duration format.', ephemeral: true });
            if (isNaN(winners) || winners < 1) return interaction.reply({ content: '❌ Invalid winners count.', ephemeral: true });

            session.draft.prize = prize;
            session.draft.durationStr = durationStr;
            session.draft.durationMs = ms;
            session.draft.winners = winners;
        }

        if (type === 'reqs') {
            const acc = interaction.fields.getTextInputValue('accAge');
            const mbr = interaction.fields.getTextInputValue('mbrAge');
            session.draft.minAccountAge = acc && !isNaN(acc) ? parseInt(acc) : null;
            session.draft.minMemberAge = mbr && !isNaN(mbr) ? parseInt(mbr) : null;
        }

        if (type === 'visuals') {
            session.draft.color = interaction.fields.getTextInputValue('color') || null;
            session.draft.sponsorText = interaction.fields.getTextInputValue('sponsor') || null;
            session.draft.bannerUrl = interaction.fields.getTextInputValue('banner') || null;
            session.draft.description = interaction.fields.getTextInputValue('desc') || null;
        }

        await interaction.update({ embeds: [this.buildDraftEmbed(session.draft)], components: this.buildComponents(draftId) });
        return true;
    }

    async handleSelectMenu(interaction) {
        if (!interaction.customId.startsWith('gWSelect_')) return false;

        const parts = interaction.customId.split('_');
        const type = parts[1];
        const draftId = parts[2];
        const session = this.drafts.get(draftId);

        if (!session) {
            await interaction.reply({ content: '❌ Session expired.', ephemeral: true });
            return true;
        }

        if (type === 'req') {
            session.draft.reqRoleIds = interaction.values;
        } else if (type === 'bypass') {
            session.draft.bypassRoleIds = interaction.values;
        }

        // We update the original dashboard message behind the scenes
        // But since this interaction is from a new ephemeral message, we must update this menu message to say "Saved!"
        await interaction.update({ content: '✅ Roles updated! You can dismiss this message.', embeds: [], components: [] });

        // Try to update the main dashboard quietly if possible. Discord doesn't natively support updating 
        // a different interaction token easily here without saving the message object, so we leave it as is.
        // The data is saved in memory and will apply on Start.

        return true;
    }

    parseDuration(str) {
        if (!str) return null;
        const match = str.match(/^(\d+)([smhd])$/);
        if (!match) return null;
        const val = parseInt(match[1]);
        const unit = match[2];
        const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
        return val * multipliers[unit];
    }
}

module.exports = GiveawayWizard;
