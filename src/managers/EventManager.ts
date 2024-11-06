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
    private prefixCache: Map<string, { prefix: string, timestamp: number }>;

    constructor(client: Client, commandManager: CommandManager) {
        this.client = client;
        this.commandManager = commandManager;
        this.db = DatabaseService.getInstance();
        this.logger = mainLogger.createLogger("EventManager");
        this.prefixCache = new Map();
    }

    async registerEvents(): Promise<void> {
        // Message event
        this.client.on("message", async (message: Message) => {
            try {
                // Ignore bots and self
                if (message.author?.bot || message.author?._id === this.client.user?._id) {
                    return;
                }

                const serverId = message.channel?.server?._id;
                let prefix: string;

                // Check prefix cache (5 minute TTL)
                const cached = this.prefixCache.get(serverId || 'default');
                if (cached && (Date.now() - cached.timestamp) < 300000) {
                    prefix = cached.prefix;
                } else {
                    const serverConfig = await this.db.getServerConfig(serverId);
                    prefix = serverConfig.bot.prefix;
                    this.prefixCache.set(serverId || 'default', {
                        prefix,
                        timestamp: Date.now()
                    });
                }

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