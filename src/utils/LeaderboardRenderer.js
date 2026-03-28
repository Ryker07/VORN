/**
 * Vorn — Leaderboard Canvas Renderer
 * Obsidian-themed invite leaderboard card
 * Uses @napi-rs/canvas
 */

let Canvas;
try {
    Canvas = require('@napi-rs/canvas');
} catch {
    Canvas = null;
}

const THEME = {
    bg: '#09090b',
    card: '#18181b',
    accent: '#ffffff',
    text: '#fafafa',
    subtext: '#71717a',
    muted: '#52525b',
    border: '#27272a',
    gold: '#fbbf24',
    silver: '#94a3b8',
    bronze: '#d97706',
};

class LeaderboardRenderer {
    static isAvailable() {
        return Canvas !== null;
    }

    /**
     * Render the invite leaderboard as a canvas image
     * @param {Array} entries - [{ userId, username, total, avatarUrl }]
     * @param {Object} meta - { page, totalPages, guildName }
     * @returns {Buffer}
     */
    static async render(entries, meta) {
        if (!this.isAvailable()) return null;

        const rowHeight = 64;
        const headerHeight = 100;
        const footerHeight = 48;
        const padding = 32;
        const width = 800;
        const height = headerHeight + (entries.length * rowHeight) + footerHeight + padding;

        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // ── Background ──
        ctx.fillStyle = THEME.bg;
        ctx.fillRect(0, 0, width, height);

        // Subtle vignette
        const vig = ctx.createRadialGradient(width / 2, height / 2, height / 4, width / 2, height / 2, width);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, width, height);

        // ── Header ──
        ctx.font = '700 28px Arial';
        ctx.fillStyle = THEME.text;
        ctx.textAlign = 'left';
        ctx.fillText('INVITE LEADERBOARD', padding, 48);

        ctx.font = '400 16px Arial';
        ctx.fillStyle = THEME.subtext;
        ctx.fillText(meta.guildName || '', padding, 72);

        // Separator
        ctx.strokeStyle = THEME.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, headerHeight - 8);
        ctx.lineTo(width - padding, headerHeight - 8);
        ctx.stroke();

        // ── Pre-load all avatars in parallel ──
        const avatarImages = await Promise.all(
            entries.map(async (entry) => {
                if (!entry.avatarUrl) return null;
                try {
                    return await Canvas.loadImage(entry.avatarUrl);
                } catch {
                    return null;
                }
            })
        );

        // ── Rows ──
        const rankColors = { 1: THEME.gold, 2: THEME.silver, 3: THEME.bronze };

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const y = headerHeight + (i * rowHeight);
            const rank = ((meta.page - 1) * 10) + i + 1;

            // Alternating row bg
            if (i % 2 === 0) {
                ctx.fillStyle = THEME.card;
                this.roundedRect(ctx, padding - 8, y + 2, width - (padding * 2) + 16, rowHeight - 4, 10);
                ctx.fill();
            }

            // Rank number
            ctx.font = '700 20px Arial';
            ctx.fillStyle = rankColors[rank] || THEME.muted;
            ctx.textAlign = 'right';
            ctx.fillText(`${String(rank).padStart(2, '0')}`, padding + 38, y + rowHeight / 2 + 7);

            // Avatar
            const avatarX = padding + 52;
            const avatarY = y + (rowHeight / 2);
            const avatarRadius = 18;
            const avatarImg = avatarImages[i];

            if (avatarImg) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX + avatarRadius, avatarY, avatarRadius, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatarImg, avatarX, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
                ctx.restore();
            } else {
                // Placeholder circle
                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX + avatarRadius, avatarY, avatarRadius, 0, Math.PI * 2);
                ctx.fillStyle = rankColors[rank] || THEME.border;
                ctx.globalAlpha = 0.3;
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.font = '700 16px Arial';
                ctx.fillStyle = THEME.subtext;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(rank), avatarX + avatarRadius, avatarY);
                ctx.restore();
            }

            // Username
            ctx.font = '600 18px Arial';
            ctx.fillStyle = THEME.text;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            const displayName = entry.username.length > 20
                ? entry.username.substring(0, 18) + '..'
                : entry.username;
            ctx.fillText(displayName, avatarX + avatarRadius * 2 + 16, y + rowHeight / 2 + 6);

            // Invite count
            ctx.font = '700 20px Arial';
            ctx.fillStyle = rankColors[rank] || THEME.accent;
            ctx.textAlign = 'right';
            ctx.fillText(`${entry.total}`, width - padding - 80, y + rowHeight / 2 + 6);

            // "joins" label
            ctx.font = '400 14px Arial';
            ctx.fillStyle = THEME.muted;
            ctx.fillText('joins', width - padding - 8, y + rowHeight / 2 + 6);
        }

        // ── Footer ──
        const footerY = headerHeight + (entries.length * rowHeight) + 16;

        ctx.strokeStyle = THEME.border;
        ctx.beginPath();
        ctx.moveTo(padding, footerY);
        ctx.lineTo(width - padding, footerY);
        ctx.stroke();

        ctx.font = '400 14px Arial';
        ctx.fillStyle = THEME.muted;
        ctx.textAlign = 'center';
        ctx.fillText(`Page ${meta.page} of ${meta.totalPages}`, width / 2, footerY + 28);

        return canvas.toBuffer('image/png');
    }

    /**
     * Draw rounded rectangle (compatible fallback)
     */
    static roundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}

module.exports = LeaderboardRenderer;
