import { config } from "dotenv";
import { Bot } from "./Bot.js";
import { mainLogger } from "./utils/Logger.js";

// Load environment variables
config();

const startup = Date.now();
const bot = Bot.getInstance();

bot.start()
    .then(() => {
        const bootTime = Date.now() - startup;
        mainLogger.info(`Bot started in ${bootTime}ms`);
    })
    .catch((error) => {
        mainLogger.error("Failed to start bot:", error);
        process.exit(1);
    });

process.on("uncaughtException", (error) => {
    mainLogger.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason) => {
    mainLogger.error("Unhandled Rejection:", reason);
});
