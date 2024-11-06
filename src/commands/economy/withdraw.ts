import { ICommand } from "../../types.js";
import { DatabaseService } from "../../services/DatabaseService.js";
import { Logger } from "../../utils/Logger.js";
import { Transaction } from "@libsql/client";

const withdraw: ICommand = {
    name: "withdraw",
    description: "Withdraw money from your bank",
    usage: "withdraw <amount|all>",
    category: "Economy",
    aliases: ["with"],
    logger: Logger.getInstance("withdraw"),

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
        const userId = msg.author?._id;

        if (!userId) return;

        let transaction: Transaction;
        try {
            transaction = await db.beginTransaction();
            const economy = await db.getUserEconomy(userId);
            
            let amount: number;
            if (args[0].toLowerCase() === "all") {
                amount = economy.bank;
            } else {
                amount = parseInt(args[0]);
                if (isNaN(amount) || amount <= 0) {
                    await db.rollbackTransaction(transaction);
                    return msg.reply({
                        embeds: [{
                            title: "Error",
                            description: "Please provide a valid amount",
                            colour: "#ff0000"
                        }]
                    });
                }
            }

            if (economy.bank < amount) {
                await db.rollbackTransaction(transaction);
                return msg.reply({
                    embeds: [{
                        title: "Error",
                        description: "Insufficient funds in bank",
                        colour: "#ff0000"
                    }]
                });
            }

            // Update balances
            economy.bank -= amount;
            economy.balance += amount;
            
            try {
                await db.updateUserEconomy(userId, economy);
                await db.commitTransaction(transaction);

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
            } catch (error) {
                await db.rollbackTransaction(transaction);
                throw error;
            }
        } catch (error) {
            if (this.logger) {
                this.logger.error("Withdrawal error:", error);
            }
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "An error occurred processing your withdrawal",
                    colour: "#ff0000"
                }]
            });
        }
    }
};

export default withdraw; 