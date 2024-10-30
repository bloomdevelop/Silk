import { ICommand } from "../../types";
import { commandLogger } from "../../utils";

const ping: ICommand = {
    name: "ping",
    description: "Check bot and API latency",
    usage: "ping",
    category: "misc",
    aliases: ["latency", "p"],
    async execute(message) {
        const startTime = Date.now();

        // Test Revolt API latency
        // @ts-expect-error
        const apiResponse = await fetch("https://api.revolt.chat/");
        const apiLatency = Date.now() - startTime;

        // Calculate bot latency
        const botLatency = Date.now() - Number(message.createdAt);

        commandLogger.info(`Ping command executed. API: ${apiLatency}ms, Bot: ${botLatency}ms`);

        return message.reply({
            embeds: [{
                title: "🏓 Pong!",
                description: [
                    "# Latency Information",
                    `**Bot Latency**: \`${botLatency}ms\``,
                    `**API Latency**: \`${apiLatency}ms\``,
                ].join("\n"),
                colour: "#00ff00"
            }]
        });
    }
};

module.exports = ping;