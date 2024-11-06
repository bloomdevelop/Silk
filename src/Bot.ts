import { Client } from "revolt.js";
import { CommandManager } from "./managers/CommandManager.js";
import { EventManager } from "./managers/EventManager.js";
import { mainLogger } from "./utils/Logger.js";
import { DatabaseService } from "./services/DatabaseService.js";
import { ProcessManager } from "./utils/ProcessManager.js";
import { formatDuration, measureTime } from "./utils/TimeUtils.js";

export class Bot {
    private static instance: Bot;
    private client: Client;
    private db: DatabaseService;
    private commandManager: CommandManager;
    private eventManager: EventManager;
    private startTime: number = 0;

    private constructor() {
        const initStart = Date.now();
        
        // Validate token before initializing
        this.validateEnvironment();
        
        this.client = new Client();
        this.db = DatabaseService.getInstance();
        this.commandManager = CommandManager.getInstance(this.client);
        this.eventManager = new EventManager(this.client, this.commandManager);
        
        // Register cleanup with ProcessManager
        ProcessManager.getInstance().registerCleanupFunction(() => this.destroy());

        const initTime = Date.now() - initStart;
        mainLogger.info(`Bot initialized in ${formatDuration(initTime)}`);
    }

    private validateEnvironment(): void {
        if (!process.env.TOKEN) {
            const error = 'Bot token not found in environment variables';
            mainLogger.error(error);
            throw new Error(error);
        }

        // Optional: Validate other required environment variables
        if (!process.env.TURSO_DATABASE_URL) {
            mainLogger.warn('TURSO_DATABASE_URL not set, using local SQLite database');
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

    getClient(): Client {
        return this.client;
    }

    getDatabaseService(): DatabaseService {
        return this.db;
    }

    getUptime(): string {
        return formatDuration(Date.now() - this.startTime);
    }

    async start(): Promise<void> {
        const startupStart = Date.now();
        try {
            mainLogger.info('Starting bot initialization...');

            // Initialize database first
            const dbStart = measureTime();
            await this.db.initialize();
            const dbTime = dbStart();
            mainLogger.info(`Database initialized in ${formatDuration(dbTime)}`);

            // Then initialize other components
            const cmdStart = measureTime();
            await this.commandManager.loadCommands();
            const cmdTime = cmdStart();
            mainLogger.info(`Commands loaded in ${formatDuration(cmdTime)}`);

            const eventStart = measureTime();
            await this.eventManager.registerEvents();
            const eventTime = eventStart();
            mainLogger.info(`Events registered in ${formatDuration(eventTime)}`);

            // Login with validated token
            const loginStart = measureTime();
            if (!process.env.TOKEN) {
                throw new Error('TOKEN environment variable is not set');
            }
            await this.client.loginBot(process.env.TOKEN);
            const loginTime = loginStart();
            mainLogger.info(`Bot logged in in ${formatDuration(loginTime)}`);

            this.startTime = Date.now();
            const totalTime = Date.now() - startupStart;

            mainLogger.info([
                '=== Startup Summary ===',
                `Database Init: ${formatDuration(dbTime)}`,
                `Command Loading: ${formatDuration(cmdTime)}`,
                `Event Registration: ${formatDuration(eventTime)}`,
                `Login Time: ${formatDuration(loginTime)}`,
                `Total Startup Time: ${formatDuration(totalTime)}`,
                '===================='
            ].join('\n'));

        } catch (error) {
            const failTime = Date.now() - startupStart;
            mainLogger.error(`Failed to start bot after ${formatDuration(failTime)}:`, error);
            throw error;
        }
    }

    destroy(): void {
        const destroyStart = measureTime();
        try {
            this.eventManager.destroy();
            this.db.destroy();
            this.client.logout();
            const totalTime = destroyStart();
            mainLogger.info(`Bot destroyed successfully in ${formatDuration(totalTime)}`);
        } catch (error) {
            mainLogger.error('Error during bot cleanup:', error);
            throw error;
        }
    }
}