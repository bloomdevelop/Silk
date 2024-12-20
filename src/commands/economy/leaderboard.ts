import { ICommand } from "../../types.js";
import { DatabaseService } from "../../services/DatabaseService.js";

const leaderboard: ICommand = {
    name: "leaderboard",
    description: "Show the richest users",
    usage: "leaderboard [page]",
    category: "Economy",
    aliases: ["lb", "rich"],

    async execute(msg, args) {
        const db = DatabaseService.getInstance();
        const page = args?.length ? parseInt(args[0]) : 1;
        const perPage = 10;

        if (isNaN(page) || page < 1) {
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Please provide a valid page number",
                    colour: "#ff0000"
                }]
            });
        }

        const users = await db.getLeaderboard(page, perPage);

        if (!users.length) {
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "No users found on this page",
                    colour: "#ff0000"
                }]
            });
        }

        const leaderboardText = users.map((user, index) => {
            const position = ((page - 1) * perPage) + index + 1;
            return [
                `${position}. <@${user.user_id}>`,
                `Total: 💰 ${user.total}`,
                `(Wallet: ${user.balance} | Bank: ${user.bank})`
            ].join(" ");
        }).join("\n");

        return msg.reply({
            embeds: [{
                title: "🏆 Richest Users",
                description: [
                    leaderboardText,
                    "",
                    `Page ${page}`
                ].join("\n"),
                colour: "#ffd700"
            }]
        });
    }
};

export default leaderboard; 