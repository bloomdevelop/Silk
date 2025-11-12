import { ICommand } from "../../types.js";
import { Message } from "stoat.js";
import { mainLogger } from "../../utils/Logger.js";

const echo: ICommand = {
    name: "echo",
    description: "Repeats your message (for debugging)",
    usage: "echo <message>",
    category: "Utility",
    aliases: ["say", "repeat"],

    async execute(message: Message, args: string[]) {
        const startTime = Date.now();
        const messageId = message._id;
        
        try {
            if (!args.length) {
                return message.reply({
                    embeds: [{
                        title: "Error",
                        description: "Please provide a message to echo",
                        colour: "#ff0000"
                    }]
                });
            }

            const content = args.join(" ");
            mainLogger.debug(`Echo command execution:`, {
                messageId,
                author: message.author?.username,
                content,
                executionTime: `${Date.now() - startTime}ms`
            });

            return message.reply({
                embeds: [{
                    title: "Echo",
                    description: [
                        content,
                        "",
                        `**Debug Info:**`,
                        `Message ID: \`${messageId}\``,
                        `Time: \`${Date.now() - startTime}ms\``
                    ].join('\n'),
                    colour: "#00ff00"
                }]
            });
        } catch (error) {
            mainLogger.error(`Echo command error for message ${messageId}:`, error);
            throw error;
        }
    }
};

export default echo; 