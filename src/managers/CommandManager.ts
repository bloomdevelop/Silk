import { Client, Message } from "revolt.js";
import { ICommand } from "../types.js";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Logger, mainLogger } from "../utils/Logger.js";
import { formatDuration, measureTime } from "../utils/TimeUtils.js";

export class CommandManager {
    private commands: Map<string, ICommand>;
    private aliases: Map<string, string>;
    private client: Client;
    private logger: Logger;

    constructor(client: Client) {
        this.commands = new Map();
        this.aliases = new Map();
        this.client = client;
        this.logger = mainLogger.createLogger("CommandManager");
    }

    private async loadCommand(filePath: string): Promise<void> {
        const getLoadTime = measureTime();
        try {
            const commandModule = await import(filePath);
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
        try {
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