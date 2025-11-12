import type { Client, Message } from "stoat.js";
import { Logger } from "../utils/Logger.js";
import { DatabaseService } from "./DatabaseService.js";
import type { AutoModConfig, AutoModViolation } from "../types.js";
import { RateLimitHandler } from "../utils/RateLimitHandler.js";

// Define MessageHistory interface
interface MessageHistory {
    timestamps: number[];
    violations: number;
    lastMessage?: number;
}

export class AutoModService {
    private static instance: AutoModService | null = null;
    private readonly logger: Logger;
    private readonly db: DatabaseService;
    private messageHistory: Map<string, MessageHistory>;
    private readonly HISTORY_CLEANUP_INTERVAL = 1800000; // 30 minutes
    private readonly HISTORY_WINDOW = 10000; // 10 seconds window for spam detection
    private cleanupInterval: NodeJS.Timeout | null = null;
    private client: Client | null = null;

    private constructor() {
        this.logger = Logger.getInstance('AutoMod');
        this.db = DatabaseService.getInstance();
        this.messageHistory = new Map();
        this.startCleanupInterval();
        this.setupCleanupHandler();
    }

    public static getInstance(): AutoModService {
        if (!AutoModService.instance) {
            AutoModService.instance = new AutoModService();
        }
        return AutoModService.instance;
    }

