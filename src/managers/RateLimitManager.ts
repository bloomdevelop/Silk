import { RateLimitConfig, RateLimitInfo } from "../types.js";
import { commandLogger } from "../utils/Logger.js";

export class RateLimitManager {
    private static instance: RateLimitManager;
    private defaultConfig: RateLimitConfig = {
        usages: 3,
        duration: 10000, // 10 seconds
        users: new Map()
    };
    private rateLimits: Map<string, RateLimitInfo> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;
    private logger = commandLogger;

    private constructor() {
        this.setupCleanupHandler();
    }

    static getInstance(): RateLimitManager {
        if (!RateLimitManager.instance) {
            RateLimitManager.instance = new RateLimitManager();
        }
        return RateLimitManager.instance;
    }

    private setupCleanupHandler(): void {
        const cleanup = () => {
            try {
                this.destroy();
                this.logger.debug('RateLimitManager cleaned up successfully');
            } catch (error) {
                this.logger.error('Error during RateLimitManager cleanup:', error);
            }
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('exit', cleanup);
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught exception in RateLimitManager:', error);
            cleanup();
        });
        process.on('unhandledRejection', (reason) => {
            this.logger.error('Unhandled rejection in RateLimitManager:', reason);
            cleanup();
        });
    }

    public destroy(): void {
        try {
            // Clear all rate limit data
            this.rateLimits.clear();
            
            // Clear cleanup interval
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
            
            this.logger.debug('RateLimitManager resources cleaned up');
        } catch (error) {
            this.logger.error('Error during RateLimitManager cleanup:', error);
            throw error;
        }
    }

    isRateLimited(userId: string, config: RateLimitConfig = this.defaultConfig): boolean {
        const now = Date.now();
        config.users = config.users || new Map();

        // Get user's rate limit info
        let userLimit = config.users.get(userId);

        // If no existing rate limit or it has expired, create new
        if (!userLimit || userLimit.resetTime <= now) {
            userLimit = {
                usages: 0,
                resetTime: now + config.duration,
                lastUsed: now
            };
            config.users.set(userId, userLimit);
        }

        // Check if user has exceeded rate limit
        if (userLimit.usages >= config.usages) {
            const timeLeft = Math.ceil((userLimit.resetTime - now) / 1000);
            commandLogger.debug(`Rate limit exceeded for user ${userId}. Reset in ${timeLeft}s. Last used: ${new Date(userLimit.lastUsed || 0).toISOString()}`);
            return true;
        }

        // Update usage info
        userLimit.usages++;
        userLimit.lastUsed = now;
        return false;
    }

    getRemainingTime(userId: string, config: RateLimitConfig): number {
        const userLimit = config.users?.get(userId);
        if (!userLimit) return 0;
        
        const now = Date.now();
        return Math.max(0, userLimit.resetTime - now);
    }

    getUsageInfo(userId: string, config: RateLimitConfig): RateLimitInfo | null {
        return config.users?.get(userId) || null;
    }

    resetLimit(userId: string, config: RateLimitConfig): void {
        config.users?.delete(userId);
    }

    cleanupExpiredLimits(config: RateLimitConfig): void {
        const now = Date.now();
        config.users?.forEach((limit, userId) => {
            if (limit.resetTime <= now) {
                config.users?.delete(userId);
            }
        });
    }
} 