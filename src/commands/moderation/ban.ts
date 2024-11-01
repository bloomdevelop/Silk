import { ICommand } from "../../types.js";
import { commandLogger } from "../../utils/Logger.js";

const ban: ICommand = {
    name: "ban",
    description: "Bans a user from the server",
    usage: "ban <userId> <reason>",
    category: "moderation",
    async execute(msg, args) {
        if (!args || args.length < 2) {
            return msg.reply({
                embeds: [{
                    title: "Invalid Usage",
                    description: "Please provide a user ID and reason",
                    colour: "#ff0000"
                }]
            });
        }

        // Check if user has permission to ban (2 = BanMembers)
        const permissions = msg.member?.server?.havePermission("BanMembers");
        if (!permissions) {
            return msg.reply({
                embeds: [{
                    title: "Permission Denied",
                    description: "You need the Ban Members permission to use this command",
                    colour: "#ff0000"
                }]
            });
        }

        try {
            const targetMember = msg.server?.getMember(args[0]);
            if (!targetMember) {
                return msg.reply({
                    embeds: [{
                        title: "Error",
                        description: "User not found in this server",
                        colour: "#ff0000"
                    }]
                });
            }

            // Check if target is bannable
            if (targetMember.user?.bot) {
                return msg.reply({
                    embeds: [{
                        title: "Error",
                        description: "Cannot ban a bot",
                        colour: "#ff0000"
                    }]
                });
            }

            const reason = args.slice(1).join(" ");
            await targetMember.ban({reason: args[1]});

            commandLogger.info(`${msg.author?.username} banned ${targetMember.user?.username} for: ${reason}`);

            return msg.reply({
                embeds: [{
                    title: "User Banned",
                    description: [
                        `**User**: ${targetMember.user?.username}`,
                        `**Reason**: ${reason}`,
                        `**Banned by**: ${msg.author?.username}`
                    ].join("\n"),
                    colour: "#00ff00"
                }]
            });
        } catch (error) {
            commandLogger.error("Error executing ban command:", error);
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Failed to ban user. Make sure I have the required permissions.",
                    colour: "#ff0000"
                }]
            });
        }
    }
};

export default ban; 