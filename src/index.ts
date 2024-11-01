import { Bot } from "./Bot.js";
import { mainLogger } from "./utils/Logger.js";

const startup = Date.now();
const bot = new Bot();

bot.start()
    .then(() => {
        mainLogger.info(`Bot started in ${Date.now() - startup}ms`);
    })
    .catch((error: Error) => {
        mainLogger.error("Failed to start bot:", error);
        process.exit(1);
    });
