/**
 * Vorn — Premium Guide Command
 * Interactive documentation with canvas banners, premium formatting, and rich navigation
 */

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    AttachmentBuilder,
    ComponentType
} = require('discord.js');
const VornEmbed = require('../../utils/embedBuilder');
const GuideRenderer = require('../../utils/GuideRenderer');

// ═══════════════════════════════════════════════════════════════
// GUIDE DATA
// ═══════════════════════════════════════════════════════════════
const GUIDE_DATA = {
    home: {
        title: 'Vorn Documentation',
        description: 'Engineered for Complete Server Control',
        sections: [
            {
                name: 'Overview',
                content: [
                    '### System Directory',
                    '',
                    '```',
                    'System         Features',
                    '─────────────────────────────────────',
                    'Security       Anti-Nuke, Anti-Raid, Backups',
                    'AutoMod        Spam, Links, Content Filtering',
                    'Moderation     Escalation, Decay, Slowmode',
                    'Welcome        Canvas Cards, Goodbye, Invites',
                    'Invites        Tracking, Leaderboard, Rewards',
                    'Tickets        SLA, Canned, Performance',
                    'Giveaways      Requirements, Drops, Schedule',
                    'Roles          Reaction Roles, Auto Roles',
                    'Voice          Join-to-Create Channels',
                    'Social         Instagram Reels, Native Uploads',
                    'Utility        AFK, Info, Polls, Embeds',
                    '```',
                    '',
                    '-# Use the buttons below to navigate between sections'
                ]
            }
        ]
    },

    security: {
        title: 'Security',
        description: 'Anti-Nuke · Anti-Raid · Backups',
        sections: [
            {
                name: 'Anti-Nuke',
                content: [
                    '### Anti-Nuke Protection',
                    '',
                    '> Monitors destructive actions and auto-punishes rogue admins',
                    '',
                    '**Configuration**',
                    '┃ `/antinuke enable` — Activate protection',
                    '┃ `/antinuke module` — Set limit/time/action',
                    '┃ `/antinuke autorecovery` — Auto-restore nuke',
                    '┃ `/antinuke settings` — View config status',
                    '┃ `/whitelist add` — Exempt a trusted user',
                    '',
                    '**Monitored Events**',
                    '╸ Mass channel create / delete',
                    '╸ Mass role create / delete',
                    '╸ Mass ban / kick',
                    '╸ Mass member prune',
                    '╸ Server settings changes',
                    '╸ Webhook / integration abuse',
                    '',
                    '-# Triggers: strip roles, ban, DM server owner'
                ]
            },
            {
                name: 'Anti-Raid',
                content: [
                    '### Anti-Raid System',
                    '',
                    '> Auto-detects mass joins and takes defensive action',
                    '',
                    '**Configuration**',
                    '┃ `/antiraid enable` — Activate',
                    '┃ `/antiraid disable` — Deactivate',
                    '┃ `/antiraid threshold [count] [seconds]`',
                    '┃ `/antiraid action [ban/kick/timeout]`',
                    '┃ `/antiraid settings` — View config',
                    '',
                    '**Smart Detection**',
                    '╸ New account age filtering',
                    '╸ Join velocity spike detection',
                    '╸ Username pattern matching',
                    '╸ Auto-lockdown mode',
                    '',
                    '-# Pairs with verification gate for maximum protection'
                ]
            },
            {
                name: 'Backups',
                content: [
                    '### Server Backups',
                    '',
                    '> Snapshot and restore your server configuration',
                    '',
                    '**Commands**',
                    '┃ `/backup create` — Create new backup',
                    '┃ `/backup list` — View saved backups',
                    '┃ `/restore [id]` — Restore a backup',
                    '┃ `/backup delete [id]` — Remove backup',
                    '',
                    '**What Gets Saved**',
                    '╸ Channels, categories, permissions',
                    '╸ Roles, colors, hierarchy',
                    '╸ Server settings and icon',
                    '╸ Emoji and stickers',
                    '',
                    '-# Backups do not include messages or member data'
                ]
            },
            {
                name: 'Whitelist',
                content: [
                    '### Security Whitelist',
                    '',
                    '> Exempt trusted admins, bots, or staff from security checks',
                    '',
                    '**Commands**',
                    '┃ `/whitelist add [user] [system] [modules]`',
                    '┃ `/whitelist remove [user] [system]`',
                    '┃ `/whitelist list` — View trusted users',
                    '┃ `/whitelist modules` — View Anti-Nuke systems',
                    '',
                    '**Supported Systems**',
                    '╸ `antinuke` (Anti-Nuke)',
                    '╸ `antiraid` (Anti-Raid)',
                    '╸ `automod` (AutoMod)',
                    '╸ `all` (All Systems)',
                    '',
                    '-# Add "all" to bypass everything automatically'
                ]
            },
            {
                name: 'Audit Logs',
                content: [
                    '### Audit Logs',
                    '',
                    '> Detailed, beautiful tracking of server events',
                    '',
                    '**Setup**',
                    '┃ `/logsetup status [enabled:True]`',
                    '┃ `/logsetup default_channel [channel]`',
                    '┃ `/logsetup category_channel [channel] [category]`',
                    '┃ `/logsetup toggle [category]`',
                ]
            }
        ]
    },

    automod: {
        title: 'AutoMod',
        description: 'Spam · Links · Content Filtering',
        sections: [
            {
                name: 'Overview & Config',
                content: [
                    '### AutoMod Core Settings',
                    '',
                    '> Dashboard and global overrides for all filtering systems',
                    '',
                    '**Configuration**',
                    '┃ `/filter view` — View dashboard of all active filters',
                    '┃ `/automod admin [immune]` — Toggle if admins bypass filters',
                    '┃ `/automod log [channel]` — Set dedicated AutoMod log channel',
                    '',
                    '**Exemptions** (Ignore list)',
                    '┃ `/automod ignore channel [add/remove] [channel]`',
                    '┃ `/automod ignore role [add/remove] [role]`',
                    '┃ `/automod ignore list` — View all bypassed entities',
                    '',
                    '-# Admins bypass everything by default unless changed'
                ]
            },
            {
                name: 'Content Filters',
                content: [
                    '### Word & File Filtering',
                    '',
                    '> Intercept and block exact phrases or file uploads instantly',
                    '',
                    '**Word Blocking**',
                    '┃ `/filter words toggle [state]`',
                    '┃ `/filter words add [word] [type]` — Types: Exact, Contains, Regex',
                    '┃ `/filter words remove [word]`',
                    '┃ `/filter words config [action] [warning]`',
                    '',
                    '**File Extensions**',
                    '┃ `/filter files toggle [state]`',
                    '┃ `/filter files block [extension]` (e.g. .exe, .apk)',
                    '┃ `/filter files allow [extension]`',
                    '┃ `/filter files config [action] [warning]`',
                    '',
                    '-# Add custom DM warning messages to tell users exactly why their message was deleted'
                ]
            },
            {
                name: 'Links & Spam',
                content: [
                    '### Invites & Chat Spam',
                    '',
                    '> Stop raid flooding, Discord invite drops, and mass-mentions',
                    '',
                    '**Discord Invites**',
                    '┃ `/filter invites toggle [state]`',
                    '┃ `/filter invites config [action] [warning]`',
                    '╸ Automatically allows invites pointing to THIS server',
                    '',
                    '**Spam Modules**',
                    '╸ Rate Limit · Mentions · Caps · Newlines',
                    '╸ Emojis · Duplicates · Zalgo · Mass Attachments',
                    '',
                    '┃ `/filter spam setup [module] [limit] [action] [warning]`',
                    '┃ `/filter spam toggle [module] [state]`',
                    '',
                    '-# Actions: Warn, Mute, Kick, Ban, Delete Only'
                ]
            }
        ]
    },

    moderation: {
        title: 'Moderation',
        description: 'Escalation · Decay · History · Cases',
        sections: [
            {
                name: 'Punishments',
                content: [
                    '### User Moderation',
                    '',
                    '> All actions generate a case ID and send DM notifications',
                    '',
                    '**Punishments**',
                    '┃ `/mod timeout [user] [duration] [reason]`',
                    '┃ `/mod untimeout [user] [reason]`',
                    '┃ `/mod kick [user] [reason]`',
                    '┃ `/mod ban [user] [reason] [delete_messages]`',
                    '┃ `/mod tempban [user] [duration] [reason]`',
                    '┃ `/mod softban [user] [reason]`',
                    '┃ `/mod unban [userid] [reason]`',
                    '',
                    '**Duration Formats**',
                    '╸ `10m` `1h` `6h` `1d` `3d` `1w`',
                    '',
                    '-# Tempbans auto-expire · Softban = ban + unban (clears messages)'
                ]
            },
            {
                name: 'Channels',
                content: [
                    '### Channel Management',
                    '',
                    '**Lockdown**',
                    '┃ `/channel lock` — Prevent chatting',
                    '┃ `/channel unlock` — Re-enable',
                    '',
                    '**Visibility**',
                    '┃ `/channel hide` — Hide from everyone',
                    '┃ `/channel unhide` — Make visible',
                    '',
                    '**Cleanup**',
                    '┃ `/channel nuke` — Clone and delete (full clear)',
                    '',
                    '**Slowmode**',
                    '┃ `/slowmode [duration] [channel]` — Set rate limit',
                    '╸ Presets: 5s, 10s, 30s, 1m, 5m, 10m, 30m, 1h, 6h',
                    '',
                    '**Purge**',
                    '┃ `/purge all [amount]`',
                    '┃ `/purge user [amount] [target]`',
                    '┃ `/purge bots [amount]`',
                    '┃ `/purge links [amount]`',
                    '┃ `/purge images [amount]`',
                    '┃ `/purge contains [amount] [text]`',
                    '',
                    '-# Channel actions and purges log to modlogs'
                ]
            },
            {
                name: 'Voice & Roles',
                content: [
                    '### Voice Moderation',
                    '',
                    '┃ `/voice mute [user]` — Server mute',
                    '┃ `/voice unmute [user]`',
                    '┃ `/voice deafen [user]` — Server deafen',
                    '┃ `/voice undeafen [user]`',
                    '┃ `/voice kick [user]` — Disconnect',
                    '┃ `/voice move [user] [channel]`',
                    '',
                    '### Role Management',
                    '',
                    '┃ `/role add [user] [role]`',
                    '┃ `/role remove [user] [role]`',
                    '┃ `/role strip [user]` — Remove all roles',
                    '┃ `/role humans [role]` — Add to all humans',
                    '┃ `/role bots [role]` — Add to all bots',
                    '',
                    '-# Mass actions have a safety confirmation prompt'
                ]
            },
            {
                name: 'Warnings & Cases',
                content: [
                    '### Warning System',
                    '',
                    '> Warnings auto-escalate to punishments at thresholds',
                    '',
                    '┃ `/warn add [user] [reason]`',
                    '┃ `/warn list [user]` — Active + decayed counts',
                    '┃ `/warn remove [user] [warn_id]`',
                    '┃ `/warn clear [user]`',
                    '',
                    '### Case Management',
                    '',
                    '┃ `/case view [id]` — Details',
                    '┃ `/case reason [id] [new_reason]` — Update',
                    '┃ `/case delete [id]` — Admin only',
                    '┃ `/case search [user] [type] [moderator]`',
                    '',
                    '**Logging**',
                    '┃ `/modlogs set [channel]` · `/modlogs disable`',
                    '',
                    '-# Warn decay auto-expires warnings after configurable TTL'
                ]
            },
            {
                name: 'Mod Config',
                content: [
                    '### Moderation Config',
                    '',
                    '**Auto-Escalation** — Auto-punish at warn thresholds',
                    '┃ `/modconfig escalation set [warns] [action] [duration]`',
                    '┃ `/modconfig escalation remove [warns]`',
                    '┃ `/modconfig escalation toggle`',
                    '┃ `/modconfig escalation view`',
                    '',
                    '**Warn Decay** — Warnings expire over time',
                    '┃ `/modconfig decay set [days]`',
                    '┃ `/modconfig decay disable`',
                    '┃ `/modconfig decay view`',
                    '',
                    '**Other**',
                    '┃ `/modconfig dm toggle` — Toggle DM notifications',
                    '┃ `/modconfig view` — All settings',
                    '┃ `/modconfig stats [moderator]` — Mod stats',
                    '',
                    '┃ `/history [user]` — Paginated moderation history',
                    '',
                    '-# Example: 3 warns auto-timeout 1h, 5 warns auto-ban'
                ]
            }
        ]
    },

    welcome: {
        title: 'Welcome System',
        description: 'Dashboard · Canvas · Goodbye',
        sections: [
            {
                name: 'Dashboard',
                content: [
                    '### Interactive Setup',
                    '',
                    '> Fully configure your welcome system using the interactive UI dashboard',
                    '',
                    '**Commands**',
                    '┃ `/welcome setup [channel]` — Quick start',
                    '┃ `/welcome config` — Open the dashboard',
                    '┃ `/welcome test` — Send a test message',
                    '',
                    '**Tabs Available**',
                    '╸ **Main** — Channel, Toggles, Test',
                    '╸ **Style** — Templates, Colors, Background',
                    '╸ **Message** — Content, Embeds, Placeholders',
                    '╸ **Features** — Auto-Role, DM, Member Count',
                    '╸ **Goodbye** — Leave messages and channel',
                    '',
                    '-# Use the dashboard to easily configure every feature without memorizing commands'
                ]
            },
            {
                name: 'Canvas Styles',
                content: [
                    '### Premium Templates',
                    '',
                    '> Professionally designed templates for your welcome cards',
                    '',
                    '**Available Themes**',
                    '```',
                    'embed     · obsidian  · aurora',
                    'ocean     · neon      · discord',
                    'midnight  · sunset    · rose',
                    '```',
                    '',
                    '**Customization Options (Style Tab)**',
                    '╸ `Avatar Shape` — Circle, Square, Rounded, Hexagon',
                    '╸ `Custom Background` — Image URL',
                    '╸ `Custom Colors` — Accent & Text colors (Hex)',
                    '╸ `Overlay Opacity` — Adjust dark filter (0.0 - 1.0)',
                    '',
                    '-# All visual changes can be previewed using /welcome test'
                ]
            },
            {
                name: 'System Features',
                content: [
                    '### Automated Systems',
                    '',
                    '> Manage all automatic actions through the Features Tab',
                    '',
                    '**Auto-Role**',
                    '╸ Immediately assigns a role to new members upon joining.',
                    '',
                    '**Goodbye Tracking**',
                    '╸ Send custom goodbye messages when someone leaves.',
                    '╸ Can be routed to a separate channel.',
                    '',
                    '**Direct Messages (DM)**',
                    '╸ Privately welcome users straight to their inbox.',
                    '',
                    '**Cleanup**',
                    '╸ `Delete on Leave` — Deletes their welcome card if they leave.',
                    '',
                    '-# Use the Message Tab to configure {user} or {server} variables'
                ]
            }
        ]
    },

    invites: {
        title: 'Invite Tracker',
        description: 'Tracking · Rewards · Leaderboard',
        sections: [
            {
                name: 'Setup',
                content: [
                    '### Invite Tracking',
                    '',
                    '> Track who invited whom with real, fake, and left counts',
                    '',
                    '**Setup**',
                    '┃ `/invites enable`',
                    '┃ `/invites disable`',
                    '┃ `/invites channel [channel]` — Log channel',
                    '',
                    '**User Info**',
                    '┃ `/invites [user]` — View invite stats',
                    '┃ `/invites leaderboard` — Top inviters',
                    '┃ `/invites codes [user]` — Active invite links',
                    '',
                    '-# Detects fake invites (alt accounts, re-joins)'
                ]
            },
            {
                name: 'Rewards',
                content: [
                    '### Invite Rewards',
                    '',
                    '> Auto-assign roles when users hit invite milestones',
                    '',
                    '┃ `/invites reward add [count] [role]`',
                    '┃ `/invites reward remove [count]`',
                    '┃ `/invites reward list`',
                    '',
                    '**Management**',
                    '┃ `/invites add [user] [amount]` — Manual add',
                    '┃ `/invites remove [user] [amount]`',
                    '┃ `/invites reset [user]` — Reset to 0',
                    '┃ `/invites resetall` — Reset server',
                    '',
                    '-# Rewards stack — user gets all roles they qualify for'
                ]
            }
        ]
    },

    tickets: {
        title: 'Ticket System',
        description: 'SLA · Canned Responses · Performance Tracking',
        sections: [
            {
                name: 'Setup',
                content: [
                    '### Ticket Setup',
                    '',
                    '> Enterprise-grade support with SLA tracking',
                    '',
                    '**Quick Start**',
                    '┃ `/ticket setup` — Guided setup',
                    '',
                    '**Panels**',
                    '┃ `/ticket panel create [title] [type]`',
                    '╸ type: `Button` or `Select Menu`',
                    '╸ Optional: channel, category, role',
                    '┃ `/ticket panel list` — View panels',
                    '┃ `/ticket panel delete [message_id]`',
                    '',
                    '**Select Options** — route tickets by category',
                    '┃ `/ticket option add [panel_id] [label]`',
                    '┃ `/ticket option remove [panel_id] [label]`',
                    '',
                    '-# Each option can route to a different category and staff role'
                ]
            },
            {
                name: 'Settings',
                content: [
                    '### Ticket Settings',
                    '',
                    '┃ `/ticket settings logs [channel]`',
                    '┃ `/ticket settings transcripts [channel]`',
                    '┃ `/ticket settings staff [role]`',
                    '┃ `/ticket settings autoclose [enabled] [hours]`',
                    '┃ `/ticket settings feedback [enabled]`',
                    '┃ `/ticket settings naming [format]`',
                    '┃ `/ticket settings view` — Overview',
                    '',
                    '**Naming Formats**',
                    '╸ `ticket-{number}` — Sequential',
                    '╸ `{username}-{number}` — User based',
                    '╸ `{category}-{number}` — Category based',
                    '',
                    '-# Transcripts generate HTML files for permanent records'
                ]
            },
            {
                name: 'Management',
                content: [
                    '### Ticket Management',
                    '',
                    '> Commands available inside ticket channels',
                    '',
                    '┃ `/ticket claim` — Assign to yourself',
                    '┃ `/ticket unclaim` — Release',
                    '┃ `/ticket close [reason]`',
                    '┃ `/ticket priority [level]`',
                    '┃ `/ticket add [user]` — Add member',
                    '┃ `/ticket remove [user]`',
                    '┃ `/ticket rename [name]`',
                    '┃ `/ticket transfer [user]`',
                    '',
                    '**Overview**',
                    '┃ `/ticket stats` — Statistics',
                    '┃ `/ticket list` — Active tickets',
                    '',
                    '-# Pinned control panel provides button shortcuts'
                ]
            },
            {
                name: 'Canned Responses',
                content: [
                    '### Canned Responses',
                    '',
                    '> Pre-written replies for common ticket situations',
                    '',
                    '┃ `/ticket canned add [name] [content]`',
                    '┃ `/ticket canned remove [name]`',
                    '┃ `/ticket canned list` — View all',
                    '┃ `/ticket canned use [name]` — Send in channel',
                    '',
                    '**Example**',
                    '```',
                    '/ticket canned add name:refund content:Your refund',
                    'has been processed. Please allow 3-5 business days.',
                    '```',
                    '',
                    '-# Great for FAQ answers and standard replies'
                ]
            },
            {
                name: 'Blacklist & Reasons',
                content: [
                    '### Blacklist',
                    '',
                    '┃ `/ticket blacklist add [user]`',
                    '┃ `/ticket blacklist remove [user]`',
                    '┃ `/ticket blacklist list`',
                    '',
                    '### Close Reasons',
                    '',
                    '> Predefined reasons for consistent ticket closure',
                    '',
                    '┃ `/ticket closereason add:[reason]`',
                    '┃ `/ticket closereason remove:[reason]`',
                    '┃ `/ticket closereason stats:True` — Analytics',
                    '┃ `/ticket closereason` — List all',
                    '',
                    '-# Close reason analytics help identify common issues'
                ]
            },
            {
                name: 'SLA & Performance',
                content: [
                    '### SLA Tracking',
                    '',
                    '> Monitor response times and resolution speed',
                    '',
                    '┃ `/ticket sla first_response:[30] resolve:[120]`',
                    '┃ `/ticket sla check:True` — View violations',
                    '┃ `/ticket sla` — View current config',
                    '',
                    '### Staff Performance',
                    '',
                    '┃ `/ticket performance` — Dashboard showing:',
                    '╸ Tickets closed per staff member',
                    '╸ Average resolution time',
                    '╸ Satisfaction rating from feedback',
                    '',
                    '-# SLA times are in minutes · Alerts show breaches'
                ]
            }
        ]
    },

    giveaways: {
        title: 'Giveaway System',
        description: 'Requirements · Bonus Entries · Scheduling',
        sections: [
            {
                name: 'Creating',
                content: [
                    '### Creating Giveaways',
                    '',
                    '**Quick Start**',
                    '┃ `/giveaway start [duration] [winners] [prize]`',
                    '',
                    '**Advanced Options**',
                    '╸ `required_role` — Must have to enter',
                    '╸ `bonus_role` — Extra entries for role',
                    '╸ `bonus_entries` — How many extras (default 1)',
                    '╸ `min_account_age` — Minimum account age (days)',
                    '╸ `min_server_days` — Min time in server',
                    '╸ `blacklist_role` — Block role from entering',
                    '╸ `color` — Custom embed color (hex)',
                    '╸ `description` — Custom description',
                    '',
                    '**Wizard**',
                    '┃ `/giveaway create` — Interactive modal',
                    '',
                    '-# Duration: `10m` `1h` `2d` `1w`'
                ]
            },
            {
                name: 'Special Modes',
                content: [
                    '### Special Modes',
                    '',
                    '**Drop Mode** — First N users to click win',
                    '┃ `/giveaway drop [winners] [prize]`',
                    '',
                    '**Scheduled** — Post now, start later',
                    '┃ `/giveaway schedule [start_in] [duration] [winners] [prize]`',
                    '╸ `start_in` — When to activate (e.g. `2h`)',
                    '╸ Embed shows countdown until go-live',
                    '',
                    '**Pause / Resume** — Freeze the timer',
                    '┃ `/giveaway pause [message_id]`',
                    '┃ `/giveaway resume [message_id]`',
                    '',
                    '-# Pausing preserves remaining time exactly'
                ]
            },
            {
                name: 'Management',
                content: [
                    '### Management',
                    '',
                    '**Control**',
                    '┃ `/giveaway end [message_id]` — End now',
                    '┃ `/giveaway reroll [message_id]` — New winner',
                    '',
                    '**Maintenance**',
                    '┃ `/giveaway list` — All active giveaways',
                    '┃ `/giveaway delete [message_id]` — Force remove',
                    '┃ `/giveaway clean` — Prune ended (>7 days)',
                    '',
                    '-# Giveaways persist across bot restarts'
                ]
            }
        ]
    },

    roles: {
        title: 'Role System',
        description: 'Reaction Roles · Auto Roles',
        sections: [
            {
                name: 'Reaction Roles',
                content: [
                    '### Reaction Roles',
                    '',
                    '> Let users self-assign roles by clicking reactions',
                    '',
                    '**Setup**',
                    '┃ `/reactionrole create [channel] [message]`',
                    '┃ `/reactionrole add [message_id] [emoji] [role]`',
                    '┃ `/reactionrole remove [message_id] [emoji]`',
                    '┃ `/reactionrole list`',
                    '',
                    '**Modes**',
                    '╸ `normal` — Toggle on click',
                    '╸ `unique` — Only one role at a time',
                    '╸ `verify` — Grant role, cannot remove',
                    '',
                    '-# Supports custom and unicode emoji'
                ]
            }
        ]
    },

    voice: {
        title: 'Voice System',
        description: 'Join-to-Create · Temp Channels',
        sections: [
            {
                name: 'Setup',
                content: [
                    '### Join-to-Create',
                    '',
                    '> Dynamic voice channels that create on join, delete when empty',
                    '',
                    '**Setup**',
                    '┃ `/jtc setup` — Create JTC hub',
                    '┃ `/jtc setup channel:[vc] default_name:[pattern]`',
                    '',
                    '**Name Patterns**',
                    '╸ `{user}\'s VC` — "Alex\'s VC"',
                    '╸ `Lounge {user}` — "Lounge Alex"',
                    '',
                    '**How it Works**',
                    '╸ User joins hub — Bot creates private VC',
                    '╸ Bot moves user into it',
                    '╸ Channel deletes when everyone leaves',
                    '',
                    '-# Each channel gets a pinned control panel'
                ]
            },
            {
                name: 'Controls',
                content: [
                    '### Voice Interface',
                    '',
                    '> Control panel appears in each temp channel\'s text chat',
                    '',
                    '**Owner Controls**',
                    '╸ `Lock` — Prevent joins',
                    '╸ `Unlock` — Open channel',
                    '╸ `Hide` — Make invisible',
                    '╸ `Unhide` — Make visible',
                    '╸ `Rename` — Change name',
                    '╸ `Limit` — Set user limit',
                    '╸ `Kick` — Disconnect user',
                    '╸ `Permit` — Allow user (bypass lock)',
                    '',
                    '-# Only channel owner and admins can use controls'
                ]
            }
        ]
    },

    utility: {
        title: 'Utility',
        description: 'AFK · Info · Polls · Embeds',
        sections: [
            {
                name: 'AFK System',
                content: [
                    '### AFK System',
                    '',
                    '> Set an away status with automatic mention handling',
                    '',
                    '┃ `/afk [reason]` — Go AFK',
                    '',
                    '**Automatic Behavior**',
                    '╸ Prefixes nickname with `[AFK]`',
                    '╸ Auto-replies when you are mentioned',
                    '╸ Removes AFK when you send a message',
                    '╸ Shows summary of who pinged you',
                    '',
                    '-# AFK reply shows time elapsed since going away'
                ]
            },
            {
                name: 'Information',
                content: [
                    '### Information',
                    '',
                    '**Bot Info**',
                    '┃ `/botinfo` — System statistics',
                    '╸ Uptime, Memory, Latency, Active systems',
                    '╸ Command counts per category',
                    '',
                    '**Server Info**',
                    '┃ `/serverinfo` — Full server overview',
                    '╸ Members, Channels, Boosts, Roles',
                    '╸ Owner, Creation date, Verification',
                    '',
                    '**User Info**',
                    '┃ `/userinfo [user]` — Detailed profile',
                    '╸ Roles, Permissions, Mod cases',
                    '╸ Join date, Boost status, Banner',
                    '',
                    '-# All info commands work for any user'
                ]
            },
            {
                name: 'Tools',
                content: [
                    '### Polls',
                    '',
                    '> Create timed polls with visual results',
                    '',
                    '┃ `/poll [question] [options] [duration]`',
                    '╸ Comma-separated options (max 10)',
                    '╸ Duration: `10m` `1h` `1d` (default 1h)',
                    '╸ Vote switching — change your vote anytime',
                    '╸ Live bar chart with percentages',
                    '',
                    '### Embed Builder',
                    '',
                    '> Build and send custom embeds via modal',
                    '',
                    '┃ `/embed [channel]` — Opens editor',
                    '╸ Title, Description, Color, Footer, Image',
                    '╸ Supports markdown in description',
                    '',
                    '### Other',
                    '┃ `/editor` — Visual Welcome Card editor',
                    '',
                    '-# Use `/guide` anytime to return to this documentation'
                ]
            }
        ]
    },

    social: {
        title: 'Social Media',
        description: 'Reels · Stalk · Auto-Posting · Media',
        sections: [
            {
                name: 'Instagram Reels',
                content: [
                    '### Instagram Reels',
                    '',
                    '> High-quality Reel sharing with native video uploads',
                    '',
                    '**Usage**',
                    '┃ `/reels post [url] [caption]`',
                    '╸ Resolves video file (no links!)',
                    '╸ Posts to the configured channel',
                    '╸ Custom message template',
                    '',
                    '**Features**',
                    '╸ **Native Upload** — Videos play instantly',
                    '╸ **Smart Fixer** — Handles private/buggy links',
                    '╸ **Mobile Friendly** — No external browser needed',
                    '',
                    '-# Falls back to embed if video > 50MB (Niger/Boosted)'
                ]
            },
            {
                name: 'Instagram Stalk',
                content: [
                    '### Instagram Stalk',
                    '',
                    '> Look up any Instagram profile without leaving Discord',
                    '',
                    '**Usage**',
                    '┃ `/stalk [username]`',
                    '╸ Accepts `@username`, plain username, or full URL',
                    '',
                    '**What You See**',
                    '╸ **Profile** — Bio, PFP, external link',
                    '╸ **Stats** — Followers, Following, Posts',
                    '╸ **Engagement Rate** — Calculated from recent posts',
                    '╸ **F/F Ratio** — Follower vs Following analysis',
                    '╸ **Recent Posts** — Last 6 posts with likes & comments',
                    '',
                    '**Tier Badges**',
                    '╸ Celebrity (10M+)',
                    '╸ Mega Influencer (1M+)',
                    '╸ Macro Influencer (100K+)',
                    '╸ Micro Influencer (10K+)',
                    '╸ Rising Creator (1K+)',
                    '╸ Growing Account',
                    '',
                    '-# Includes clickable buttons for Profile & PFP'
                ]
            },
            {
                name: 'Configuration',
                content: [
                    '### Setup & Config',
                    '',
                    '**Required Setup**',
                    '┃ `/reels setup channel [target]` — Where to post',
                    '',
                    '**Customization**',
                    '┃ `/reels setup template [format]`',
                    '╸ Variables: `{caption}`, `{url}`, `{user}`, `{author}`',
                    '┃ `/reels setup ping [role]`',
                    '╸ Pings this role when a new reel is posted',
                    '',
                    '**Example Template**',
                    '```',
                    'New Drop!',
                    '{caption}',
                    'Posted by {user}',
                    '```'
                ]
            },
            {
                name: 'Permissions',
                content: [
                    '### Role Permissions',
                    '',
                    '> Control exactly who can post reels to your server',
                    '',
                    '**Publisher Roles**',
                    'By default, only **Administrators** can post.',
                    'You can grant access to specific roles (e.g. Content Team).',
                    '',
                    '**Commands**',
                    '┃ `/reels setup role [role]`',
                    '╸ Toggles permission for that role',
                    '',
                    '**Logic**',
                    '╸ If NO roles are set → Admins only',
                    '╸ If roles ARE set → Admins + Users with that role',
                    '',
                    '-# Keeps your feed safe from unauthorized posts'
                ]
            }
        ]
    }
};

