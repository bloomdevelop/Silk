import { ILogObj, Logger as TsLogger } from "tslog";

export class Logger {
    private static instance: Logger;
    private mainLogger: TsLogger<ILogObj>;

    private constructor() {
        this.mainLogger = new TsLogger({
            name: "Main",
            type: "pretty",
            prettyLogTemplate: "{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}} [{{logLevelName}}] {{name}} > ",
            stylePrettyLogs: true,
            prettyLogTimeZone: "UTC",
        });
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    createLogger(name: string): TsLogger<ILogObj> {
        return this.mainLogger.getSubLogger({ name });
    }
}

// Export pre-configured loggers
export const mainLogger = Logger.getInstance().createLogger("Main");
export const commandLogger = Logger.getInstance().createLogger("Commands");
