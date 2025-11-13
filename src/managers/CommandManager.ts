import type { Client, Message } from 'stoat.js';
import type { ICommand } from '../types.js';
import { Worker } from 'node:worker_threads';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mainLogger } from '../utils/Logger.js';
import { formatDuration, measureTime } from '../utils/TimeUtils.js';
import { TaskQueue } from '../utils/TaskQueue.js';
import { CommandCacheService } from '../services/CommandCacheService.js';

interface CommandLoadResult {
    commands: number;
    failed: number;
    time: number;
    category: string;
}

interface TaskResultWrapper {
    id: string;
    result?: CommandLoadResult;
    error?: Error;
    startTime: number;
    endTime: number;
    retries: number;
    success: boolean;
}

interface CacheEntry {
    command: ICommand;
    timestamp: number;
}

export class CommandManager {
    private static instance: CommandManager;
    private client: Client;
    private commands: Map<string, ICommand>;
    private aliases: Map<string, string>;
    private commandCache: Map<string, CacheEntry>;
    private logger = mainLogger;
    private taskQueue: TaskQueue;
    private readonly CACHE_TTL = 300000; // 5 minutes
    private cacheCleanupInterval: NodeJS.Timeout | null = null;
    private maxCacheSize = 500;
    private cacheService: CommandCacheService | null = null;

    private constructor(client: Client) {
        if (!client) {
            throw new Error('Client is required for CommandManager');
        }
        this.client = client;
        this.commands = new Map();
        this.aliases = new Map();
        this.commandCache = new Map();
        this.taskQueue = new TaskQueue({
            concurrency: 4,
            defaultTimeout: 30000,
            maxRetries: 2,
        });

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
        this.startCacheCleanup();
    }

    static getInstance(client: Client): CommandManager {
        if (!CommandManager.instance) {
            CommandManager.instance = new CommandManager(client);
        }
        return CommandManager.instance;
    }

    async initializeCacheService(dataDir: string): Promise<void> {
        this.cacheService = CommandCacheService.getInstance(dataDir);
        await this.cacheService.initialize();
    }

    async loadCommands(): Promise<void> {
        const startTime = Date.now();

        try {
            const __dirname = dirname(fileURLToPath(import.meta.url));
            const categoriesDir = join(__dirname, '..', 'commands');
            const categories = readdirSync(categoriesDir);
            let completedTasks = 0;
            const totalTasks = categories.length;

            // Queue all categories and wait for completion
            await new Promise<void>((resolve, reject) => {
                if (totalTasks === 0) {
                    resolve();
                    return;
                }

                const taskCompletedHandler = (
                    taskResult: TaskResultWrapper,
                ) => {
                    completedTasks++;
                    const loadResult = taskResult.result;
                    if (loadResult) {
                        this.logger.debug(
                            `Category ${loadResult.category} loaded: ${loadResult.commands} commands in ${formatDuration(loadResult.time)}`,
                        );
                    }
                    if (completedTasks >= totalTasks) {
                        this.taskQueue.removeListener(
                            'taskCompleted',
                            taskCompletedHandler,
                        );
                        this.taskQueue.removeListener(
                            'taskFailed',
                            taskFailedHandler,
                        );
                        resolve();
                    }
                };

                const taskFailedHandler = (
                    taskResult: TaskResultWrapper,
                ) => {
                    this.taskQueue.removeListener(
                        'taskCompleted',
                        taskCompletedHandler,
                    );
                    this.taskQueue.removeListener(
                        'taskFailed',
                        taskFailedHandler,
                    );
                    this.logger.error(
                        `Failed to load category after ${taskResult.retries} retries:`,
                        taskResult.error,
                    );
                    reject(taskResult.error);
                };

                this.taskQueue.on(
                    'taskCompleted',
                    taskCompletedHandler,
                );
                this.taskQueue.on('taskFailed', taskFailedHandler);

                // Queue all category load tasks
                for (const category of categories) {
                    const categoryPath = join(
                        categoriesDir,
                        category,
                    );
                    const distPath = categoryPath.replace(
                        '/src/',
                        '/dist/',
                    );

                    this.taskQueue.addTask({
                        execute: () =>
                            this.loadCategoryWithWorker(
                                distPath,
                                category,
                            ),
                        priority: 2,
                    });
                }
            });

            this.logger.debug(
                `All categories loaded. Total commands: ${this.commands.size}`,
            );

            // Save cache after all commands are loaded
            if (this.cacheService) {
                await this.cacheService.saveCache(this.getCommands());
            }

            const totalTime = Date.now() - startTime;
            this.logger.info(
                `Commands loaded in ${formatDuration(totalTime)}`,
            );
        } catch (error) {
            this.logger.error('Error loading commands:', error);
            throw error;
        }
    }

