import { Client } from 'stoat.js';
import { CommandManager } from './managers/CommandManager.js';
import { EventManager } from './managers/EventManager.js';
import { mainLogger } from './utils/Logger.js';
import { DatabaseService } from './services/DatabaseService.js';
import { ProcessManager } from './managers/ProcessManager.js';
import { formatDuration, measureTime } from './utils/TimeUtils.js';
import { BoxFormatter } from './utils/BoxFormatter.js';
import { AutoModService } from './services/AutoModService.js';

export class Bot {
    private static instance: Bot;
    readonly client: Client;
    readonly db: DatabaseService;
    readonly commandManager: CommandManager;
    private eventManager: EventManager;
    startTime = 0;
    private isDestroying = false;
    readonly autoMod: AutoModService;

    private constructor() {
        const initStart = Date.now();

        // Validate token before initializing
        this.validateEnvironment();

        this.client = new Client();
        this.db = DatabaseService.getInstance();
        this.commandManager = CommandManager.getInstance(this.client);
        this.eventManager = new EventManager(
            this.client,
            this.commandManager,
            this,
        );

        this.autoMod = AutoModService.getInstance();

        // Register cleanup with ProcessManager
        ProcessManager.getInstance().registerCleanupFunction(() =>
            this.destroy(),
        );

        const initTime = Date.now() - initStart;
        mainLogger.info(
            `Bot initialized in ${formatDuration(initTime)}`,
        );
    }

    private validateEnvironment(): void {
        if (!process.env.TOKEN) {
            const error =
                'Bot token not found in environment variables';
            mainLogger.error(error);
            throw new Error(error);
        }

        // Optional: Validate other required environment variables
        if (!process.env.TURSO_DATABASE_URL) {
            mainLogger.warn(
                'TURSO_DATABASE_URL not set, using local SQLite database',
            );
        }
    }

    static getInstance(): Bot {
        if (!Bot.instance) {
            Bot.instance = new Bot();
        }
        return Bot.instance;
    }

    // Getter methods
    getCommandManager(): CommandManager {
        return this.commandManager;
    }

    async start(): Promise<void> {
        const startupStart = Date.now();
        try {
            mainLogger.info('Starting bot initialization...');

            // Initialize database first
            const dbStart = measureTime();
            await this.db.initialize();
            const dbTime = dbStart();
            mainLogger.info(
                `Database initialized in ${formatDuration(dbTime)}`,
            );

            // Then initialize other components
            const cmdStart = measureTime();
            await this.commandManager.loadCommands();
            const cmdTime = cmdStart();
            mainLogger.info(
                `Commands loaded in ${formatDuration(cmdTime)}`,
            );

            const eventStart = measureTime();
            await this.eventManager.registerEvents();
            const eventTime = eventStart();
            mainLogger.info(
                `Events registered in ${formatDuration(eventTime)}`,
            );

            // Login with validated token first
            const loginStart = measureTime();
            if (!process.env.TOKEN) {
                throw new Error(
                    'TOKEN environment variable is not set',
                );
            }
            await this.client.loginBot(process.env.TOKEN);
            const loginTime = loginStart();
            mainLogger.info(
                `Bot logged in in ${formatDuration(loginTime)}`,
            );

            // Initialize AutoMod service after client is logged in
            const autoModStart = measureTime();
            await this.autoMod.initialize(this.client);
            const autoModTime = autoModStart();
            mainLogger.info(
                `AutoMod initialized in ${formatDuration(autoModTime)}`,
            );

            this.startTime = Date.now();
            const totalTime = Date.now() - startupStart;

            // Format startup summary using BoxFormatter
            const startupData = {
                'Database Init': formatDuration(dbTime),
                'Command Loading': formatDuration(cmdTime),
                'Event Registration': formatDuration(eventTime),
                'Login Time': formatDuration(loginTime),
                'AutoMod Init': formatDuration(autoModTime),
                'Total Time': formatDuration(totalTime),
            };

            console.log(
                BoxFormatter.format(
                    'Startup Summary',
                    startupData,
                    32, // Minimum width for the box
                ),
            );
        } catch (error) {
            const failTime = Date.now() - startupStart;
            mainLogger.error(
                `Failed to start bot after ${formatDuration(failTime)}:`,
                error,
            );
            throw error;
        }
    }

    async destroy(): Promise<void> {
        if (this.isDestroying) {
            mainLogger.debug(
                'Bot destroy already in progress, skipping...',
            );
            return;
        }

        this.isDestroying = true;
        const destroyStart = measureTime();

        try {
            mainLogger.info('Starting bot cleanup...');

            // First cleanup event manager
            await Promise.resolve(this.eventManager.destroy());

            // Then cleanup database
            await this.db.destroy();

            // Add automod cleanup
            this.autoMod.destroy();

            const totalTime = destroyStart();
            mainLogger.info(
                `Bot cleanup completed in ${formatDuration(totalTime)}`,
            );
        } catch (error) {
            mainLogger.error(
                'Critical error during bot cleanup:',
                error,
            );
            throw error;
        }
        // Note: Logger cleanup is now handled by ProcessManager
    }
}
