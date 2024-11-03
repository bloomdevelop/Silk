import { Client } from "revolt.js";
import type { Message } from "revolt.js";
import { CommandManager } from "./CommandManager.js";
import { DatabaseService } from "../services/DatabaseService.js";
import { Logger, mainLogger } from "../utils/Logger.js";

export class EventManager {
    private client: Client;
    private commandManager: CommandManager;
    private db: DatabaseService;
    private logger: Logger;

    constructor(client: Client, commandManager: CommandManager) {
        this.client = client;
        this.commandManager = commandManager;
        this.db = DatabaseService.getInstance();
        this.logger = mainLogger.createLogger("EventManager");
    }

    async registerEvents(): Promise<void> {
        // Message event
        this.client.on("message", async (message: Message) => {
            try {
                // Ignore bots and self
                if (message.author?.bot || message.author?._id === this.client.user?._id) {
                    return;
                }

                // Get server config for prefix
                const serverConfig = await this.db.getServerConfig(message.channel?.server?._id);
                const prefix = serverConfig.bot.prefix;

                // Check if message starts with prefix
                if (!message.content?.startsWith(prefix)) {
                    return;
                }

                // Execute command
                await this.commandManager.executeCommand(message, prefix);

            } catch (error) {
                this.logger.error("Error handling message:", error);
            }
        });

        // Ready event
        this.client.on("ready", () => {
            this.logger.info(`Logged in as ${this.client.user?.username}`);
        });
    }
}