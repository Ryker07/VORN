/**
 * Vorn — Event Handler
 * Dynamic event loader
 */

const fs = require('fs');
const path = require('path');

class EventHandler {
    constructor(client) {
        this.client = client;
    }

    async loadEvents() {
        const eventsPath = path.join(__dirname, '..', 'events');

        if (!fs.existsSync(eventsPath)) {
            fs.mkdirSync(eventsPath, { recursive: true });
            return;
        }

        await this.loadEventsRecursive(eventsPath);
        console.log('[Vorn] Events loaded');
    }

    async loadEventsRecursive(dirPath) {
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stat = fs.statSync(itemPath);

            if (stat.isDirectory()) {
                await this.loadEventsRecursive(itemPath);
            } else if (item.endsWith('.js')) {
                try {
                    delete require.cache[require.resolve(itemPath)];
                    const event = require(itemPath);

                    // Support register-based events (logging system)
                    if (event.register && typeof event.register === 'function') {
                        await event.register(this.client);
                    } else if (event.name && event.execute) {
                        if (event.once) {
                            this.client.once(event.name, (...args) => event.execute(...args, this.client));
                        } else {
                            this.client.on(event.name, (...args) => event.execute(...args, this.client));
                        }
                    }
                } catch (error) {
                    console.error(`[Vorn] Failed to load event ${item}: ${error.message}`);
                }
            }
        }
    }
}

module.exports = EventHandler;
