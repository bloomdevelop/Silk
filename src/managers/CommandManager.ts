import type { Client, Message } from 'stoat.js';
import type { ICommand } from '../types.js';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mainLogger } from '../utils/Logger.js';
import { formatDuration, measureTime } from '../utils/TimeUtils.js';
import { TaskQueue } from '../utils/TaskQueue.js';

interface CommandLoadResult {
    commands: number;
    failed: number;
    time: number;
    category: string;
}

export class CommandManager {
    private static instance: CommandManager;
    private client: Client;
    private commands: Map<string, ICommand>;
    private aliases: Map<string, string>;
    private commandCache: Map<
        string,
        { command: ICommand; timestamp: number }
    >;
    private logger = mainLogger;
    private taskQueue: TaskQueue;
    private readonly CACHE_TTL = 300000; // 5 minutes

    private constructor(client: Client) {
        if (!client) {
            throw new Error('Client is required for CommandManager');
        }
        this.client = client;
        this.commands = new Map();
        this.aliases = new Map();
        this.commandCache = new Map();
        this.taskQueue = new TaskQueue({
            concurrency: 4, // Load up to 4 categories concurrently
            defaultTimeout: 30000, // 30 second timeout per category
            maxRetries: 2, // Retry failed loads twice
        });

        // Handle task completion events
        this.taskQueue.on('taskCompleted', (result) => {
            const loadResult = result.result as CommandLoadResult;
            if (loadResult) {
                this.logger.debug(
                    `Category ${loadResult.category} loaded: ${loadResult.commands} commands in ${formatDuration(loadResult.time)}`,
                );
            }
        });

        this.taskQueue.on('taskFailed', (result) => {
            this.logger.error(
                `Failed to load category after ${result.retries} retries:`,
                result.error,
            );
        });

        this.setupCleanupHandler();
    }

    static getInstance(client: Client): CommandManager {
        if (!CommandManager.instance) {
            CommandManager.instance = new CommandManager(client);
        }
        return CommandManager.instance;
    }

    async loadCommands(): Promise<void> {
        const startTime = Date.now();

        try {
            const __dirname = dirname(fileURLToPath(import.meta.url));
            const categoriesDir = join(__dirname, '..', 'commands');
            const categories = readdirSync(categoriesDir);

            // Create tasks for each category
            const loadPromises = categories.map((category) => {
                const categoryPath = join(categoriesDir, category);
                // Convert src path to dist path for compiled files
                const distPath = categoryPath.replace(
                    '/src/',
                    '/dist/',
                );

                return this.taskQueue.addTask({
                    execute: async () => {
                        const categoryStart = Date.now();
                        // Only look for .js files in dist directory
                        const commandFiles = readdirSync(
                            distPath,
                        ).filter((file) => file.endsWith('.js'));
                        let loadedCount = 0;
                        let failedCount = 0;

                        for (const file of commandFiles) {
                            try {
                                const filePath = join(distPath, file);
                                this.logger.debug(
                                    `Loading command from: ${filePath}`,
                                );

                                const commandModule = await import(
                                    filePath
                                );
                                const command: ICommand =
                                    commandModule.default;

                                if (!command.name) {
                                    throw new Error(
                                        `Command in ${file} has no name property`,
                                    );
                                }

                                this.commands.set(
                                    command.name,
                                    command,
                                );
                                if (command.aliases) {
                                    for (const alias of command.aliases) {
                                        this.aliases.set(alias, command.name);
                                    }
                                }
                                this.logger.debug(
                                    `Successfully loaded command: ${command.name}`,
                                );
                                loadedCount++;
                            } catch (error) {
                                this.logger.error(
                                    `Failed to load command from ${file}:`,
                                    error,
                                );
                                failedCount++;
                            }
                        }

                        return {
                            commands: loadedCount,
                            failed: failedCount,
                            time: Date.now() - categoryStart,
                            category,
                        } as CommandLoadResult;
                    },
                    timeout: 60000, // 1 minute timeout per category
                    retries: 2,
                });
            });

            // Wait for all tasks to complete
            await Promise.all(loadPromises);

            // Clean up task results
            this.taskQueue.clearAllTaskResults();

            const totalTime = Date.now() - startTime;
            this.logger.info(
                `Commands loaded in ${formatDuration(totalTime)}`,
            );
        } catch (error) {
            this.logger.error('Error loading commands:', error);
            throw error;
        }
    }

    getCommand(name: string): ICommand | undefined {
        // Check cache first
        const cached = this.commandCache.get(name);
        if (
            cached &&
            Date.now() - cached.timestamp < this.CACHE_TTL
        ) {
            return cached.command;
        }

        // If not in cache or expired, look up command
        const command =
            this.commands.get(name) ||
            this.commands.get(this.aliases.get(name) || '');

        if (command) {
            // Update cache
            this.commandCache.set(name, {
                command,
                timestamp: Date.now(),
            });
        }

        return command;
    }

