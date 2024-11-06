import { Client, Message } from "revolt.js";
import { ICommand } from "../types.js";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Logger, mainLogger } from "../utils/Logger.js";
import { formatDuration, measureTime } from "../utils/TimeUtils.js";
import { ProcessManager } from "../utils/ProcessManager.js";

export class CommandManager {
    private static instance: CommandManager | null = null;
    private commands: Map<string, ICommand>;
    private aliases: Map<string, string>;
    private client: Client;
    private logger: Logger;
    private commandCache: Map<string, {
        module: any;
        timestamp: number;
    }>;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private readonly CACHE_TTL = 300000; // 5 minutes
    private isInitialized: boolean = false;

    private constructor(client: Client) {
        if (!client) {
            throw new Error('Client must be provided to CommandManager');
        }
        
        this.commands = new Map();
        this.aliases = new Map();
        this.client = client;
        this.logger = mainLogger.createLogger("CommandManager");
        this.commandCache = new Map();

        this.cleanupInterval = setInterval(() => this.cleanupCache(), this.CACHE_TTL);
        
        // Register cleanup with ProcessManager
        ProcessManager.getInstance().registerCleanupFunction(() => this.destroy());
    }

    static getInstance(client?: Client): CommandManager {
        if (!CommandManager.instance) {
            if (!client) {
                throw new Error('Client must be provided when first creating CommandManager');
            }
            CommandManager.instance = new CommandManager(client);
        } else if (client && client !== CommandManager.instance.client) {
            // If a different client is provided after initialization, log a warning
            mainLogger.warn('Attempting to initialize CommandManager with a different client instance');
        }
        return CommandManager.instance;
    }

    private cleanupCache(): void {
        const now = Date.now();
        for (const [key, value] of this.commandCache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.commandCache.delete(key);
            }
        }
    }

    public destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.commands.clear();
        this.aliases.clear();
        this.commandCache.clear();
    }

    private async loadCommand(filePath: string): Promise<void> {
        const getLoadTime = measureTime();
        try {
            // Check if module is cached and not older than 5 minutes
            const cached = this.commandCache.get(filePath);
            if (cached && (Date.now() - cached.timestamp) < 300000) {
                const command = cached.module.default;
                this.commands.set(command.name.toLowerCase(), command);
                return;
            }

            const commandModule = await import(filePath);
            this.commandCache.set(filePath, {
                module: commandModule,
                timestamp: Date.now()
            });

            const command: ICommand = commandModule.default;

            if (!command?.name || !command?.execute) {
                throw new Error('Invalid command structure');
            }

            // Register the main command
            this.commands.set(command.name.toLowerCase(), command);

            // Register aliases if they exist
            if (command.aliases?.length) {
                command.aliases.forEach(alias => {
                    this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
                });
            }

            const loadTime = getLoadTime();
            this.logger.debug(`Loaded command: ${command.name} (${formatDuration(loadTime)})`);
        } catch (error) {
            this.logger.error(`Failed to load command from ${filePath}:`, error);
            throw error;
        }
    }

    async loadCommands(): Promise<void> {
        if (this.isInitialized) {
            this.logger.warn('Commands are already loaded, skipping initialization');
            return;
        }

        try {
            // Clear existing commands before loading
            this.commands.clear();
            this.aliases.clear();

            const __dirname = dirname(fileURLToPath(import.meta.url));
            const categoriesPath = join(__dirname, "..", "commands");
            
            this.logger.debug(`Loading commands from: ${categoriesPath}`);

            const categories = readdirSync(categoriesPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            const categoryTimes: Record<string, number> = {};
            const commandTimes: Record<string, number> = {};

            for (const category of categories) {
                const getCategoryTime = measureTime();
                const categoryPath = join(categoriesPath, category);
                const commandFiles = readdirSync(categoryPath)
                    .filter(file => file.endsWith(".js"));

                let loadedCommands = 0;
                for (const file of commandFiles) {
                    try {
                        const filePath = `file://${join(categoryPath, file)}`;
                        const getCommandTime = measureTime();
                        await this.loadCommand(filePath);
                        const commandTime = getCommandTime();
                        commandTimes[file] = commandTime;
                        loadedCommands++;
                    } catch (error) {
                        this.logger.error(`Failed to load command file ${file}:`, error);
                    }
                }

                const categoryTime = getCategoryTime();
                categoryTimes[category] = categoryTime;
                
                // Log category summary with average command load time
                const avgTime = loadedCommands > 0 
                    ? categoryTime / loadedCommands 
                    : 0;
                
                this.logger.info(
                    `Loaded ${loadedCommands} commands from ${category} in ${formatDuration(categoryTime)} (avg: ${formatDuration(avgTime)})`
                );
            }

            // Log summary
            const totalCommands = this.commands.size;
            const totalAliases = this.aliases.size;
            const totalTime = Object.values(categoryTimes).reduce((a, b) => a + b, 0);
            const avgTime = totalCommands > 0 ? totalTime / totalCommands : 0;

            this.logger.info([
                `Command loading summary:`,
                ...Object.entries(categoryTimes).map(([category, time]) => 
                    `• ${category}: ${formatDuration(time)}`
                ),
                `Total: ${totalCommands} commands, ${totalAliases} aliases in ${formatDuration(totalTime)} (avg: ${formatDuration(avgTime)})`
            ].join('\n'));

            this.isInitialized = true;
        } catch (error) {
            this.logger.error("Error loading commands:", error);
            throw error;
        }
    }

    async executeCommand(message: Message, prefix: string): Promise<void> {
        if (!message.content) return;
        try {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift()?.toLowerCase();

            if (!commandName) return;

            this.logger.debug(`Attempting to execute command: ${commandName}`);

            // Check if it's a command or alias
            let command = this.commands.get(commandName);
            if (!command) {
                const mainCommandName = this.aliases.get(commandName);
                if (mainCommandName) {
                    command = this.commands.get(mainCommandName);
                }
            }

            if (!command) {
                this.logger.debug(`Command not found: ${commandName}`);
                return;
            }

            // Execute the command
            await command.execute(message, args, this.client);
            this.logger.debug(`Executed command: ${command.name} by ${message.author?.username}`);

        } catch (error) {
            this.logger.error("Error executing command:", error);
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
}