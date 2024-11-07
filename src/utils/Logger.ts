import chalk from "chalk";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
    private static instances: Map<string, Logger> = new Map();
    private context: string;
    private static isShuttingDown: boolean = false;
    private static hasLoggedCleanupError: boolean = false;

    private constructor(context: string) {
        this.context = context;
    }

    static getInstance(context: string = 'default'): Logger {
        if (!this.instances.has(context)) {
            this.instances.set(context, new Logger(context));
        }
        return this.instances.get(context)!;
    }

    static cleanup(): void {
        if (this.isShuttingDown) {
            // If already shutting down, just return
            return;
        }

        this.isShuttingDown = true;

        try {
            // Log final message before clearing instances
            const mainLogger = this.instances.get('Main');
            if (mainLogger && !this.hasLoggedCleanupError) {
                mainLogger.info('Logger system shutting down...');

                // Give time for the final message to be processed
                setTimeout(() => {
                    this.instances.clear();
                }, 100);
            } else {
                this.instances.clear();
            }
        } catch (error) {
            // Only try to log cleanup error once
            if (!this.hasLoggedCleanupError) {
                this.hasLoggedCleanupError = true;
                console.error('Failed to cleanup logger:', error);
            }
            this.instances.clear();
        }
    }

    private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
        if (Logger.isShuttingDown) {
            return `${new Date().toISOString()} ${level.toUpperCase()} [${this.context}] ${message}`;
        }

        const timestamp = chalk.gray(new Date().toISOString());
        const levelFormatting = {
            debug: { color: chalk.blue, label: 'DEBUG' },
            info: { color: chalk.green, label: 'INFO' },
            warn: { color: chalk.yellow, label: 'WARN' },
            error: { color: chalk.red, label: 'ERROR' }
        }[level];

        const formattedLevel = levelFormatting.color(levelFormatting.label);
        const formattedContext = chalk.cyan(`[${this.context}]`);

        let formattedArgs = '';
        if (args.length) {
            formattedArgs = args.map(arg => {
                if (arg instanceof Error) {
                    return `\n${chalk.red(arg.stack || arg.message)}`;
                }
                if (typeof arg === 'object') {
                    return `\n${JSON.stringify(arg, null, 2)}`;
                }
                return ` ${arg}`;
            }).join('');
        }

        return `${timestamp} ${formattedLevel} ${formattedContext} ${chalk.white(message)}${formattedArgs}`;
    }

    private safeLog(level: LogLevel, message: string, ...args: any[]): void {
        // Allow error logs during shutdown
        if (Logger.isShuttingDown && level !== 'error') {
            return;
        }

        try {
            const formattedMessage = this.formatMessage(level, message, ...args);
            console[level](formattedMessage);
        } catch {
            // Last resort logging
            try {
                const basicMessage = `${new Date().toISOString()} ${level.toUpperCase()}: ${message}`;
                console[level](basicMessage);
            } catch {
                // If even basic logging fails, give up silently
            }
        }
    }

    debug(message: string, ...args: any[]): void {
        if (process.env.NODE_ENV !== 'production') {
            this.safeLog('debug', message, ...args);
        }
    }

    info(message: string, ...args: any[]): void {
        this.safeLog('info', message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.safeLog('warn', message, ...args);
    }

    error(message: string, ...args: any[]): void {
        this.safeLog('error', message, ...args);
    }
}

export const mainLogger = Logger.getInstance("Main");
export const eventLogger = Logger.getInstance("Event");
export const dbLogger = Logger.getInstance("Database");
export const commandLogger = Logger.getInstance("Command");
