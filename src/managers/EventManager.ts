import { Client } from "revolt.js";
import type { Message } from "revolt.js";
import { CommandManager } from "./CommandManager.js";
import { DatabaseService } from "../services/DatabaseService.js";
import { Logger, mainLogger } from "../utils/Logger.js";
import { ProcessManager } from "../utils/ProcessManager.js";

export class EventManager {
    private client: Client;
    private commandManager: CommandManager;
    private db: DatabaseService;
    private logger: Logger;
    private prefixCache: Map<string, { prefix: string, timestamp: number }>;
    private readonly CACHE_TTL = 300000; // 5 minutes
    private cleanupInterval: NodeJS.Timeout | null = null;
    private isRegistered: boolean = false;
    private messageHandlerBound: ((message: Message) => Promise<void>) | null = null;
    private readyHandlerBound: (() => void) | null = null;
    private messageHandled = new Set<string>(); // Track handled message IDs
    private readonly MESSAGE_TRACKING_TTL = 5000; // 5 seconds

    constructor(client: Client, commandManager: CommandManager) {
        this.client = client;
        this.commandManager = commandManager;
        this.db = DatabaseService.getInstance();
        this.logger = mainLogger.createLogger("EventManager");
        this.prefixCache = new Map();
        
        // Set up cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanupCache(), this.CACHE_TTL);
        
        // Register cleanup with ProcessManager
        ProcessManager.getInstance().registerCleanupFunction(() => this.destroy());
    }

    async registerEvents(): Promise<void> {
        try {
            // Check if events are already registered
            if (this.isRegistered) {
                this.logger.warn('Events are already registered, skipping registration');
                return;
            }

            this.logger.debug('Starting event registration...');

            // First, remove any existing event listeners
            this.removeEventListeners();

            // Create new bound event handlers
            this.messageHandlerBound = this.messageHandler.bind(this);
            this.readyHandlerBound = this.readyHandler.bind(this);

            // Register event handlers
            this.client.on("message", this.messageHandlerBound);
            this.client.on("ready", this.readyHandlerBound);

            this.isRegistered = true;
            this.logger.info('Events registered successfully');
        } catch (error) {
            this.logger.error('Error registering events:', error);
            this.isRegistered = false; // Reset flag on error
            throw error;
        }
    }

    private async messageHandler(message: Message): Promise<void> {
        try {
            // Check if message was already handled
            if (this.messageHandled.has(message._id)) {
                this.logger.debug(`Skipping already handled message: ${message._id}`);
                return;
            }

            // Add message to handled set
            this.messageHandled.add(message._id);
            
            // Clean up old message IDs after TTL
            setTimeout(() => {
                this.messageHandled.delete(message._id);
            }, this.MESSAGE_TRACKING_TTL);

            // Ignore bots and self
            if (message.author?.bot || message.author?._id === this.client.user?._id) {
                this.logger.debug(`Ignoring message from bot: ${message.author?.username}`);
                return;
            }

            const serverId = message.channel?.server?._id;
            let prefix: string;

            // Generate a unique cache key
            const cacheKey = serverId || '_direct_messages';
            this.logger.debug(`Processing message in ${serverId ? `server ${serverId}` : 'DMs'}`);

            // Check prefix cache
            const cached = this.prefixCache.get(cacheKey);
            const now = Date.now();

            if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
                prefix = cached.prefix;
                this.logger.debug(`Using cached prefix: ${prefix}`);
            } else {
                this.logger.debug(`Fetching prefix for ${cacheKey}`);
                const serverConfig = await this.db.getServerConfig(serverId);
                prefix = serverConfig.bot.prefix;
                
                this.prefixCache.set(cacheKey, {
                    prefix,
                    timestamp: now
                });
                this.logger.debug(`Updated prefix cache for ${cacheKey}: ${prefix}`);
            }

            // Check if message starts with prefix
            if (!message.content?.startsWith(prefix)) {
                this.logger.debug('Message does not start with prefix, ignoring');
                return;
            }

            this.logger.debug(`Executing command from message: ${message.content}`);
            // Execute command
            await this.commandManager.executeCommand(message, prefix);

        } catch (error) {
            this.logger.error("Error handling message:", error);
            this.logger.debug("Message details:", {
                content: message.content,
                author: message.author?.username,
                serverId: message.channel?.server?._id
            });
        }
    }

    private readyHandler(): void {
        this.logger.info(`Bot logged in as ${this.client.user?.username}`);
        this.logger.debug('Ready event handler executed');
    }

    private removeEventListeners(): void {
        if (!this.isRegistered) {
            this.logger.debug('No event listeners to remove');
            return;
        }

        this.logger.debug('Removing existing event listeners...');

        // Remove all existing listeners for these events
        this.client.removeAllListeners('message');
        this.client.removeAllListeners('ready');

        // Clear the bound handlers
        this.messageHandlerBound = null;
        this.readyHandlerBound = null;
        this.isRegistered = false;

        this.logger.debug('Event listeners removed successfully');
    }

    private cleanupCache(): void {
        const now = Date.now();
        let cleanedEntries = 0;

        this.logger.debug('Starting prefix cache cleanup...');

        for (const [key, value] of this.prefixCache.entries()) {
            if (now - value.timestamp >= this.CACHE_TTL) {
                this.prefixCache.delete(key);
                cleanedEntries++;
            }
        }

        if (cleanedEntries > 0) {
            this.logger.debug(`Cleaned up ${cleanedEntries} expired prefix cache entries`);
        } else {
            this.logger.debug('No expired cache entries to clean up');
        }
    }

    public destroy(): void {
        this.logger.debug('Starting EventManager cleanup...');

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            this.logger.debug('Cleanup interval cleared');
        }
        
        if (this.isRegistered) {
            this.removeEventListeners();
        }
        
        this.prefixCache.clear();
        this.messageHandled.clear(); // Clear message tracking set
        this.logger.info('EventManager destroyed successfully');
    }
}