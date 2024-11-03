import { ICommand } from "../../types.js";
import { DatabaseService } from "../../services/DatabaseService.js";

const WORK_COOLDOWN = 3600000; // 1 hour
const MIN_REWARD = 100;
const MAX_REWARD = 500;

const workMessages = [
    "You worked as a programmer and fixed some bugs",
    "You helped moderate a Discord server",
    "You wrote documentation for an open source project",
    "You helped test a new feature",
    "You reviewed some pull requests"
];

const work: ICommand = {
    name: "work",
    description: "Work to earn some money",
    usage: "work",
    category: "Economy",
    rateLimit: {
        usages: 1,
        duration: WORK_COOLDOWN,
        users: new Map()
    },

    async execute(msg) {
        const db = DatabaseService.getInstance();
        const userId = msg.author?.id;

        if (!userId) return;

        const economy = await db.getUserEconomy(userId);
        const now = Date.now();

        // Calculate reward
        const reward = Math.floor(Math.random() * (MAX_REWARD - MIN_REWARD + 1)) + MIN_REWARD;
        const message = workMessages[Math.floor(Math.random() * workMessages.length)];

        // Update economy
        economy.balance += reward;
        economy.lastWork = now;
        economy.workStreak += 1;

        // Bonus for streak
        const streakBonus = Math.floor(reward * (economy.workStreak * 0.1));
        if (streakBonus > 0) {
            economy.balance += streakBonus;
        }

        await db.updateUserEconomy(userId, economy);

        return msg.reply({
            embeds: [{
                title: "Work Complete!",
                description: [
                    message,
                    `\nYou earned: 💰 ${reward}`,
                    streakBonus > 0 ? `Streak Bonus: 💰 ${streakBonus}` : null,
                    `Current streak: 🔥 ${economy.workStreak}`
                ].filter(Boolean).join("\n"),
                colour: "#00ff00"
            }]
        });
    }
};

export default work; 