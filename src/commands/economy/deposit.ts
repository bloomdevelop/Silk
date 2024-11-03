import { ICommand } from "../../types.js";
import { DatabaseService } from "../../services/DatabaseService.js";

const deposit: ICommand = {
    name: "deposit",
    description: "Deposit money into your bank",
    usage: "deposit <amount|all>",
    category: "Economy",
    aliases: ["dep"],

    async execute(msg, args) {
        if (!args?.length) {
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Please specify an amount to deposit",
                    colour: "#ff0000"
                }]
            });
        }

        const db = DatabaseService.getInstance();
        const userId = msg.author?._id;
        if (!userId) return;

        const economy = await db.getUserEconomy(userId);
        let amount: number;

        if (args[0].toLowerCase() === "all") {
            amount = economy.balance;
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

        if (amount > economy.balance) {
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "You don't have enough money in your wallet",
                    colour: "#ff0000"
                }]
            });
        }

        economy.balance -= amount;
        economy.bank += amount;
        await db.updateUserEconomy(userId, economy);

        return msg.reply({
            embeds: [{
                title: "Deposit Successful",
                description: [
                    `Deposited: 💰 ${amount}`,
                    `New Balance: 💰 ${economy.balance}`,
                    `Bank Balance: 🏦 ${economy.bank}`
                ].join("\n"),
                colour: "#00ff00"
            }]
        });
    }
};

export default deposit; 