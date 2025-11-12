import type { Client, Message } from 'stoat.js';
import type { CommandManager } from './CommandManager.js';
import { DatabaseService } from '../services/DatabaseService.js';
import { Logger } from '../utils/Logger.js';
import { ProcessManager } from './ProcessManager.js';
import type { Bot } from '../Bot.js';

export class EventManager {
    private client: Client;
    private commandManager: CommandManager;
    private db: DatabaseService;
    private logger: Logger;
    private bot: Bot;
    private prefixCache: Map<
        string,
        { prefix: string; timestamp: number }
    >;
    private readonly CACHE_TTL = 300000; // 5 minutes
    private cleanupInterval: NodeJS.Timeout | null = null;
    private isRegistered = false;
    private messageHandlerBound:
        | ((message: Message) => Promise<void>)
        | null = null;
    private readyHandlerBound: (() => void) | null = null;
    private handledMessages = new Set<string>();
    private processingMessages = new Set<string>();
    private readonly MESSAGE_TTL = 5000; // 5 seconds

    constructor(
        client: Client,
        commandManager: CommandManager,
        bot: Bot,
    ) {
        this.client = client;
        this.commandManager = commandManager;
        this.db = DatabaseService.getInstance();
        this.logger = Logger.getInstance('EventManager');
        this.bot = bot;
        this.prefixCache = new Map();

        // Set up cleanup interval
        this.cleanupInterval = setInterval(
            () => this.cleanupCache(),
            this.CACHE_TTL,
        );

        // Register cleanup with ProcessManager
        ProcessManager.getInstance().registerCleanupFunction(() =>
            this.destroy(),
        );
    }

    async registerEvents(): Promise<void> {
        try {
            // Check if events are already registered
            if (this.isRegistered) {
                this.logger.warn(
                    'Events are already registered, skipping registration',
                );
                return;
            }

            this.logger.debug('Starting event registration...');

            // First, remove any existing event listeners
            this.removeEventListeners();

            // Create new bound event handlers
            this.messageHandlerBound = this.messageHandler.bind(this);
            this.readyHandlerBound = this.readyHandler.bind(this);

            // Register event handlers
            this.client.on('message', this.messageHandlerBound);
            this.client.on('ready', this.readyHandlerBound);

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
            // Process message through AutoMod first
            await this.bot.autoMod.processMessage(message);

            // Continue with regular command processing
            // Create a unique message identifier
            const messageId = message.id;

            // Check if we've already handled this message
            if (this.handledMessages.has(messageId)) {
                this.logger.debug(
                    `Skipping duplicate message: ${messageId}`,
                );
                return;
            }

            // Check if this specific message is being processed
            if (this.processingMessages.has(messageId)) {
                this.logger.debug(
                    `Message ${messageId} is already being processed`,
                );
                return;
            }

            // Mark this specific message as being processed
            this.processingMessages.add(messageId);

            // Add to handled messages and set cleanup
            this.handledMessages.add(messageId);
            setTimeout(() => {
                this.handledMessages.delete(messageId);
            }, this.MESSAGE_TTL);

            // Ignore bots and self
            if (
                message.author?.bot ||
                message.author?.id === this.client.user?.id
            ) {
                this.logger.debug(
                    `Ignoring message from bot: ${message.author?.username}`,
                );
                return;
            }

            const serverId = message.channel?.server?.id;
            let prefix: string;

            // Generate a unique cache key
            const cacheKey = serverId || '_direct_messages';

            // Check prefix cache
            const cached = this.prefixCache.get(cacheKey);
            const now = Date.now();

            if (cached && now - cached.timestamp < this.CACHE_TTL) {
                prefix = cached.prefix;
                this.logger.debug(
                    `Using cached prefix for ${cacheKey}`,
                );
            } else {
                this.logger.debug(`Fetching prefix for ${cacheKey}`);
                const serverConfig = await this.db.getServerConfig(
                    serverId || '',
                );
                prefix = serverConfig.bot.prefix;

                this.prefixCache.set(cacheKey, {
                    prefix,
                    timestamp: now,
                });
                this.logger.debug(
                    `Updated prefix cache for ${cacheKey}: ${prefix}`,
                );
            }

            // Check if message starts with prefix
            if (!message.content?.startsWith(prefix)) {
                this.logger.debug(
                    'Message does not start with prefix, ignoring',
                );
                return;
            }

            this.logger.debug(
                `Processing command from message: ${message.content}`,
            );
            await this.commandManager.executeCommand(message, prefix);
        } catch (error) {
            this.logger.error('Error handling message:', error);
        } finally {
            // Remove the processing lock for this specific message
            this.processingMessages.delete(message.id);
        }
    }

    private readyHandler(): void {
        this.logger.info(
            `Bot logged in as ${this.client.user?.username}`,
        );
        this.logger.debug('Ready event handler executed');
    }

    private removeEventListeners(): void {
        this.logger.debug('Removing existing event listeners...');

        if (this.messageHandlerBound) {
            this.client.removeListener(
                'message',
                this.messageHandlerBound,
            );
        }

        if (this.readyHandlerBound) {
            this.client.removeListener(
                'ready',
                this.readyHandlerBound,
            );
        }

        this.messageHandlerBound = null;
        this.readyHandlerBound = null;
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
            this.logger.debug(
                `Cleaned up ${cleanedEntries} expired prefix cache entries`,
            );
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
        this.handledMessages.clear();
        this.processingMessages.clear(); // Clear processing set
        this.logger.info('EventManager destroyed successfully');
    }
}