    getAllCommands(): Map<string, ICommand> {
        return this.commands;
    }

    getCommands(): ICommand[] {
        return Array.from(this.commands.values());
    }

    async executeCommand(
        message: Message,
        prefix: string,
    ): Promise<void> {
        if (!message.content) return;
        const args = message.content
            .slice(prefix.length)
            .trim()
            .split(/ +/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) return;

        const command = this.getCommand(commandName);
        if (!command) return;

        // Check rate limits if configured
        if (command.rateLimit) {
            const { rateLimit } = command;
            if (!rateLimit.users) {
                rateLimit.users = new Map();
            }

            const now = Date.now();

            if (!message.author) return;

            const userId = message.author.id;
            let userLimit = rateLimit.users.get(userId);

            // Initialize user rate limit if not exists
            if (!userLimit) {
                userLimit = {
                    usages: 0,
                    resetTime: now + rateLimit.duration,
                    lastUsed: now,
                };
                rateLimit.users.set(userId, userLimit);
            }

            // Reset if time expired
            if (now > userLimit.resetTime) {
                userLimit.usages = 0;
                userLimit.resetTime = now + rateLimit.duration;
            }

            // Check if rate limited
            if (userLimit.usages >= rateLimit.usages) {
                const timeLeft = (userLimit.resetTime - now) / 1000;
                message.reply(
                    `Rate limit exceeded. Please wait ${timeLeft.toFixed(1)} more second(s) before using the \`${command.name}\` command.`,
                );
                return;
            }

            // Update usage
            userLimit.usages++;
            userLimit.lastUsed = now;
        }

        // Pre-validate command arguments if validation function exists
        if (command.validate && !command.validate(args)) {
            message.reply(
                `Invalid command usage. Use \`${prefix}help ${command.name}\` for proper usage.`,
            );
            return;
        }

        try {
            await command.execute(message, args, this.client);
        } catch (error) {
            this.logger.error('Error executing command:', error);
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
                for (const alias of command.aliases) {
                    this.aliases.delete(alias);
                }
            }

            // Get the command path and reload it
            const __dirname = dirname(fileURLToPath(import.meta.url));
            const commandPath = join(
                __dirname,
                '..',
                'commands',
                command.category.toLowerCase(),
                `${name}.js`,
            );

            const result = await this.loadCommand(commandPath);
            if (!result) return false;

            const { command: newCommand } = result;
            this.commands.set(newCommand.name, newCommand);

            if (newCommand.aliases) {
                for (const alias of newCommand.aliases) {
                    this.aliases.set(alias, newCommand.name);
                }
            }

            return true;
        } catch (error) {
            this.logger.error(
                `Error reloading command ${name}:`,
                error,
            );
            return false;
        }
    }

    private async loadCommand(filePath: string): Promise<{
        command: ICommand;
        loadTime: number;
    } | null> {
        const commandStart = measureTime();
        try {
            const { default: command } = await import(
                `file://${filePath}`
            );

            if (!command.name || !command.execute) {
                this.logger.warn(`Invalid command file: ${filePath}`);
                return null;
            }

            // Bind the client to the command if it needs it
            if (typeof command.init === 'function') {
                await command.init(this.client);
            }

            const loadTime = commandStart();
            return { command, loadTime };
        } catch (error) {
            this.logger.error(
                `Error loading command from ${filePath}:`,
                error,
            );
            return null;
        }
    }

    private setupCleanupHandler(): void {
        const cleanup = async () => {
            try {
                await this.destroy();
                this.logger.debug(
                    'CommandManager cleaned up successfully',
                );
            } catch (error) {
                this.logger.error(
                    'Error during CommandManager cleanup:',
                    error,
                );
            }
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('exit', cleanup);
        process.on('uncaughtException', (error) => {
            this.logger.error(
                'Uncaught exception in CommandManager:',
                error,
            );
            cleanup();
        });
        process.on('unhandledRejection', (reason) => {
            this.logger.error(
                'Unhandled rejection in CommandManager:',
                reason,
            );
            cleanup();
        });
    }

    public async destroy(): Promise<void> {
        try {
            // Clear all command caches
            this.commands.clear();
            this.aliases.clear();
            this.commandCache.clear();

            // Clean up task queue
            await this.taskQueue.destroy();

            // Remove all listeners
            process.removeAllListeners('SIGINT');
            process.removeAllListeners('SIGTERM');
            process.removeAllListeners('exit');
            process.removeAllListeners('uncaughtException');
            process.removeAllListeners('unhandledRejection');

            this.logger.debug('CommandManager resources cleaned up');
        } catch (error) {
            this.logger.error(
                'Error during CommandManager cleanup:',
                error,
            );
            throw error;
        }
    }
}
