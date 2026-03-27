/**
 * Vorn — Canvas Welcome Banner Generator
 * Ultra-premium aesthetic welcome cards with modern design language
 */

let Canvas;
try {
    Canvas = require('@napi-rs/canvas');
} catch {
    Canvas = null;
}

class CanvasWelcome {
    /**
     * Premium template configurations
     */
    static templates = {
        // --- TIER 1: MINIMALIST ---
        obsidian: {
            bgType: 'solid',
            colors: ['#09090b'],
            accent: '#ffffff',
            text: '#fafafa',
            subtext: '#a1a1aa',
            style: 'minimal',
            overlay: 'none'
        },
        snow: {
            bgType: 'solid',
            colors: ['#ffffff'],
            accent: '#000000',
            text: '#18181b',
            subtext: '#52525b',
            style: 'minimal',
            overlay: 'none'
        },

        // --- TIER 2: GRADIENTS ---
        aurora: {
            bgType: 'gradient',
            angle: 135,
            colors: ['#2e1065', '#7c3aed', '#db2777'],
            accent: '#ffffff',
            text: '#ffffff',
            subtext: '#e9d5ff',
            style: 'glass',
            overlay: 'glass'
        },
        ocean: {
            bgType: 'gradient',
            angle: 45,
            colors: ['#0f172a', '#0ea5e9', '#22d3ee'],
            accent: '#ffffff',
            text: '#ffffff',
            subtext: '#bae6fd',
            style: 'glass',
            overlay: 'glass'
        },
        sunset: {
            bgType: 'gradient',
            angle: 90,
            colors: ['#4c0519', '#e11d48', '#fbbf24'],
            accent: '#ffffff',
            text: '#ffffff',
            subtext: '#fecdd3',
            style: 'glass',
            overlay: 'dark'
        },
        midnight: {
            bgType: 'gradient',
            angle: 180,
            colors: ['#020617', '#1e1b4b', '#312e81'],
            accent: '#818cf8',
            text: '#ffffff',
            subtext: '#c7d2fe',
            style: 'modern',
            overlay: 'none'
        },
        rose: {
            bgType: 'gradient',
            angle: 135,
            colors: ['#831843', '#be185d', '#f472b6'], // Proper Pink Gradient
            accent: '#fbcfe8',
            text: '#ffffff',
            subtext: '#fce7f3',
            style: 'glass',
            overlay: 'glass'
        },

        // --- TIER 3: TEXTURES/SPECIAL ---
        neon: {
            bgType: 'solid',
            colors: ['#000000'],
            accent: '#00ff9d',
            text: '#ffffff',
            subtext: '#a1a1aa',
            style: 'cyber',
            overlay: 'grid'
        },
        discord: {
            bgType: 'solid',
            colors: ['#2b2d31'],
            accent: '#5865F2',
            text: '#ffffff',
            subtext: '#949ba4',
            style: 'discord',
            overlay: 'none'
        }
    };

    static isAvailable() {
        return Canvas !== null;
    }

