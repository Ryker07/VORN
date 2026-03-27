/**
 * Vorn — Advanced Layer-Based Rendering Engine
 * Photoshop-like canvas system for Discord welcome cards
 */

const { AttachmentBuilder } = require('discord.js');
let Canvas;
try {
    Canvas = require('@napi-rs/canvas');
} catch {
    Canvas = null;
}

class WelcomeRenderer {
    static isAvailable() {
        return Canvas !== null;
    }

    /**
     * Render a card based on a schema
     * @param {GuildMember} member - The member who joined
     * @param {Object} schema - Layer schema configuration
     * @returns {Promise<Buffer>}
     */
    static async render(member, schema) {
        if (!this.isAvailable()) throw new Error('Canvas not installed');

        // Sanitize Dimensions
        const width = Math.min(Math.max(schema.width || 900, 100), 2000);
        const height = Math.min(Math.max(schema.height || 320, 100), 2000);

        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Sort layers by z-index
        const layers = (schema.layers || []).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        for (const layer of layers) {
            if (layer.hidden) continue;

            ctx.save();

            // Layer opacity
            if (typeof layer.opacity === 'number' && layer.opacity >= 0 && layer.opacity <= 1) {
                ctx.globalAlpha = layer.opacity;
            }

            // Layer shadow
            if (layer.shadow) {
                ctx.shadowColor = layer.shadow.color || 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = Math.min(layer.shadow.blur || 0, 100);
                ctx.shadowOffsetX = Math.min(Math.max(layer.shadow.x || 0, -100), 100);
                ctx.shadowOffsetY = Math.min(Math.max(layer.shadow.y || 0, -100), 100);
            }

            try {
                switch (layer.type) {
                    case 'background':
                        await this.renderBackground(ctx, layer, width, height);
                        break;
                    case 'gradient':
                        this.renderGradient(ctx, layer, width, height);
                        break;
                    case 'shape':
                        this.renderShape(ctx, layer);
                        break;
                    case 'text':
                        this.renderText(ctx, layer, member);
                        break;
                    case 'avatar':
                        await this.renderAvatar(ctx, layer, member);
                        break;
                    case 'image':
                        await this.renderImage(ctx, layer);
                        break;
                    case 'decoration':
                        this.renderDecoration(ctx, layer, width, height);
                        break;
                }
            } catch (e) {
                console.error(`[Vorn Renderer] Layer ${layer.type} failed:`, e.message);
            }

            ctx.restore();
        }

        return canvas.toBuffer('image/png');
    }

