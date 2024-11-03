import { Client } from "revolt.js";
import { CommandManager } from "./managers/CommandManager.js";
import { EventManager } from "./managers/EventManager.js";
import { Logger, mainLogger } from "./utils/Logger.js";

export class Bot {
    private static instance: Bot;
    private client: Client;
    private logger: Logger;
    private commandManager: CommandManager;
    private eventManager: EventManager;

    private constructor() {
        this.client = new Client();
        this.logger = mainLogger.createLogger("Bot");
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
            const token = process.env.TOKEN;
            if (!token) {
                throw new Error("No token provided in environment variables");
            }

            // Load commands first
            await this.commandManager.loadCommands();
            this.logger.info("Commands loaded successfully");

            // Register events
            await this.eventManager.registerEvents();
            this.logger.info("Events registered successfully");

            // Login bot
            await this.client.loginBot(token);
            this.logger.info("Bot started successfully");

        } catch (error) {
            this.logger.error("Failed to start bot:", error);
            process.exit(1);
        }
    }
}