/**
 * Vorn — Logging: Role Events
 * Tracks role create, delete, and update (name, color, permissions, hoist, mentionable)
 */

const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'logging_roles',
    once: false,

    async register(client) {
        // Role Create
        client.on('roleCreate', async (role) => {
            try {
                if (!client.logging) return;
                if (role.managed) return; // Skip bot-managed roles

                if (await client.logging.shouldIgnore(role.guild.id, {})) return;

                const embed = client.logging.roleCreateEmbed(role);
                await client.logging.send(role.guild, 'roles', embed);
            } catch { }
        });

        // Role Delete
        client.on('roleDelete', async (role) => {
            try {
                if (!client.logging) return;
                if (role.managed) return;

                if (await client.logging.shouldIgnore(role.guild.id, {})) return;

                const embed = client.logging.roleDeleteEmbed(role);
                await client.logging.send(role.guild, 'roles', embed);
            } catch { }
        });

        // Role Update
        client.on('roleUpdate', async (oldRole, newRole) => {
            try {
                if (!client.logging) return;
                if (newRole.managed) return;

                if (await client.logging.shouldIgnore(newRole.guild.id, {})) return;

                const changes = [];

                if (oldRole.name !== newRole.name) {
                    changes.push(`**Name** ─ \`${oldRole.name}\` → \`${newRole.name}\``);
                }

                if (oldRole.hexColor !== newRole.hexColor) {
                    changes.push(`**Color** ─ \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
                }

                if (oldRole.hoist !== newRole.hoist) {
                    changes.push(`**Hoisted** ─ ${oldRole.hoist ? 'Yes' : 'No'} → ${newRole.hoist ? 'Yes' : 'No'}`);
                }

                if (oldRole.mentionable !== newRole.mentionable) {
                    changes.push(`**Mentionable** ─ ${oldRole.mentionable ? 'Yes' : 'No'} → ${newRole.mentionable ? 'Yes' : 'No'}`);
                }

                if (oldRole.icon !== newRole.icon) {
                    changes.push(`**Icon** ─ Changed`);
                }

                // Permission changes
                if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
                    const oldPerms = new PermissionsBitField(oldRole.permissions.bitfield);
                    const newPerms = new PermissionsBitField(newRole.permissions.bitfield);

                    const added = [];
                    const removed = [];

                    for (const [perm, bit] of Object.entries(PermissionsBitField.Flags)) {
                        const hadPerm = oldPerms.has(bit);
                        const hasPerm = newPerms.has(bit);

                        if (!hadPerm && hasPerm) added.push(perm);
                        if (hadPerm && !hasPerm) removed.push(perm);
                    }

                    if (added.length > 0) {
                        changes.push(`**Permissions Added** ─ \`${added.slice(0, 8).join('`, `')}\`${added.length > 8 ? ` +${added.length - 8}` : ''}`);
                    }
                    if (removed.length > 0) {
                        changes.push(`**Permissions Removed** ─ \`${removed.slice(0, 8).join('`, `')}\`${removed.length > 8 ? ` +${removed.length - 8}` : ''}`);
                    }
                }

                if (changes.length === 0) return;

                const embed = client.logging.roleUpdateEmbed(oldRole, newRole, changes);
                await client.logging.send(newRole.guild, 'roles', embed);
            } catch { }
        });
    }
};