    private startCleanupInterval(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupMessageHistory();
        }, this.HISTORY_CLEANUP_INTERVAL);
    }

    private setupCleanupHandler(): void {
        const cleanup = async () => {
            try {
                await this.destroy();
                this.logger.debug('AutoModService cleaned up successfully');
            } catch (error) {
                this.logger.error('Error during AutoModService cleanup:', error);
            }
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('exit', cleanup);
        process.on('uncaughtException', async (error) => {
            this.logger.error('Uncaught exception in AutoModService:', error);
            await cleanup();
        });
        process.on('unhandledRejection', async (reason) => {
            this.logger.error('Unhandled rejection in AutoModService:', reason);
            await cleanup();
        });
    }

    public async destroy(): Promise<void> {
        try {
            // Clear all caches and rules
            // this.rules.clear();
            // this.ruleCache.clear();
            // this.violationCache.clear();
            
            // Cancel any pending operations
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }
            
            // Remove all listeners
            process.removeAllListeners('SIGINT');
            process.removeAllListeners('SIGTERM');
            process.removeAllListeners('exit');
            process.removeAllListeners('uncaughtException');
            process.removeAllListeners('unhandledRejection');
            
            this.messageHistory.clear();
            this.client = null;
            AutoModService.instance = null;
            this.logger.info('AutoMod service destroyed');
            this.logger.debug('AutoModService resources cleaned up');
        } catch (error) {
            this.logger.error('Error during AutoModService cleanup:', error);
            throw error;
        }
    }

    private cleanupMessageHistory(): void {
        const now = Date.now();
        const expiryTime = 3600000; // 1 hour

        for (const [userId, history] of this.messageHistory) {
            if (now - (history.lastMessage || 0) > expiryTime) {
                this.messageHistory.delete(userId);
            }
        }
        this.logger.debug('Message history cleanup completed');
    }

    public async initialize(client: Client): Promise<void> {
        try {
            this.logger.info('Initializing AutoMod service');
            this.client = client;
            
            // Wait for client to be ready
            if (!client.user) {
                this.logger.debug('Waiting for client to be ready...');
                await new Promise<void>((resolve) => {
                    client.on('ready', () => {
                        this.logger.debug('Client ready, continuing initialization');
                        resolve();
                    });
                });
            }

            // Now we can safely access servers
            const serverIds = Array.from(client.servers.keys()) as string[];
            const servers = await Promise.all(
                serverIds.map(async (serverId: string) => {
                    const config = await this.db.getServerConfig(serverId);
                    this.logger.debug(`Loaded AutoMod config for server: ${serverId}`);
                    return { server_id: serverId, config };
                })
            );

            this.logger.info(`AutoMod service initialized successfully for ${servers.length} servers`);
        } catch (error) {
            this.logger.error('Failed to initialize AutoMod service:', error);
            throw error;
        }
    }

    private async isExempt(message: Message, config: AutoModConfig): Promise<boolean> {
        // Check user whitelist
        if (!message.author) return false;
        if (config.whitelist.users.includes(message.author.id)) return true;

        // Check channel whitelist
        if (config.whitelist.channels.includes(message.channelId)) return true;

        // Check role whitelist (if in a server)
        if (message.channel?.server) {
            const member = await message.channel.server.fetchMember(message.author.id);
            if (member?.roles?.some(role => config.whitelist.roles.includes(role))) {
                return true;
            }
        }

        return false;
    }

    private checkSpam(message: Message, config: AutoModConfig): boolean {
        if (!message.author) return false;
        
        const userId = message.author.id;
        const now = Date.now();

        if (!this.messageHistory.has(userId)) {
            this.messageHistory.set(userId, { 
                timestamps: [now], 
                violations: 0,
                lastMessage: now 
            });
            return false;
        }

        const history = this.messageHistory.get(userId);

        if (!history) return false;
        
        // Keep only messages within the time window
        history.timestamps = history.timestamps.filter(
            timestamp => now - timestamp < this.HISTORY_WINDOW
        );
        history.timestamps.push(now);
        history.lastMessage = now;

        // Check for duplicate messages (exact same content)
        const duplicateCount = message.content ? 
            history.timestamps.length : 0;

        // Check for message burst (too many messages too quickly)
        const burstViolation = history.timestamps.length > config.thresholds.messageBurst;

        // Check for rapid repeat messages (same content sent quickly)
        const rapidRepeatViolation = duplicateCount >= 3;

        // Update violation count if any spam type is detected
        if (burstViolation || rapidRepeatViolation) {
            history.violations++;
            
            // Log the specific type of spam detected
            this.logger.warn(
                `Spam detected from user ${message.author?.username} (${message.author.id}):`,
                {
                    burstViolation,
                    rapidRepeatViolation,
                    messageCount: history.timestamps.length,
                    duplicateCount,
                    violations: history.violations
                }
            );

            return true;
        }

        // Gradually reduce violations if user behaves
        if (history.violations > 0 && history.timestamps.length <= config.thresholds.messageBurst / 2) {
            history.violations = Math.max(0, history.violations - 0.5);
        }

        return false;
    }

    private checkMentions(message: Message, config: AutoModConfig): boolean {
        const mentions = message.content?.match(/@/g)?.length || 0;
        return mentions > config.thresholds.maxMentions;
    }

    private checkCaps(message: Message, config: AutoModConfig): boolean {
        if (!message.content) return false;

        const capsCount = message.content.replace(/[^A-Z]/g, '').length;
        const totalLength = message.content.replace(/\s/g, '').length;

        return totalLength > 8 && (capsCount / totalLength) > (config.thresholds.maxCaps / 100);
    }

    private checkLinks(message: Message, config: AutoModConfig): boolean {
        if (!message.content) return false;

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const links = message.content.match(urlRegex) || [];

        return links.some(link =>
            !config.whitelist.links.some(allowed => link.includes(allowed))
        );
    }

    private checkInvites(message: Message): boolean {
        if (!message.content) return false;

        const inviteRegex = /(revolt\.chat\/invite|stoat\.gg\/invite)/i;
        return inviteRegex.test(message.content);
    }

    private async handleViolation(
        message: Message,
        violation: AutoModViolation,
        config: AutoModConfig
    ): Promise<void> {
        if (!message.channel || !message.author) return;

        this.logger.warn(
            `AutoMod violation: ${violation.type} by ${message.author?.username} in ${message.channel.id}`,
            violation.details
        );

        try {
            if (config.actions.delete) {
                await message.delete();
            }

            // Record violation in database
            await this.db.recordAutoModViolation(violation);

            // Update user's violation count
            const history = this.messageHistory.get(message.author.id);
            if (history) {
                history.violations++;

                // Handle timeout if configured and violations exceed threshold
                if (config.actions.timeout && history.violations >= 3) {
                    await this.handleTimeout(message, config.actions.timeout);
                    // Reset violations after timeout
                    history.violations = 0;
                }
            }

        } catch (error) {
            this.logger.error('Error handling AutoMod violation:', error);
        }
    }

    async processMessage(message: Message): Promise<void> {
        try {
            // Skip processing for system messages or bot messages
            if (!message.author || message.author.bot) return;

            await RateLimitHandler.executeWithRetry(async () => {
                const config = await this.db.getAutoModConfig(message.channel?.server?.id);
                if (!config.enabled) return;

                // Check exemptions first
                if (await this.isExempt(message, config)) return;

                const violations: AutoModViolation[] = [];

                // Check for spam first since it's most common
                if (config.filters.spam && this.checkSpam(message, config)) {
                    if (!message.author || !message.channel) return;

                    const history = this.messageHistory.get(message.author.id);
                    violations.push({
                        type: 'spam',
                        userId: message.author.id,
                        channelId: message.channel.id,
                        messageId: message.id,
                        timestamp: Date.now(),
                        details: `Message rate exceeded threshold. Violations: ${history?.violations}`
                    });

                    // Apply escalating actions based on violation count
                    if (history && history.violations >= 3) {
                        // Apply timeout for repeated violations
                        await this.handleTimeout(message, config.actions.timeout || 5);
                        history.violations = 0; // Reset after timeout
                    }
                }

                if (config.filters.mentions && this.checkMentions(message, config)) {
                    if (!message.author || !message.channel) return;

                    violations.push({
                        type: 'mentions',
                        userId: message.author.id,
                        channelId: message.channel.id,
                        messageId: message.id,
                        timestamp: Date.now(),
                        details: `Excessive mentions: ${message.content?.match(/@/g)?.length}`
                    });
                }

                if (config.filters.caps && this.checkCaps(message, config)) {
                    if (!message.author || !message.channel) return;

                    violations.push({
                        type: 'caps',
                        userId: message.author.id,
                        channelId: message.channel.id,
                        messageId: message.id,
                        timestamp: Date.now(),
                        details: 'Excessive capital letters'
                    });
                }

                if (config.filters.links && this.checkLinks(message, config)) {
                    if (!message.author || !message.channel) return;

                    violations.push({
                        type: 'links',
                        userId: message.author.id,
                        channelId: message.channel.id,
                        messageId: message.id,
                        timestamp: Date.now(),
                        details: 'Unauthorized link detected'
                    });
                }

                if (config.filters.invites && this.checkInvites(message)) {
                    if (!message.author || !message.channel) return;

                    violations.push({
                        type: 'invites',
                        userId: message.author.id,
                        channelId: message.channel.id,
                        messageId: message.id,
                        timestamp: Date.now(),
                        details: 'Server invite link detected'
                    });
                }

                // Handle all violations
                for (const violation of violations) {
                    await RateLimitHandler.executeWithRetry(() => 
                        this.handleViolation(message, violation, config)
                    );

                    // Send warning message if enabled
                    if (config.actions.warn) {
                        try {
                            if (!message.author || !message.channel) return;

                            await message.channel?.sendMessage({
                                content: [
                                    `<@${message.author.id}>, please follow the server rules.`,
                                    `Violation: ${violation.type}`,
                                    violation.type === 'spam' ? 
                                        "Continuing to spam may result in a timeout." : ""
                                ].filter(Boolean).join(" ")
                            });
                        } catch (error) {
                            this.logger.error('Error sending warning message:', error);
                        }
                    }
                }
            });

        } catch (error) {
            this.logger.error('Error in AutoMod processing:', error);
        }
    }

    private async handleTimeout(message: Message, duration: number): Promise<void> {
        try {
            const channel = message.channel;
            const server = channel?.server;
            if (!server || !this.client) {
                this.logger.warn('Cannot handle timeout: Missing server or client');
                return;
            }

            await RateLimitHandler.executeWithRetry(async () => {
                const botMember = await server.fetchMember(this.client?.user?.id || '');
                if (!botMember) {
                    this.logger.warn('Could not fetch bot member');
                    return;
                }

                // Check if bot has the required permissions in the server
                const hasPermission = botMember.hasPermission(server, 'TimeoutMembers');
                if (!hasPermission) {
                    this.logger.warn('Bot lacks permission to timeout members');
                    return;
                }

                if (!message.author) return;

                const member = await server.fetchMember(message.author.id);
                if (!member) return;

                // Calculate timeout end time
                const timeoutUntil = new Date(Date.now() + duration * 60 * 1000);

                // Set the timeout property with retry handling
                member.timeout?.setDate(timeoutUntil.getTime());
                this.logger.info(`Applied ${duration} minute timeout to ${member.user?.username}`);

                // Notify user using client's channel
                try {
                    await RateLimitHandler.executeWithRetry(async () => {
                        if (!message.author) return;

                        const response = await channel.sendMessage({
                            content: `<@${message.author.id}> has been timed out for ${duration} minutes due to multiple violations.`
                        });
                        if (!response) {
                            throw new Error('Failed to send message');
                        }
                        return response;
                    });
                } catch (error) {
                    this.logger.error('Error sending timeout notification:', error);
                }
            }, {
                maxRetries: 3,
                baseDelay: 1000,
                maxDelay: 5000
            });

        } catch (error) {
            this.logger.error('Error applying timeout:', error);
        }
    }

    // Add method to get user's violation history
    async getUserViolations(userId: string): Promise<number> {
        const history = this.messageHistory.get(userId);
        return history?.violations || 0;
    }

    // Add method to reset user's violations
    resetUserViolations(userId: string): void {
        const history = this.messageHistory.get(userId);
        if (history) {
            history.violations = 0;
        }
    }
} 