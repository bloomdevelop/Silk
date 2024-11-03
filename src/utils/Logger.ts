import chalk from "chalk";

export class Logger {
    private name: string;
    private static instance: Logger;

    private constructor() {
        this.name = "Main";
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    createLogger(name: string): Logger {
        const logger = new Logger();
        logger.name = name;
        return logger;
    }

    log(level: string, message: string, ...args: any[]): void {
        console.log(chalk.gray(`[${this.name}] ${level}:`), message, ...args);
    }

    info(message: string, ...args: any[]): void {
        console.log(chalk.blue(`[${this.name}] INFO:`), message, ...args);
    }

    error(message: string, ...args: any[]): void {
        console.error(chalk.red(`[${this.name}] ERROR:`), message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        console.warn(chalk.yellow(`[${this.name}] WARN:`), message, ...args);
    }

    debug(message: string, ...args: any[]): void {
        console.debug(chalk.gray(`[${this.name}] DEBUG:`), message, ...args);
    }

    trace(message: string, ...args: any[]): void {
        console.debug(chalk.gray(`[${this.name}] TRACE:`), message, ...args);
    }

    fatal(message: string, ...args: any[]): void {
        console.error(chalk.red.bold(`[${this.name}] FATAL:`), message, ...args);
    }

    silly(message: string, ...args: any[]): void {
        console.log(chalk.magenta(`[${this.name}] SILLY:`), message, ...args);
    }
}

export const mainLogger = Logger.getInstance();
export const commandLogger = mainLogger.createLogger("Commands");