    /**
     * Generate welcome banner
     */
    static async generate(member, config) {
        if (!this.isAvailable()) throw new Error('Canvas module not available.');

        // Canvas Settings
        const width = 1000;
        const height = 400; // Taller for better composition
        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Config & Defaults
        const themeKey = config.template || 'obsidian';
        const template = this.templates[themeKey] || this.templates.obsidian;

        // Allow user overrides
        const theme = {
            ...template,
            accent: config.accentColor || template.accent,
            text: config.textColor || template.text,
            bgImage: config.background || null
        };

        // 1. Background Layer
        await this.renderBackground(ctx, width, height, theme);

        // 2. Overlay Effects (Noise, Grid, Vignette)
        this.renderOverlays(ctx, width, height, theme, config);

        // 3. Layout Composition
        // We use a modern "card within a card" or "split" layout depending on style
        if (theme.style === 'glass') {
            this.renderGlassLayout(ctx, width, height, theme);
        } else if (theme.style === 'cyber') {
            this.renderCyberLayout(ctx, width, height, theme);
        } else if (theme.style === 'luxury') {
            this.renderLuxuryLayout(ctx, width, height, theme);
        }

        // 4. Avatar
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 512 });
        await this.renderAvatar(ctx, width, height, avatarUrl, theme, config.avatarStyle || 'circle');

        // 5. Typography
        this.renderTypography(ctx, width, height, member, theme);

        // 6. Member Count Badge
        if (config.showMemberCount !== false) {
            this.renderBadge(ctx, width, height, member, theme);
        }

        return canvas.toBuffer('image/png');
    }

    // --- RENDERERS ---

    static async renderBackground(ctx, width, height, theme) {
        // Custom Image
        if (theme.bgImage && theme.bgImage.startsWith('http')) {
            try {
                const img = await Canvas.loadImage(theme.bgImage);
                // Object-cover sizing
                const ratio = Math.max(width / img.width, height / img.height);
                const centerShift_x = (width - img.width * ratio) / 2;
                const centerShift_y = (height - img.height * ratio) / 2;

                ctx.drawImage(img, 0, 0, img.width, img.height, centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);

                // Darken bg for readability
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, 0, width, height);
                return;
            } catch (e) {
                // Fallback to theme colors if image fails
            }
        }

        // Gradient Background
        if (theme.bgType === 'gradient') {
            // Convert angle to coords
            const angleRad = (theme.angle * Math.PI) / 180;
            const x2 = width * Math.abs(Math.cos(angleRad));
            const y2 = height * Math.abs(Math.sin(angleRad));

            const grad = ctx.createLinearGradient(0, 0, x2, y2);
            theme.colors.forEach((color, i) => {
                grad.addColorStop(i / (theme.colors.length - 1), color);
            });
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }
        // Solid Background
        else {
            ctx.fillStyle = theme.colors[0];
            ctx.fillRect(0, 0, width, height);
        }
    }

    static renderOverlays(ctx, width, height, theme, config) {
        // Vignette (Standard on most themes for focus)
        const grad = ctx.createRadialGradient(width/2, height/2, height/3, width/2, height/2, width);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Noise Grain
        if (theme.overlay === 'noise' || theme.style === 'luxury') {
            ctx.globalAlpha = 0.05;
            for (let i = 0; i < width; i += 2) {
                for (let j = 0; j < height; j += 2) {
                    if (Math.random() > 0.5) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(i, j, 1, 1);
                    }
                }
            }
            ctx.globalAlpha = 1.0;
        }

        // Grid (Cyber/Neon)
        if (theme.overlay === 'grid' || config.scanlines) {
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            const size = 40;

            for (let x = 0; x <= width; x += size) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
            }
            for (let y = 0; y <= height; y += size) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
            }
        }
    }

    static renderGlassLayout(ctx, width, height, theme) {
        const padding = 40;
        const cardX = padding;
        const cardY = height - 140;
        const cardW = width - (padding * 2);
        const cardH = 100;

        ctx.save();
        // Glass effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 20;

        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 20);
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    static renderCyberLayout(ctx, width, height, theme) {
        ctx.save();
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 2;
        ctx.shadowColor = theme.accent;
        ctx.shadowBlur = 15;

        // Top line
        ctx.beginPath();
        ctx.moveTo(50, 50);
        ctx.lineTo(width - 50, 50);
        ctx.lineTo(width - 30, 70); // Corner cut
        ctx.stroke();

        // Bottom line
        ctx.beginPath();
        ctx.moveTo(30, height - 70);
        ctx.lineTo(50, height - 50); // Corner cut
        ctx.lineTo(width - 50, height - 50);
        ctx.stroke();

        ctx.restore();
    }

    static renderLuxuryLayout(ctx, width, height, theme) {
        ctx.save();
        // Gold border frame
        const margin = 20;
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;

        ctx.strokeRect(margin, margin, width - (margin*2), height - (margin*2));

        // Ornate corners
        ctx.fillStyle = theme.accent;
        ctx.globalAlpha = 1;
        const size = 6;

        // 4 dots at corners
        ctx.fillRect(margin - 2, margin - 2, size, size);
        ctx.fillRect(width - margin - 4, margin - 2, size, size);
        ctx.fillRect(margin - 2, height - margin - 4, size, size);
        ctx.fillRect(width - margin - 4, height - margin - 4, size, size);

        ctx.restore();
    }

    static async renderAvatar(ctx, width, height, url, theme, shape) {
        const size = 200;
        const x = 100;
        const y = (height - size) / 2;

        try {
            const avatar = await Canvas.loadImage(url);

            ctx.save();
            ctx.beginPath();

            // Shapes
            if (shape === 'square') {
                ctx.rect(x, y, size, size);
            } else if (shape === 'rounded') {
                ctx.roundRect(x, y, size, size, 30);
            } else if (shape === 'hexagon') {
                this.drawHexagon(ctx, x + size/2, y + size/2, size/2);
            } else {
                // Circle default
                ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
            }

            // Glow/Shadow
            ctx.shadowColor = theme.accent; // Glow matches theme accent
            ctx.shadowBlur = theme.style === 'cyber' || theme.style === 'glass' ? 30 : 15;

            // Clip & Draw
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, x, y, size, size);
            ctx.restore();

            // Border (Stroke)
            ctx.save();
            ctx.lineWidth = 6;
            ctx.strokeStyle = theme.accent; // Accent border

            ctx.beginPath();
            if (shape === 'square') {
                ctx.rect(x, y, size, size);
            } else if (shape === 'rounded') {
                ctx.roundRect(x, y, size, size, 30);
            } else if (shape === 'hexagon') {
                this.drawHexagon(ctx, x + size/2, y + size/2, size/2);
            } else {
                ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
            }
            ctx.stroke();
            ctx.restore();

        } catch (e) {
            // Placeholder if failed
            ctx.fillStyle = theme.accent;
            ctx.beginPath();
            ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    static renderTypography(ctx, width, height, member, theme) {
        const startX = 350; // Right of avatar
        const centerY = height / 2;

        ctx.textAlign = 'left';

        // 1. "WELCOME" Label
        ctx.font = '700 30px Arial'; // Increased weight
        ctx.fillStyle = theme.accent;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText('WELCOME', startX, centerY - 40);

        // 2. Username
        // Auto-scale text to fit
        let fontSize = 80;
        ctx.font = `800 ${fontSize}px Arial`;
        const name = member.user.username;
        const maxNameWidth = width - startX - 50;

        while (ctx.measureText(name).width > maxNameWidth && fontSize > 40) {
            fontSize -= 5;
            ctx.font = `800 ${fontSize}px Arial`;
        }

        ctx.fillStyle = theme.text;
        ctx.fillText(name, startX, centerY + 40);

        // 3. Server Name / Footer
        ctx.font = '500 24px Arial';
        ctx.fillStyle = theme.subtext;
        ctx.shadowBlur = 0;
        ctx.fillText(`to ${member.guild.name}`, startX, centerY + 85);
    }

    static renderBadge(ctx, width, height, member, theme) {
        const text = `#${member.guild.memberCount}`;
        ctx.font = '700 24px Arial';
        const metrics = ctx.measureText(text);
        const paddingX = 20;
        const paddingY = 10;
        const bgW = metrics.width + (paddingX * 2);
        const bgH = 44;

        const x = width - bgW - 40;
        const y = 40;

        ctx.save();

        // Badge BG
        if (theme.style === 'cyber') {
            ctx.strokeStyle = theme.accent;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, bgW, bgH);
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(x, y, bgW, bgH);
        } else {
            ctx.fillStyle = theme.accent; // Accent colored badge
            ctx.beginPath();
            ctx.roundRect(x, y, bgW, bgH, 22);
            ctx.fill();
        }

        // Text
        ctx.fillStyle = theme.style === 'cyber' ? theme.accent : (theme.bgType === 'solid' && theme.colors[0] === '#ffffff' ? '#ffffff' : '#000000');
        // If accent is dark, make text light, crude check:
        if (theme.accent === '#ffffff') ctx.fillStyle = '#000000';
        else if (theme.accent === '#000000') ctx.fillStyle = '#ffffff';
        else ctx.fillStyle = '#ffffff'; // Default white text on colored accent

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + bgW/2, y + bgH/2);

        ctx.restore();
    }

    // Helper: Draw Hexagon path
    static drawHexagon(ctx, x, y, r) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            ctx.lineTo(x + r * Math.cos(i * Math.PI / 3), y + r * Math.sin(i * Math.PI / 3));
        }
        ctx.closePath();
    }
}

module.exports = CanvasWelcome;
