type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
    private static instance: Logger;
    private context: string;

    private constructor(context: string) {
        this.context = context;
    }

    static getInstance(context: string = 'default'): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(context);
        }
        return Logger.instance;
    }

    private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message} ${args.length ? JSON.stringify(args) : ''}`;
    }

    debug(message: string, ...args: any[]): void {
        console.debug(this.formatMessage('debug', message, ...args));
    }

    info(message: string, ...args: any[]): void {
        console.info(this.formatMessage('info', message, ...args));
    }

    warn(message: string, ...args: any[]): void {
        console.warn(this.formatMessage('warn', message, ...args));
    }

    error(message: string, ...args: any[]): void {
        console.error(this.formatMessage('error', message, ...args));
    }
}

// Create and export a main logger instance
export const mainLogger = Logger.getInstance('Main');
export const commandLogger = Logger.getInstance('Command');
