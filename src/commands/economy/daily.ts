import { ICommand } from "../../types.js";
import { DatabaseService } from "../../services/DatabaseService.js";

const DAILY_AMOUNT = 1000;
const DAILY_COOLDOWN = 86400000; // 24 hours

const daily: ICommand = {
    name: "daily",
    description: "Claim your daily reward",
    usage: "daily",
    category: "Economy",
    rateLimit: {
        usages: 1,
        duration: DAILY_COOLDOWN,
        users: new Map()
    },

    async execute(msg) {
        const db = DatabaseService.getInstance();
        const userId = msg.author?._id;

        if (!userId) return;

        const economy = await db.getUserEconomy(userId);
        
        // Update economy
        economy.balance += DAILY_AMOUNT;
        economy.lastDaily = Date.now();

        await db.updateUserEconomy(userId, economy);

        return msg.reply({
            embeds: [{
                title: "Daily Reward Claimed!",
                description: `You received 💰 ${DAILY_AMOUNT}!\nCome back tomorrow for another reward!`,
                colour: "#00ff00"
            }]
        });
    }
};

export default daily; 