    /**
     * Secure URL validator
     */
    static isValidUrl(url) {
        if (!url || typeof url !== 'string') return false;
        try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
            return false;
        }
    }

    /**
     * Render background layer
     */
    static async renderBackground(ctx, layer, width, height) {
        // Solid or gradient color
        if (layer.color) {
            if (layer.gradient) {
                const grad = this.createGradient(ctx, layer.gradient, width, height);
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = layer.color;
            }
            ctx.fillRect(0, 0, width, height);
        }

        // Background image
        if (layer.image && this.isValidUrl(layer.image)) {
            try {
                const img = await Canvas.loadImage(layer.image);
                const scale = Math.max(width / img.width, height / img.height);
                const x = (width - img.width * scale) / 2;
                const y = (height - img.height * scale) / 2;
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

                // Apply overlay
                if (layer.overlay) {
                    ctx.fillStyle = layer.overlay.color || 'rgba(0,0,0,0.5)';
                    ctx.fillRect(0, 0, width, height);
                }
            } catch {
                // Ignore bad image load
            }
        }

        // Apply vignette effect
        if (layer.vignette !== false) {
            const vignette = ctx.createRadialGradient(
                width / 2, height / 2, height * 0.3,
                width / 2, height / 2, width * 0.7
            );
            vignette.addColorStop(0, 'rgba(0,0,0,0)');
            vignette.addColorStop(1, `rgba(0,0,0,${layer.vignetteStrength || 0.3})`);
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, width, height);
        }

        // Noise texture
        if (layer.noise) {
            ctx.save();
            ctx.globalAlpha = layer.noise.opacity || 0.02;
            for (let i = 0; i < 800; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
                ctx.fillRect(x, y, 1, 1);
            }
            ctx.restore();
        }
    }

    /**
     * Create gradient from config
     */
    static createGradient(ctx, config, width, height) {
        const type = config.type || 'linear';
        let grad;

        if (type === 'radial') {
            grad = ctx.createRadialGradient(
                config.x1 || width / 2, config.y1 || height / 2, config.r1 || 0,
                config.x2 || width / 2, config.y2 || height / 2, config.r2 || Math.max(width, height)
            );
        } else {
            // Linear gradient
            const angle = (config.angle || 0) * Math.PI / 180;
            const x1 = width / 2 - Math.cos(angle) * width;
            const y1 = height / 2 - Math.sin(angle) * height;
            const x2 = width / 2 + Math.cos(angle) * width;
            const y2 = height / 2 + Math.sin(angle) * height;
            grad = ctx.createLinearGradient(x1, y1, x2, y2);
        }

        (config.stops || []).forEach(stop => {
            if (stop.color && typeof stop.offset === 'number') {
                grad.addColorStop(Math.min(Math.max(stop.offset, 0), 1), stop.color);
            }
        });

        return grad;
    }

    /**
     * Render gradient layer
     */
    static renderGradient(ctx, layer, width, height) {
        const grad = this.createGradient(ctx, layer, width, height);
        ctx.fillStyle = grad;
        ctx.fillRect(layer.x || 0, layer.y || 0, layer.width || width, layer.height || height);
    }

    /**
     * Render shape layer
     */
    static renderShape(ctx, layer) {
        ctx.fillStyle = layer.color || 'white';

        if (layer.stroke) {
            ctx.strokeStyle = layer.stroke.color || 'black';
            ctx.lineWidth = Math.min(layer.stroke.width || 1, 50);
        }

        const x = layer.x || 0;
        const y = layer.y || 0;
        const w = Math.max(layer.width || 10, 0);
        const h = Math.max(layer.height || 10, 0);
        const r = Math.min(Math.max(layer.radius || 0, 0), w / 2, h / 2);

        ctx.beginPath();

        if (layer.shape === 'rect' || layer.shape === 'rectangle') {
            if (r > 0) {
                ctx.roundRect(x, y, w, h, r);
            } else {
                ctx.rect(x, y, w, h);
            }
        } else if (layer.shape === 'circle') {
            const radius = w / 2;
            ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
        } else if (layer.shape === 'ellipse') {
            ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        } else if (layer.shape === 'line') {
            ctx.moveTo(x, y);
            ctx.lineTo(layer.x2 || x + w, layer.y2 || y);
            ctx.stroke();
            return;
        }

        ctx.fill();
        if (layer.stroke) ctx.stroke();
    }

    /**
     * Render text layer
     */
    static renderText(ctx, layer, member) {
        const content = this.parsePlaceholders(layer.content, member);
        if (!content) return;

        ctx.fillStyle = layer.color || 'white';
        const fontSize = Math.max(layer.size || 32, 8);
        const fontName = layer.font || 'Arial';
        const fontWeight = layer.weight || 'normal';
        ctx.font = `${fontWeight} ${fontSize}px ${fontName}`;
        ctx.textAlign = layer.align || 'left';
        ctx.textBaseline = layer.baseline || 'top';

        // Text shadow
        if (layer.textShadow) {
            ctx.shadowColor = layer.textShadow.color || 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = layer.textShadow.blur || 4;
            ctx.shadowOffsetX = layer.textShadow.x || 0;
            ctx.shadowOffsetY = layer.textShadow.y || 2;
        }

        const x = layer.x || 0;
        let y = layer.y || 0;
        const maxWidth = layer.maxWidth || 800;

        if (layer.wrap) {
            // Text wrapping
            const words = content.split(' ');
            let line = '';
            const lineHeight = fontSize * (layer.lineHeight || 1.2);

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);

                if (metrics.width > maxWidth && n > 0) {
                    ctx.fillText(line.trim(), x, y);
                    line = words[n] + ' ';
                    y += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line.trim(), x, y);
        } else if (layer.autoFit) {
            // Shrink to fit
            let fitSize = fontSize;
            while (ctx.measureText(content).width > maxWidth && fitSize > 8) {
                fitSize -= 2;
                ctx.font = `${fontWeight} ${fitSize}px ${fontName}`;
            }
            ctx.fillText(content, x, y);
        } else {
            ctx.fillText(content, x, y);
        }
    }

    /**
     * Render avatar layer
     */
    static async renderAvatar(ctx, layer, member) {
        const size = Math.max(layer.size || 128, 16);
        const x = layer.x || 0;
        const y = layer.y || 0;

        try {
            const url = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const img = await Canvas.loadImage(url);

            ctx.save();

            // Avatar glow
            if (layer.glow) {
                ctx.shadowColor = layer.glow.color || 'rgba(255,255,255,0.3)';
                ctx.shadowBlur = layer.glow.blur || 20;
            }

            // Draw border first
            if (layer.stroke) {
                ctx.fillStyle = layer.stroke.color || 'white';
                const borderWidth = Math.min(layer.stroke.width || 4, 20);

                ctx.beginPath();
                if (layer.shape === 'circle') {
                    ctx.arc(x + size / 2, y + size / 2, size / 2 + borderWidth, 0, Math.PI * 2);
                } else if (layer.shape === 'rounded') {
                    const r = Math.min(layer.radius || 20, size / 2);
                    ctx.roundRect(x - borderWidth, y - borderWidth, size + borderWidth * 2, size + borderWidth * 2, r + borderWidth);
                } else if (layer.shape === 'hexagon') {
                    this.drawHexagon(ctx, x + size / 2, y + size / 2, size / 2 + borderWidth);
                } else {
                    ctx.rect(x - borderWidth, y - borderWidth, size + borderWidth * 2, size + borderWidth * 2);
                }
                ctx.fill();
            }

            // Clip avatar shape
            ctx.beginPath();
            if (layer.shape === 'circle') {
                ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            } else if (layer.shape === 'rounded') {
                const r = Math.min(layer.radius || 20, size / 2);
                ctx.roundRect(x, y, size, size, r);
            } else if (layer.shape === 'hexagon') {
                this.drawHexagon(ctx, x + size / 2, y + size / 2, size / 2);
            } else {
                ctx.rect(x, y, size, size);
            }
            ctx.closePath();
            ctx.clip();

            ctx.shadowBlur = 0;
            ctx.drawImage(img, x, y, size, size);
            ctx.restore();

        } catch {
            // Fallback placeholder
            ctx.fillStyle = layer.fallbackColor || '#5865F2';
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.fill();

            // Initial
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${size * 0.4}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                member.user.username.charAt(0).toUpperCase(),
                x + size / 2,
                y + size / 2
            );
        }
    }

    /**
     * Draw hexagon path
     */
    static drawHexagon(ctx, cx, cy, r) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI / 3) - Math.PI / 6;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    /**
     * Render image layer
     */
    static async renderImage(ctx, layer) {
        if (!layer.url || !this.isValidUrl(layer.url)) return;

        try {
            const img = await Canvas.loadImage(layer.url);
            const w = layer.width || img.width;
            const h = layer.height || img.height;

            if (w > 4000 || h > 4000) return;

            ctx.drawImage(img, layer.x || 0, layer.y || 0, w, h);
        } catch {
            // Ignore failed image
        }
    }

    /**
     * Render decoration layer
     */
    static renderDecoration(ctx, layer, width, height) {
        const style = layer.style || 'line';
        const color = layer.color || 'white';

        ctx.fillStyle = color;
        ctx.strokeStyle = color;

        switch (style) {
            case 'line':
                ctx.fillRect(layer.x || 0, layer.y || 0, layer.width || width, layer.height || 3);
                break;

            case 'accent-top':
                ctx.fillRect(0, 0, width, layer.height || 4);
                break;

            case 'accent-bottom':
                ctx.fillRect(0, height - (layer.height || 4), width, layer.height || 4);
                break;

            case 'corner':
                const size = layer.size || 30;
                // Top-left
                ctx.fillRect(layer.margin || 15, layer.margin || 15, size, 2);
                ctx.fillRect(layer.margin || 15, layer.margin || 15, 2, size);
                // Top-right
                ctx.fillRect(width - (layer.margin || 15) - size, layer.margin || 15, size, 2);
                ctx.fillRect(width - (layer.margin || 15) - 2, layer.margin || 15, 2, size);
                // Bottom-left
                ctx.fillRect(layer.margin || 15, height - (layer.margin || 15) - 2, size, 2);
                ctx.fillRect(layer.margin || 15, height - (layer.margin || 15) - size, 2, size);
                // Bottom-right
                ctx.fillRect(width - (layer.margin || 15) - size, height - (layer.margin || 15) - 2, size, 2);
                ctx.fillRect(width - (layer.margin || 15) - 2, height - (layer.margin || 15) - size, 2, size);
                break;

            case 'border':
                ctx.lineWidth = layer.lineWidth || 1;
                ctx.strokeRect(
                    layer.margin || 15,
                    layer.margin || 15,
                    width - (layer.margin || 15) * 2,
                    height - (layer.margin || 15) * 2
                );
                break;

            case 'glow':
                ctx.shadowColor = color;
                ctx.shadowBlur = layer.blur || 30;
                ctx.beginPath();
                ctx.arc(layer.x || width / 2, layer.y || height / 2, layer.radius || 50, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }

    /**
     * Parse placeholders in text
     */
    static parsePlaceholders(text, member) {
        if (!text) return '';

        let result = text
            .replace(/{user}/g, member.user.username)
            .replace(/{displayName}/g, member.displayName)
            .replace(/{server}/g, member.guild.name)
            .replace(/{count}/g, member.guild.memberCount.toString())
            .replace(/{tag}/g, member.user.tag)
            .replace(/{id}/g, member.id);

        return result.substring(0, 500);
    }
}

module.exports = WelcomeRenderer;
