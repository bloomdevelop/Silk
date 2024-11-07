import { Logger } from "../utils/Logger.js";

type CleanupFunction = () => void;

export class ProcessManager {
    private static instance: ProcessManager;
    private cleanupFunctions: Set<CleanupFunction>;
    private isShuttingDown: boolean;
    private logger = Logger.getInstance("ProcessManager");

    private constructor() {
        this.cleanupFunctions = new Set();
        this.isShuttingDown = false;
        this.setupProcessHandlers();
    }

    static getInstance(): ProcessManager {
        if (!ProcessManager.instance) {
            ProcessManager.instance = new ProcessManager();
        }
        return ProcessManager.instance;
    }

    private setupProcessHandlers(): void {
        const cleanup = async (signal?: string) => {
            if (this.isShuttingDown) {
                this.logger.debug('Cleanup already in progress, skipping...');
                return;
            }

            this.isShuttingDown = true;
            this.logger.info(`Starting graceful shutdown${signal ? ` (${signal})` : ''}...`);

            for (const fn of this.cleanupFunctions) {
                try {
                    await Promise.resolve(fn());
                } catch (error) {
                    this.logger.error('Error during cleanup:', error);
                }
            }

            // Clear cleanup functions to prevent multiple executions
            this.cleanupFunctions.clear();

            this.logger.info('Cleanup completed');

            // Give a small delay for final logs to be written
            setTimeout(() => {
                Logger.cleanup();
                process.exit(0);
            }, 100);
        };

        // Handle normal termination signals
        process.once('SIGINT', () => cleanup('SIGINT'));
        process.once('SIGTERM', () => cleanup('SIGTERM'));

        // Handle uncaught errors
        process.once('uncaughtException', (error) => {
            this.logger.error('Uncaught exception:', error);
            cleanup('uncaughtException').then(() => process.exit(1));
        });

        process.once('unhandledRejection', (reason) => {
            this.logger.error('Unhandled rejection:', reason);
            cleanup('unhandledRejection').then(() => process.exit(1));
        });
    }

    registerCleanupFunction(fn: CleanupFunction): void {
        this.cleanupFunctions.add(fn);
    }

    unregisterCleanupFunction(fn: CleanupFunction): void {
        this.cleanupFunctions.delete(fn);
    }
} 