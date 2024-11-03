import { Client, Message } from "revolt.js";
import { ICommand } from "../types.js";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { DatabaseService } from "../services/DatabaseService.js";
import { RateLimitManager } from "./RateLimitManager.js";
import { mainLogger } from "../utils/Logger.js";

export class CommandManager {
    private commands: Map<string, ICommand>;
    private aliases: Map<string, string>;
    private client: Client;
    private db: DatabaseService;
    private rateLimitManager: RateLimitManager;

    constructor(client: Client) {
        this.commands = new Map();
        this.aliases = new Map();
        this.client = client;
        this.db = DatabaseService.getInstance();
        this.rateLimitManager = RateLimitManager.getInstance();
        mainLogger.info("CommandManager initialized");
    }

    async loadCommands(): Promise<void> {
        try {
            const __dirname = dirname(fileURLToPath(import.meta.url));
            const categoriesPath = join(__dirname, "..", "commands");
            const categories = readdirSync(categoriesPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            for (const category of categories) {
                const categoryPath = join(categoriesPath, category);
                const commandFiles = readdirSync(categoryPath)
                    .filter(file => file.endsWith(".js"));

                for (const file of commandFiles) {
                    try {
                        const commandModule = await import(`file://${join(categoryPath, file)}`);
                        const command: ICommand = commandModule.default;

                        if (!command.name || !command.execute) {
                            mainLogger.warn(`Invalid command in file: ${file}`);
                            continue;
                        }

                        // Register the main command
                        this.commands.set(command.name.toLowerCase(), command);

                        // Register aliases if they exist
                        if (command.aliases?.length) {
                            command.aliases.forEach(alias => {
                                this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
                            });
                        }

                        mainLogger.info(`Loaded command: ${command.name}`);
                    } catch (error) {
                        mainLogger.error(`Error loading command file ${file}:`, error);
                    }
                }
            }

            mainLogger.info(`Loaded ${this.commands.size} commands and ${this.aliases.size} aliases`);
        } catch (error) {
            mainLogger.error("Error loading commands:", error);
            throw error;
        }
    }

    async executeCommand(message: Message, prefix: string): Promise<void> {
        try {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift()?.toLowerCase();

            if (!commandName) return;

            // Check if it's a command or alias
            let command = this.commands.get(commandName);
            if (!command) {
                const mainCommandName = this.aliases.get(commandName);
                if (mainCommandName) {
                    command = this.commands.get(mainCommandName);
                }
            }

            if (!command) return;

            // Get server config for permission checks
            const serverConfig = await this.db.getServerConfig(message.server?.id);

            // Check if command is disabled
            if (serverConfig.commands.disabled.includes(command.name)) {
                await message.reply({
                    embeds: [{
                        title: "Command Disabled",
                        description: "This command is currently disabled on this server.",
                        colour: "#ff0000"
                    }]
                });
                return;
            }

            // Check if user is blocked
            if (serverConfig.security.blockedUsers.includes(message.author?.id || '')) {
                await message.reply({
                    embeds: [{
                        title: "Access Denied",
                        description: "You are blocked from using commands.",
                        colour: "#ff0000"
                    }]
                });
                return;
            }

            // Check owner-only commands
            if (command.flags?.ownerOnly && !serverConfig.bot.owners.includes(message.author?.id || '')) {
                await message.reply({
                    embeds: [{
                        title: "Access Denied",
                        description: "This command is only available to bot owners.",
                        colour: "#ff0000"
                    }]
                });
                return;
            }

            // Check rate limits
            if (command.rateLimit && message.author?.id) {
                if (this.rateLimitManager.isRateLimited(message.author.id, command.rateLimit)) {
                    const remainingTime = Math.ceil(
                        this.rateLimitManager.getRemainingTime(message.author.id, command.rateLimit) / 1000
                    );
                    
                    await message.reply({
                        embeds: [{
                            title: "Rate Limited",
                            description: `Please wait ${remainingTime} seconds before using this command again.`,
                            colour: "#ff0000"
                        }]
                    });
                    return;
                }
            }

            // Execute the command
            await command.execute(message, args, this.client);
            mainLogger.debug(`Executed command: ${command.name} by ${message.author?.username}`);

        } catch (error) {
            mainLogger.error("Error executing command:", error);
            await message.reply({
                embeds: [{
                    title: "Error",
                    description: "An error occurred while executing the command.",
                    colour: "#ff0000"
                }]
            });
        }
    }

    getCommands(): Map<string, ICommand> {
        return this.commands;
    }

    getCommand(name: string): ICommand | undefined {
        return this.commands.get(name.toLowerCase()) || 
               this.commands.get(this.aliases.get(name.toLowerCase()) || '');
    }
}