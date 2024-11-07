import { Client, Message } from "revolt.js";
import { ICommand } from "../types.js";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mainLogger } from "../utils/Logger.js";
import { BoxFormatter } from "../utils/BoxFormatter.js";
import { formatDuration, measureTime } from "../utils/TimeUtils.js";

export class CommandManager {
    private static instance: CommandManager;
    private commands: Map<string, ICommand>;
    private aliases: Map<string, string>;
    private readonly client: Client;

    private constructor(client: Client) {
        if (!client) {
            throw new Error('Client is required for CommandManager');
        }
        this.client = client;
        this.commands = new Map();
        this.aliases = new Map();
    }

    static getInstance(client?: Client): CommandManager {
        if (!CommandManager.instance && client) {
            CommandManager.instance = new CommandManager(client);
        } else if (!CommandManager.instance) {
            throw new Error('CommandManager must be initialized with a client first');
        }
        return CommandManager.instance;
    }

    getClient(): Client {
        return this.client;
    }

    private async loadCommand(filePath: string): Promise<{
        command: ICommand;
        loadTime: number;
    } | null> {
        const commandStart = measureTime();
        try {
            const { default: command } = await import(`file://${filePath}`);

            if (!command.name || !command.execute) {
                mainLogger.warn(`Invalid command file: ${filePath}`);
                return null;
            }

            // Bind the client to the command if it needs it
            if (typeof command.init === 'function') {
                await command.init(this.client);
            }

            const loadTime = commandStart();
            return { command, loadTime };
        } catch (error) {
            mainLogger.error(`Error loading command from ${filePath}:`, error);
            return null;
        }
    }

    async loadCommands(): Promise<void> {
        const startTime = Date.now();
        const stats: Record<string, {
            time: number;
            commands: number;
            failed: number;
        }> = {};

        try {
            const __dirname = dirname(fileURLToPath(import.meta.url));
            const categoriesDir = join(__dirname, "..", "commands");
            const categories = readdirSync(categoriesDir);

            for (const category of categories) {
                const categoryStart = Date.now();
                const categoryPath = join(categoriesDir, category);
                const commandFiles = readdirSync(categoryPath).filter(file => file.endsWith(".js"));

                stats[category] = { time: 0, commands: 0, failed: 0 };

                for (const file of commandFiles) {
                    const result = await this.loadCommand(join(categoryPath, file));

                    if (result) {
                        const { command, loadTime } = result;
                        this.commands.set(command.name, command);

                        if (command.aliases) {
                            command.aliases.forEach(alias => {
                                this.aliases.set(alias, command.name);
                            });
                        }

                        stats[category].time += loadTime;
                        stats[category].commands++;
                        mainLogger.debug(`Loaded command: ${command.name} (${formatDuration(loadTime)})`);
                    } else {
                        stats[category].failed++;
                    }
                }

                stats[category].time = Date.now() - categoryStart;
            }

            const totalTime = Date.now() - startTime;
            const totalCommands = Object.values(stats).reduce((acc, curr) => acc + curr.commands, 0);
            const totalFailed = Object.values(stats).reduce((acc, curr) => acc + curr.failed, 0);

            // Format the loading summary
            const summaryData = {
                "Commands Loaded": `${totalCommands}`,
                "Failed Commands": totalFailed > 0 ? `${totalFailed}` : "None",
                ...Object.entries(stats).map(([category, data]) => ({
                    [`${category} Category`]: `${data.commands} cmds in ${formatDuration(data.time)}`
                })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
                "Total Time": formatDuration(totalTime)
            };

            console.log(BoxFormatter.format(
                "Command Loading Summary",
                summaryData,
                40
            ));

        } catch (error) {
            mainLogger.error("Error loading commands:", error);
            throw error;
        }
    }

    getCommand(name: string): ICommand | undefined {
        return this.commands.get(name) || this.commands.get(this.aliases.get(name) || "");
    }

    getAllCommands(): Map<string, ICommand> {
        return this.commands;
    }

    getCommands(): ICommand[] {
        return Array.from(this.commands.values());
    }
    async executeCommand(message: Message, prefix: string): Promise<void> {
        if (!message.content) return;
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) return;

        const command = this.getCommand(commandName);
        if (!command) return;
        try {
            await command.execute(message, args, this.client);
        } catch (error) {
            mainLogger.error("Error executing command:", error);
            throw error;
        }
    }

    async reloadCommand(name: string): Promise<boolean> {
        const command = this.getCommand(name);
        if (!command) return false;

        try {
            // Remove old command and its aliases
            this.commands.delete(command.name);
            if (command.aliases) {
                command.aliases.forEach(alias => this.aliases.delete(alias));
            }

            // Get the command path and reload it
            const __dirname = dirname(fileURLToPath(import.meta.url));
            const commandPath = join(__dirname, "..", "commands", command.category.toLowerCase(), `${name}.js`);

            const result = await this.loadCommand(commandPath);
            if (!result) return false;

            const { command: newCommand } = result;
            this.commands.set(newCommand.name, newCommand);

            if (newCommand.aliases) {
                newCommand.aliases.forEach(alias => {
                    this.aliases.set(alias, newCommand.name);
                });
            }

            return true;
        } catch (error) {
            mainLogger.error(`Error reloading command ${name}:`, error);
            return false;
        }
    }
}