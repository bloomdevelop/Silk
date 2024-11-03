import { ICommand } from "../../types.js";
import { DatabaseService } from "../../services/DatabaseService.js";

const withdraw: ICommand = {
    name: "withdraw",
    description: "Withdraw money from your bank",
    usage: "withdraw <amount|all>",
    category: "Economy",
    aliases: ["with"],

    async execute(msg, args) {
        if (!args?.length) {
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Please specify an amount to withdraw",
                    colour: "#ff0000"
                }]
            });
        }

        const db = DatabaseService.getInstance();
        const userId = msg.author?.id;
        if (!userId) return;

        const economy = await db.getUserEconomy(userId);
        let amount: number;

        if (args[0].toLowerCase() === "all") {
            amount = economy.bank;
        } else {
            amount = parseInt(args[0]);
            if (isNaN(amount) || amount <= 0) {
                return msg.reply({
                    embeds: [{
                        title: "Error",
                        description: "Please provide a valid amount",
                        colour: "#ff0000"
                    }]
                });
            }
        }

        if (amount > economy.bank) {
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "You don't have enough money in your bank",
                    colour: "#ff0000"
                }]
            });
        }

        economy.bank -= amount;
        economy.balance += amount;
        await db.updateUserEconomy(userId, economy);

        return msg.reply({
            embeds: [{
                title: "Withdrawal Successful",
                description: [
                    `Withdrawn: 💰 ${amount}`,
                    `New Balance: 💰 ${economy.balance}`,
                    `Bank Balance: 🏦 ${economy.bank}`
                ].join("\n"),
                colour: "#00ff00"
            }]
        });
    }
};

export default withdraw; 