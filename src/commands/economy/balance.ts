import { ICommand } from "../../types.js";
import { DatabaseService } from "../../services/DatabaseService.js";

const balance: ICommand = {
    name: "balance",
    description: "Check your or another user's balance",
    usage: "balance [user]",
    category: "Economy",
    aliases: ["bal", "money"],
    
    async execute(msg, args) {
        const db = DatabaseService.getInstance();
        const serverId = msg.channel?.server?._id;
        
        // Check if economy is enabled
        const config = await db.getServerConfig(serverId || '');
        if (!config.features.experiments.economy) {
            return msg.reply({
                embeds: [{
                    title: "Feature Disabled",
                    description: "Economy commands are disabled on this server",
                    colour: "#ff0000"
                }]
            });
        }

        const targetId = args[0]?.trim() || msg.author?._id;
        
        if (!targetId) {
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Could not determine target user",
                    colour: "#ff0000"
                }]
            });
        }

        const economy = await db.getUserEconomy(targetId);
        const isOwnBalance = targetId === msg.author?._id;

        return msg.reply({
            embeds: [{
                title: `${isOwnBalance ? "Your" : "User's"} Balance`,
                description: [
                    `💰 Wallet: ${economy.balance}`,
                    `🏦 Bank: ${economy.bank}`,
                    `📊 Net Worth: ${economy.balance + economy.bank}`
                ].join("\n"),
                colour: "#00ff00"
            }]
        });
    }
};

export default balance; 