// ═══════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════
const CATEGORIES = [
    { id: 'home', label: 'Home', description: 'Overview of all systems' },
    { id: 'security', label: 'Security', description: 'Anti-Nuke, Anti-Raid, Backups' },
    { id: 'automod', label: 'AutoMod', description: 'Spam, Links, Filters' },
    { id: 'moderation', label: 'Moderation', description: 'Escalation, Decay, History' },
    { id: 'welcome', label: 'Welcome', description: 'Canvas Cards, Goodbye' },
    { id: 'invites', label: 'Invites', description: 'Tracking, Rewards' },
    { id: 'tickets', label: 'Tickets', description: 'SLA, Canned, Performance' },
    { id: 'giveaways', label: 'Giveaways', description: 'Requirements, Drops' },
    { id: 'roles', label: 'Roles', description: 'Reaction Roles' },
    { id: 'voice', label: 'Voice', description: 'Join-to-Create' },
    { id: 'utility', label: 'Utility', description: 'AFK, Info, Polls, Embeds' },
    { id: 'social', label: 'Social', description: 'Reels, Media' }
];

// ═══════════════════════════════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════════════════════════════
module.exports = {
    data: new SlashCommandBuilder()
        .setName('guide')
        .setDescription('Interactive documentation for all Vorn systems')
        .addStringOption(opt =>
            opt.setName('section')
                .setDescription('Jump to a specific section')
                .addChoices(
                    ...CATEGORIES.map(c => ({ name: c.label, value: c.id }))
                )
        ),

    async execute(interaction, client) {
        const initialSection = interaction.options.getString('section') || 'home';

        let currentCategory = initialSection;
        let currentPage = 0;

        const buildEmbed = () => {
            const data = GUIDE_DATA[currentCategory];
            const section = data.sections[currentPage];
            const totalPages = data.sections.length;

            const embed = VornEmbed.create()
                .setTitle(data.title)
                .setDescription(section.content.join('\n'))
                .setFooter({
                    text: `${section.name}  ·  Page ${currentPage + 1}/${totalPages}  ·  /guide`
                });

            if (data.description && currentPage === 0) {
                embed.setDescription([
                    `-# ${data.description}`,
                    '',
                    ...section.content
                ].join('\n'));
            }

            return embed;
        };

        const buildComponents = () => {
            const data = GUIDE_DATA[currentCategory];
            const totalPages = data.sections.length;
            const rows = [];

            // Pagination
            const paginationRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('guide_first')
                    .setLabel('<<')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId('guide_prev')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId('guide_page')
                    .setLabel(`${currentPage + 1} / ${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('guide_next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage >= totalPages - 1),
                new ButtonBuilder()
                    .setCustomId('guide_last')
                    .setLabel('>>')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage >= totalPages - 1)
            );
            rows.push(paginationRow);

            // Nav row 1 (first 5)
            const quickNavRow = new ActionRowBuilder().addComponents(
                ...CATEGORIES.slice(0, 5).map(cat =>
                    new ButtonBuilder()
                        .setCustomId(`guide_cat_${cat.id}`)
                        .setLabel(cat.label)
                        .setStyle(currentCategory === cat.id ? ButtonStyle.Success : ButtonStyle.Secondary)
                )
            );
            rows.push(quickNavRow);

            // Nav row 2+ (remaining, max 5 per row)
            const remaining = CATEGORIES.slice(5);
            for (let i = 0; i < remaining.length; i += 5) {
                const chunk = remaining.slice(i, i + 5);
                const moreNavRow = new ActionRowBuilder().addComponents(
                    ...chunk.map(cat =>
                        new ButtonBuilder()
                            .setCustomId(`guide_cat_${cat.id}`)
                            .setLabel(cat.label)
                            .setStyle(currentCategory === cat.id ? ButtonStyle.Success : ButtonStyle.Secondary)
                    )
                );
                rows.push(moreNavRow);
            }

            // Section select (if multiple pages)
            if (data.sections.length > 1) {
                const sectionSelect = new StringSelectMenuBuilder()
                    .setCustomId('guide_section')
                    .setPlaceholder('Jump to section...')
                    .addOptions(
                        data.sections.map((section, index) => ({
                            label: section.name,
                            value: index.toString(),
                            default: index === currentPage,
                            description: `Page ${index + 1}`
                        }))
                    );
                rows.push(new ActionRowBuilder().addComponents(sectionSelect));
            }

            return rows;
        };

        // Build payload with optional banner
        const buildPayload = async () => {
            const payload = {
                embeds: [buildEmbed()],
                components: buildComponents(),
                files: []
            };

            try {
                const banner = await GuideRenderer.getBanner(currentCategory);
                if (banner) {
                    const attachment = new AttachmentBuilder(banner, { name: 'banner.png' });
                    payload.files = [attachment];
                    payload.embeds[0].setImage('attachment://banner.png');
                }
            } catch (e) {
                // Canvas unavailable, continue without banner
            }

            return payload;
        };

        // Send
        const initialPayload = await buildPayload();
        await interaction.reply(initialPayload);
        const response = await interaction.fetchReply();

        // Collector
        const collector = response.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            time: 300_000
        });

        collector.on('collect', async (i) => {
            // Acknowledge the interaction instantly to prevent 3-second timeouts
            await i.deferUpdate().catch(() => {});

            if (i.customId.startsWith('guide_cat_')) {
                const newCat = i.customId.replace('guide_cat_', '');
                if (GUIDE_DATA[newCat]) {
                    currentCategory = newCat;
                    currentPage = 0;
                }
            }
            else if (i.customId === 'guide_first') currentPage = 0;
            else if (i.customId === 'guide_prev') currentPage = Math.max(0, currentPage - 1);
            else if (i.customId === 'guide_next') currentPage = Math.min(GUIDE_DATA[currentCategory].sections.length - 1, currentPage + 1);
            else if (i.customId === 'guide_last') currentPage = GUIDE_DATA[currentCategory].sections.length - 1;
            else if (i.customId === 'guide_section') {
                currentPage = parseInt(i.values[0]) || 0;
            }

            const updatedPayload = await buildPayload();
            // Since we deferred the update, we must use editReply instead
            await i.editReply(updatedPayload).catch(() => {});
        });

        collector.on('end', async () => {
            try {
                await response.edit({ components: [] });
            } catch { }
        });
    }
};
