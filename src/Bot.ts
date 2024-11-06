import { Client } from "revolt.js";
import { CommandManager } from "./managers/CommandManager.js";
import { EventManager } from "./managers/EventManager.js";
import { Logger, mainLogger } from "./utils/Logger.js";
import { DatabaseService } from "./services/DatabaseService.js";
import { formatDuration, measureTime } from "./utils/TimeUtils.js";

export class Bot {
    private static instance: Bot;
    private client: Client;
    private logger: Logger;
    private commandManager: CommandManager;
    private eventManager: EventManager;
    private db: DatabaseService;

    private constructor() {
        this.client = new Client();
        this.logger = mainLogger.createLogger("Bot");
        this.db = DatabaseService.getInstance();
        this.commandManager = new CommandManager(this.client);
        this.eventManager = new EventManager(this.client, this.commandManager);
    }

    public static getInstance(): Bot {
        if (!Bot.instance) {
            Bot.instance = new Bot();
        }
        return Bot.instance;
    }

    public getCommandManager(): CommandManager {
        return this.commandManager;
    }

    async start(): Promise<void> {
        try {
            const getTotalTime = measureTime();

            const token = process.env.TOKEN;
            if (!token) {
                throw new Error("No token provided in environment variables");
            }

            // Initialize database first
            const getDbTime = measureTime();
            await this.db.initialize();
            const dbTime = getDbTime();
            this.logger.debug(`Database initialized in ${formatDuration(dbTime)}`);

            // Load commands
            const getCommandsTime = measureTime();
            await this.commandManager.loadCommands();
            const commandsTime = getCommandsTime();
            this.logger.debug(`Commands loaded in ${formatDuration(commandsTime)}`);

            // Register events
            const getEventsTime = measureTime();
            await this.eventManager.registerEvents();
            const eventsTime = getEventsTime();
            this.logger.debug(`Events registered in ${formatDuration(eventsTime)}`);

            // Login bot
            const getLoginTime = measureTime();
            await this.client.loginBot(token);
            const loginTime = getLoginTime();
            this.logger.debug(`Bot logged in in ${formatDuration(loginTime)}`);

            const totalTime = getTotalTime();
            this.logger.info([
                `Bot startup complete:`,
                `• Database: ${formatDuration(dbTime)}`,
                `• Commands: ${formatDuration(commandsTime)}`,
                `• Events: ${formatDuration(eventsTime)}`,
                `• Login: ${formatDuration(loginTime)}`,
                `Total time: ${formatDuration(totalTime)}`
            ].join('\n'));

        } catch (error) {
            this.logger.error("Failed to start bot:", error);
            process.exit(1);
        }
    }
}