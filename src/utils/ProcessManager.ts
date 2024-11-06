import { Logger } from "./Logger.js";

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
        const cleanup = async () => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;

            this.logger.info('Starting graceful shutdown...');
            
            for (const fn of this.cleanupFunctions) {
                try {
                    await Promise.resolve(fn());
                } catch (error) {
                    this.logger.error('Error during cleanup:', error);
                }
            }

            this.logger.info('Cleanup completed');
            process.exit(0);
        };

        // Handle normal termination signals
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('exit', cleanup);

        // Handle uncaught errors
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught exception:', error);
            cleanup();
        });

        process.on('unhandledRejection', (reason) => {
            this.logger.error('Unhandled rejection:', reason);
            cleanup();
        });
    }

    registerCleanupFunction(fn: CleanupFunction): void {
        this.cleanupFunctions.add(fn);
    }

    unregisterCleanupFunction(fn: CleanupFunction): void {
        this.cleanupFunctions.delete(fn);
    }
} 