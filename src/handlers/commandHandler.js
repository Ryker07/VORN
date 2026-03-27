/**
 * Vorn — Command Handler
 * Dynamic slash command loader and registrar
 */

const { REST, Routes, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

class CommandHandler {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.commands = new Map();
        this.commandData = [];
    }

    /**
     * Load all commands from the commands directory
     */
    async loadCommands() {
        const commandsPath = path.join(__dirname, '..', 'commands');

        // Ensure commands directory exists
        if (!fs.existsSync(commandsPath)) {
            fs.mkdirSync(commandsPath, { recursive: true });
            return;
        }

        await this.loadCommandsRecursive(commandsPath);
        console.log(`[Vorn] Loaded ${this.commands.size} commands`);
    }

    /**
     * Recursively load commands from directories
     * @param {string} dirPath - Directory path to load from
     */
    async loadCommandsRecursive(dirPath) {
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stat = fs.statSync(itemPath);

            if (stat.isDirectory()) {
                await this.loadCommandsRecursive(itemPath);
            } else if (item.endsWith('.js')) {
                try {
                    // Clear cache for hot reloading
                    delete require.cache[require.resolve(itemPath)];

                    const command = require(itemPath);

                    if (command.data && command.execute) {
                        // console.log(`[Vorn DEBUG] Loading command: ${command.data.name}`); // Uncomment for verbose debug
                        this.commands.set(command.data.name, command);
                        this.commandData.push(command.data.toJSON());
                    } else {
                        console.warn(`[Vorn] Command ${item} missing required properties`);
                    }
                } catch (error) {
                    console.error(`[Vorn] Failed to load ${item}: ${error.message}`);
                }
            }
        }
    }

    /**
     * Register commands globally with Discord
     */
    async registerCommands() {
        if (this.commandData.length === 0) {
            console.log('[Vorn] No commands to register');
            return;
        }

        const rest = new REST({ version: '10' }).setToken(this.config.token);

        try {
            console.log(`[Vorn] Registering ${this.commandData.length} global commands...`);

            await rest.put(
                Routes.applicationCommands(this.config.clientId),
                { body: this.commandData }
            );

            console.log('[Vorn] Successfully registered global commands');
        } catch (error) {
            console.error(`[Vorn] Failed to register commands: ${error.message}`);
        }
    }

    /**
     * Handle command interaction
     * @param {Interaction} interaction - Discord interaction
     */
    async handleInteraction(interaction) {
        if (interaction.isAutocomplete()) {
            const command = this.commands.get(interaction.commandName);
            if (!command || !command.autocomplete) return;
            try {
                await command.autocomplete(interaction, this.client);
            } catch (error) {
                console.error(`[Vorn] Autocomplete error: ${error.message}`);
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const command = this.commands.get(interaction.commandName);

        if (!command) {
            console.warn(`[Vorn] Unknown command: ${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction, this.client);
        } catch (error) {
            console.error(`[Vorn] Command error: ${error.message}`);

            const errorResponse = {
                content: '**Error** ─ An unexpected error occurred while executing this command.',
                flags: MessageFlags.Ephemeral
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorResponse);
            } else {
                await interaction.reply(errorResponse);
            }
        }
    }

    /**
     * Get a command by name
     * @param {string} name - Command name
     * @returns {Object|undefined}
     */
    getCommand(name) {
        return this.commands.get(name);
    }

    /**
     * Get all loaded commands
     * @returns {Map}
     */
    getAllCommands() {
        return this.commands;
    }
}

module.exports = CommandHandler;
