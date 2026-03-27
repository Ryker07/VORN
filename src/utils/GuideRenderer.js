/**
 * Vorn — Guide Banner Renderer
 * Generates premium section banners for the /guide command
 * Uses @napi-rs/canvas — color-matched to Vorn embed (#2b2d31)
 */

let Canvas;
try {
    Canvas = require('@napi-rs/canvas');
} catch {
    Canvas = null;
}

// ═══════════════════════════════════════════════════════════════
// PALETTE — Matches Vorn's embed color (#2b2d31)
// ═══════════════════════════════════════════════════════════════
const BRAND = {
    bg: '#1a1b1e',
    card: '#2b2d31',
    accent: '#4a4d55',
    text: '#ffffff',
    subtext: '#8b8d94',
    line: '#35373d',
};

// Section metadata
const SECTIONS = {
    home: { title: 'VORN', subtitle: 'DOCUMENTATION' },
    security: { title: 'SECURITY', subtitle: 'ANTI-NUKE  ·  ANTI-RAID  ·  BACKUPS' },
    automod: { title: 'AUTOMOD', subtitle: 'SPAM  ·  LINKS  ·  CONTENT FILTERING' },
    moderation: { title: 'MODERATION', subtitle: 'ESCALATION  ·  DECAY  ·  HISTORY' },
    welcome: { title: 'WELCOME', subtitle: 'CANVAS CARDS  ·  GOODBYE  ·  AUTO-ROLE' },
    invites: { title: 'INVITES', subtitle: 'TRACKING  ·  REWARDS  ·  LEADERBOARD' },
    tickets: { title: 'TICKETS', subtitle: 'SLA  ·  CANNED  ·  PERFORMANCE' },
    giveaways: { title: 'GIVEAWAYS', subtitle: 'REQUIREMENTS  ·  DROPS  ·  SCHEDULE' },
    roles: { title: 'ROLES', subtitle: 'REACTION ROLES  ·  AUTO ROLES' },
    voice: { title: 'VOICE', subtitle: 'JOIN-TO-CREATE  ·  TEMP CHANNELS' },
    utility: { title: 'UTILITY', subtitle: 'AFK  ·  INFO  ·  TOOLS' },
    social: { title: 'SOCIAL', subtitle: 'REELS  ·  UPDATES  ·  MEDIA' },
};

// Cache generated buffers
const cache = new Map();

class GuideRenderer {
    static isAvailable() {
        return Canvas !== null;
    }

    /**
     * Get or generate a section banner
     * @param {string} sectionId
     * @returns {Buffer|null}
     */
    static async getBanner(sectionId) {
        if (!this.isAvailable()) return null;
        if (cache.has(sectionId)) return cache.get(sectionId);

        const section = SECTIONS[sectionId];
        if (!section) return null;

        const buffer = await this.render(section.title, section.subtitle);
        cache.set(sectionId, buffer);
        return buffer;
    }

    /**
     * Render a premium banner
     */
    static async render(title, subtitle) {
        const width = 900;
        const height = 200;
        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background — matches embed
        ctx.fillStyle = BRAND.bg;
        ctx.fillRect(0, 0, width, height);

        // Subtle noise texture
        ctx.globalAlpha = 0.015;
        for (let x = 0; x < width; x += 3) {
            for (let y = 0; y < height; y += 3) {
                if (Math.random() > 0.5) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        ctx.globalAlpha = 1.0;

        // Left accent bar
        ctx.fillStyle = BRAND.accent;
        ctx.fillRect(50, 40, 2, height - 80);

        // Title
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '700 52px Arial';
        ctx.fillStyle = BRAND.text;
        ctx.letterSpacing = '6px';
        ctx.fillText(title, 76, 105);
        ctx.letterSpacing = '0px';

        // Line under title
        const titleWidth = ctx.measureText(title).width;
        ctx.fillStyle = BRAND.line;
        ctx.fillRect(76, 115, Math.min(titleWidth + 30, 450), 1);

        // Subtitle
        ctx.font = '400 15px Arial';
        ctx.fillStyle = BRAND.subtext;
        ctx.letterSpacing = '3px';
        ctx.fillText(subtitle, 76, 145);
        ctx.letterSpacing = '0px';

        // Bottom border
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, BRAND.accent);
        grad.addColorStop(0.6, 'rgba(74, 77, 85, 0.2)');
        grad.addColorStop(1, 'rgba(74, 77, 85, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, height - 1, width, 1);

        return canvas.toBuffer('image/png');
    }

    static clearCache() {
        cache.clear();
    }
}

module.exports = GuideRenderer;
