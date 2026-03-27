/**
 * Vorn — Premium Discord Bot
 * Main Entry Point
 */

const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');

// Initialize Web Server for Render
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Vorn is online and running!'));
app.listen(port, () => console.log(`[Vorn] Web server listening on port ${port}`));

let config;
try {
    config = require('../config.json');
} catch (e) {
    config = {
        token: process.env.DISCORD_TOKEN || process.env.TOKEN,
        clientId: process.env.CLIENT_ID,
        databaseServerId: process.env.DATABASE_SERVER_ID,
        databaseCategoryId: process.env.DATABASE_CATEGORY_ID,
        apifyToken: process.env.APIFY_TOKEN
    };
}
const CommandHandler = require('./handlers/commandHandler');
const EventHandler = require('./handlers/eventHandler');
const ChannelDatabase = require('./database/ChannelDatabase');
const AntiNukeManager = require('./security/AntiNukeManager');
const BackupManager = require('./security/BackupManager');
const ModerationManager = require('./moderation/ModerationManager');
const TicketManager = require('./tickets/TicketManager');
const GiveawayManager = require('./giveaways/GiveawayManager');
const GiveawayWizard = require('./giveaways/GiveawayWizard');
const AntiRaidManager = require('./security/AntiRaidManager');
const AutoModManager = require('./security/AutoModManager');
const ReactionRoleManager = require('./roles/ReactionRoleManager');
const WelcomeManager = require('./welcome/WelcomeManager');
const WelcomeEditor = require('./welcome/WelcomeEditor');
const AfkManager = require('./utility/AfkManager');
const VoiceManager = require('./voice/VoiceManager');
const InviteManager = require('./invites/InviteManager');
const LoggingManager = require('./logging/LoggingManager');

// Initialize client with required intents for security features
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,       // For member join/leave/ban tracking
        GatewayIntentBits.GuildModeration,    // For ban events
        GatewayIntentBits.GuildMessages,      // For message events
        GatewayIntentBits.MessageContent,     // For spam detection
        GatewayIntentBits.GuildVoiceStates,   // For music
        GatewayIntentBits.GuildInvites         // For invite tracking
    ]
});

// Store references globally
client.config = config;
client.commandHandler = new CommandHandler(client, config);
client.eventHandler = new EventHandler(client);
client.db = null;
client.antiNuke = null;
client.backupManager = null;
client.moderation = null;
client.ticketManager = null;
client.giveawayManager = null;
client.antiRaid = null;
client.automod = null;
client.reactionRoles = null;
client.voiceManager = null;
client.invites = null;
client.logging = null;

// Ready event
client.once('clientReady', async () => {
    console.log(`[Vorn] Logged in as ${client.user.tag}`);
    console.log(`[Vorn] Serving ${client.guilds.cache.size} servers`);

    // Premium RPC Status
    client.user.setPresence({
        activities: [{ name: '/guide | Securing servers', type: ActivityType.Watching }],
        status: 'dnd',
    });

    // Initialize database
    try {
        client.db = new ChannelDatabase(client, config);
        console.log('[Vorn] Database initialized');
    } catch (error) {
        console.error(`[Vorn] Database initialization failed: ${error.message}`);
    }

    // Initialize Anti-Nuke system
    client.antiNuke = new AntiNukeManager(client);
    console.log('[Vorn] Anti-Nuke system loaded');

    // Initialize Backup Manager
    client.backupManager = new BackupManager(client);
    console.log('[Vorn] Backup system loaded');

    // Initialize Moderation Manager
    client.moderation = new ModerationManager(client);
    console.log('[Vorn] Moderation system loaded');

    // Initialize Ticket Manager
    client.ticketManager = new TicketManager(client);
    console.log('[Vorn] Ticket system loaded');

    // Initialize Giveaway Manager & Custom Dashboard Wizard
    client.giveawayManager = new GiveawayManager(client);
    client.giveawayManager.start();
    client.giveawayWizard = new GiveawayWizard(client);
    console.log('[Vorn] Giveaway system & Wizard loaded');

    // Initialize Anti-Raid Manager
    client.antiRaid = new AntiRaidManager(client);
    console.log('[Vorn] Anti-Raid system loaded');

    // Initialize AutoMod Manager
    client.automod = new AutoModManager(client);
    console.log('[Vorn] AutoMod system loaded');

    // Initialize Reaction Role Manager
    client.reactionRoles = new ReactionRoleManager(client);
    console.log('[Vorn] Reaction Roles loaded');

    // Initialize Invite Manager (before Welcome so invite cache is ready)
    client.invites = new InviteManager(client);
    console.log('[Vorn] Invite system loaded');

    // Initialize Welcome Manager
    client.welcome = new WelcomeManager(client);
    client.welcomeEditor = new WelcomeEditor(client);
    console.log('[Vorn] Welcome system loaded');

    // Initialize AFK Manager
    client.afk = new AfkManager(client);
    console.log('[Vorn] AFK system loaded');

    // Initialize Voice Manager (Join-to-Create)
    client.voiceManager = new VoiceManager(client);
    console.log('[Vorn] Voice system loaded');

    // Initialize Logging Manager
    client.logging = new LoggingManager(client);
    console.log('[Vorn] Logging system loaded');

    // Check for 30-day auto-refresh on all guilds with autorecovery enabled
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const config = await client.antiNuke.getConfig(guildId);
            if (config.autoRecovery) {
                const backup = await client.backupManager.getBackup(guildId);
                if (client.backupManager.needsRefresh(backup)) {
                    await client.backupManager.createBackup(guild);
                    console.log(`[Vorn] Auto-refreshed backup for ${guild.name}`);
                }
            }
        } catch { }
    }

    // Load events
    await client.eventHandler.loadEvents();

    // Load and register commands
    await client.commandHandler.loadCommands();
    await client.commandHandler.registerCommands();

    console.log('[Vorn] Ready');
    console.log('');
});


// Interaction handler
client.on('interactionCreate', async (interaction) => {
    await client.commandHandler.handleInteraction(interaction);
});

// Error handling
client.on('error', (error) => {
    console.error(`[Vorn] Client error: ${error.message}`);
});

process.on('unhandledRejection', (error) => {
    console.error(`[Vorn] Unhandled rejection:`, error);
});

process.on('uncaughtException', (error) => {
    console.error(`[Vorn] Uncaught exception:`, error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('[Vorn] Shutting down...');

    if (client.db) {
        await client.db.forceFlush();
        client.db.stopFlushCycle();
    }

    client.destroy();
    process.exit(0);
});



// Login
client.login(config.token).catch((error) => {
    console.error(`[Vorn] Login failed: ${error.message}`);
    process.exit(1);
});