    private loadCategoryWithWorker(
        distPath: string,
        category: string,
    ): Promise<CommandLoadResult> {
        return new Promise((resolve, reject) => {
            const categoryStart = Date.now();

            const worker = new Worker(
                new URL(
                    '../workers/commandLoader.js',
                    import.meta.url,
                ),
            );

            worker.on(
                'message',
                async (result: {
                    commandFiles: string[];
                    failed: number;
                    time: number;
                    category: string;
                }) => {
                    try {
                        this.logger.debug(
                            `Received worker result for ${result.category}: ${result.commandFiles?.length || 0} files`,
                        );
                        let loadedCount = 0;
                        // Load commands from the provided file paths
                        if (
                            result.commandFiles &&
                            Array.isArray(result.commandFiles)
                        ) {
                            for (const filePath of result.commandFiles) {
                                const cmdResult =
                                    await this.loadCommand(filePath);
                                if (cmdResult) {
                                    const cmd = cmdResult.command;
                                    this.commands.set(cmd.name, cmd);
                                    if (cmd.aliases) {
                                        for (const alias of cmd.aliases) {
                                            this.aliases.set(
                                                alias,
                                                cmd.name,
                                            );
                                        }
                                    }
                                    loadedCount++;
                                }
                            }
                        }

                        worker.terminate();
                        resolve({
                            commands: loadedCount,
                            failed:
                                (result.failed || 0) +
                                (result.commandFiles.length -
                                    loadedCount),
                            time: Date.now() - categoryStart,
                            category,
                        });
                    } catch (error) {
                        worker.terminate();
                        reject(error);
                    }
                },
            );

            worker.on('error', reject);
            worker.on('exit', (code) => {
                if (code !== 0) {
                    reject(
                        new Error(`Worker exited with code ${code}`),
                    );
                }
            });

            worker.postMessage({
                categoryPath: distPath,
                category,
            });
        });
    }

    getCommand(name: string): ICommand | undefined {
        // Check cache first
        const cached = this.commandCache.get(name);
        if (
            cached &&
            Date.now() - cached.timestamp < this.CACHE_TTL
        ) {
            // Update timestamp for LRU
            cached.timestamp = Date.now();
            return cached.command;
        }

        // Look up command
        const command =
            this.commands.get(name) ||
            this.commands.get(this.aliases.get(name) || '');

        if (command) {
            this.updateCache(name, command);
        }

        return command;
    }

    private updateCache(name: string, command: ICommand): void {
        // Evict oldest entry if cache exceeds max size
        if (this.commandCache.size >= this.maxCacheSize) {
            let oldestKey: string | null = null;
            let oldestTime = Date.now();

            for (const [key, entry] of this.commandCache.entries()) {
                if (entry.timestamp < oldestTime) {
                    oldestTime = entry.timestamp;
                    oldestKey = key;
                }
            }

            if (oldestKey) {
                this.commandCache.delete(oldestKey);
            }
        }

        this.commandCache.set(name, {
            command,
            timestamp: Date.now(),
        });
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
            this.commandCache.delete(command.name);

            if (command.aliases) {
                for (const alias of command.aliases) {
                    this.aliases.delete(alias);
                    this.commandCache.delete(alias);
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
            this.updateCache(newCommand.name, newCommand);

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

    private startCacheCleanup(): void {
        this.cacheCleanupInterval = setInterval(() => {
            const now = Date.now();
            let evicted = 0;

            for (const [key, entry] of this.commandCache.entries()) {
                if (now - entry.timestamp > this.CACHE_TTL) {
                    this.commandCache.delete(key);
                    evicted++;
                }
            }

            if (evicted > 0) {
                this.logger.debug(
                    `Cache cleanup: evicted ${evicted} expired entries`,
                );
            }
        }, 60000); // Clean every minute
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
            // Clear all caches and data structures
            this.commands.clear();
            this.aliases.clear();
            this.commandCache.clear();

            // Stop cache cleanup interval
            if (this.cacheCleanupInterval) {
                clearInterval(this.cacheCleanupInterval);
                this.cacheCleanupInterval = null;
            }

            // Clean up task queue
            this.taskQueue.destroy();

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
