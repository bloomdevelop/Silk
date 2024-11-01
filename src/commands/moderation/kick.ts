import { ICommand } from "../../types.js";
import { commandLogger } from "../../utils/Logger.js";

const kick: ICommand = {
    name: "kick",
    description: "Kicks a user from the server",
    usage: "kick <userId> <reason>",
    category: "Moderation",
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

        // Check if user has permission to kick (4 = KickMembers)
        const permissions = msg.member?.server?.havePermission("KickMembers");
        if (!permissions) {
            return msg.reply({
                embeds: [{
                    title: "Permission Denied",
                    description: "You need the Kick Members permission to use this command",
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

            // Check if target is kickable
            if (targetMember.user?.bot) {
                return msg.reply({
                    embeds: [{
                        title: "Error",
                        description: "Cannot kick a bot",
                        colour: "#ff0000"
                    }]
                });
            }

            const reason = args.slice(1).join(" ");
            await targetMember.kick();

            commandLogger.info(`${msg.author?.username} kicked ${targetMember.user?.username} for: ${reason}`);

            return msg.reply({
                embeds: [{
                    title: "User Kicked",
                    description: [
                        `**User**: ${targetMember.user?.username}`,
                        `**Reason**: ${reason}`,
                        `**Kicked by**: ${msg.author?.username}`
                    ].join("\n"),
                    colour: "#00ff00"
                }]
            });
        } catch (error) {
            commandLogger.error("Error executing kick command:", error);
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Failed to kick user. Make sure I have the required permissions.",
                    colour: "#ff0000"
                }]
            });
        }
    }
};

export default kick;