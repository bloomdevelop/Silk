import { ICommand } from "../../types.js";
import { commandLogger } from "../../utils/Logger.js";

const ping: ICommand = {
    name: "ping",
    description: "Check bot and API latency",
    usage: "ping",
    category: "misc",
    aliases: ["latency", "p"],
    async execute(message) {
        try {
            // Send initial loading message
            const loadingMsg = await message.reply({
                embeds: [{
                    title: "🏓 Pinging...",
                    description: "Calculating latency...",
                    colour: "#ffff00"
                }]
            });

            if (!loadingMsg) {
                throw new Error("Failed to send initial message");
            }

            const startTime = Date.now();
            
            // Test Revolt API latency
            // @ts-expect-error
            const apiResponse = await fetch("https://api.revolt.chat/");
            const apiLatency = Date.now() - startTime;

            // Calculate bot latency
            const botLatency = Date.now() - Number(message.createdAt);

            commandLogger.info(`Ping command executed. API: ${apiLatency}ms, Bot: ${botLatency}ms`);

            return loadingMsg.edit({
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
        } catch (error) {
            commandLogger.error("Error in ping command:", error);
            return message.reply({
                embeds: [{
                    title: "Error",
                    description: "Failed to execute ping command",
                    colour: "#ff0000"
                }]
            });
        }
    }
};

export default ping;
