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
    private readonly CACHE_TTL = 300000; // 5 minutes
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(client: Client, commandManager: CommandManager) {
        this.client = client;
        this.commandManager = commandManager;
        this.db = DatabaseService.getInstance();
        this.logger = mainLogger.createLogger("EventManager");
        this.prefixCache = new Map();
        
        // Set up cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanupCache(), this.CACHE_TTL);
        
        // Add cleanup handler
        this.setupCleanupHandler();
    }

    private setupCleanupHandler(): void {
        // Handle normal exit and errors
        const cleanup = () => {
            this.destroy();
            this.logger.debug('EventManager cleaned up successfully');
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('exit', cleanup);

        // Handle uncaught errors
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught exception in EventManager:', error);
            cleanup();
        });

        process.on('unhandledRejection', (reason) => {
            this.logger.error('Unhandled rejection in EventManager:', reason);
            cleanup();
        });
    }

    async registerEvents(): Promise<void> {
        this.client.on("message", async (message: Message) => {
            try {
                // Ignore bots and self
                if (message.author?.bot || message.author?._id === this.client.user?._id) {
                    return;
                }

                const serverId = message.channel?.server?._id;
                let prefix: string;

                // Generate a unique cache key
                const cacheKey = serverId || '_direct_messages';

                // Check prefix cache (5 minute TTL)
                const cached = this.prefixCache.get(cacheKey);
                const now = Date.now();

                if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
                    prefix = cached.prefix;
                    this.logger.debug(`Using cached prefix for ${serverId ? `server ${serverId}` : 'DMs'}`);
                } else {
                    // Get fresh config and update cache
                    const serverConfig = await this.db.getServerConfig(serverId);
                    prefix = serverConfig.bot.prefix;
                    
                    this.prefixCache.set(cacheKey, {
                        prefix,
                        timestamp: now
                    });
                    
                    this.logger.debug(`Updated prefix cache for ${serverId ? `server ${serverId}` : 'DMs'}`);
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

    // Add method to clear cache entries
    private cleanupCache(): void {
        const now = Date.now();
        let cleanedEntries = 0;

        for (const [key, value] of this.prefixCache.entries()) {
            if (now - value.timestamp >= this.CACHE_TTL) {
                this.prefixCache.delete(key);
                cleanedEntries++;
            }
        }

        if (cleanedEntries > 0) {
            this.logger.debug(`Cleaned up ${cleanedEntries} expired prefix cache entries`);
        }
    }

    // Add destroy method for cleanup
    public destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.prefixCache.clear();
        this.logger.debug('EventManager destroyed successfully');
    }
}