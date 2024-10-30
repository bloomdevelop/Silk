import { Bot } from "./Bot";
import { mainLogger } from "./utils/Logger";

const startup = Date.now();
const bot = new Bot();

bot.start()
    .then(() => {
        mainLogger.info(`Bot started in ${Date.now() - startup}ms`);
    })
    .catch((error) => {
        mainLogger.error("Failed to start bot:", error);
        process.exit(1);
    });
