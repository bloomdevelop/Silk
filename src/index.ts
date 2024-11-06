import { config } from "dotenv";
import { Bot } from "./Bot.js";
import { mainLogger } from "./utils/Logger.js";

// Load environment variables
config();
const bot = Bot.getInstance();

bot.start()

process.on("uncaughtException", (error) => {
    mainLogger.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason) => {
    mainLogger.error("Unhandled Rejection:", reason);
});
