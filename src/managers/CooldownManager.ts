import { mainLogger } from "../utils/Logger.js";
import process from 'process';

export class CooldownManager {
    private cooldowns: Map<string, Map<string, number>>;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
    private readonly MAX_COOLDOWN = 3600000; // 1 hour

    constructor() {
        this.cooldowns = new Map();
        this.cleanupInterval = setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);

        // Add cleanup handler
        this.setupCleanupHandler();
    }

    private setupCleanupHandler(): void {
        // Handle normal exit and errors
        const cleanup = () => {
            this.destroy();
            mainLogger.debug('CooldownManager cleaned up successfully');
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('exit', cleanup);

        // Handle uncaught errors
        process.on('uncaughtException', (error) => {
            mainLogger.error('Uncaught exception in CooldownManager:', error);
            cleanup();
        });

        process.on('unhandledRejection', (reason) => {
            mainLogger.error('Unhandled rejection in CooldownManager:', reason);
            cleanup();
        });
    }

    private cleanup(): void {
        const now = Date.now();
        let cleanedEntries = 0;

        for (const [userId, commands] of this.cooldowns.entries()) {
            for (const [command, timestamp] of commands.entries()) {
                if (now - timestamp > this.MAX_COOLDOWN) {
                    commands.delete(command);
                    cleanedEntries++;
                }
            }
            if (commands.size === 0) {
                this.cooldowns.delete(userId);
            }
        }

        if (cleanedEntries > 0) {
            mainLogger.debug(`Cleaned up ${cleanedEntries} expired cooldowns`);
        }
    }

    public destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.cooldowns.clear();
    }

    isOnCooldown(userId: string, commandName: string, cooldownTime: number): boolean {
        const now = Date.now();
        const userCooldowns = this.cooldowns.get(userId) || new Map();
        const lastUsed = userCooldowns.get(commandName) || 0;

        return (now - lastUsed) < cooldownTime;
    }

    setCooldown(userId: string, commandName: string): void {
        const userCooldowns = this.cooldowns.get(userId) || new Map();
        userCooldowns.set(commandName, Date.now());
        this.cooldowns.set(userId, userCooldowns);
    }
} 