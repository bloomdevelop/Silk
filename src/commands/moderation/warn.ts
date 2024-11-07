import { ICommand } from "../../types.js";
import { DatabaseService } from "../../services/DatabaseService.js";

const warn: ICommand = {
    name: "warn",
    description: "Warns a user",
    usage: "warn <userId> <reason>",
    category: "Moderation",
    
    async execute(msg, args) {
        const db = DatabaseService.getInstance();
        const serverId = msg.channel?.server?._id;
        
        // Check if moderation is enabled
        const config = await db.getServerConfig(serverId || '');
        if (!config.features.experiments.moderation) {
            return msg.reply({
                embeds: [{
                    title: "Feature Disabled",
                    description: "Moderation commands are disabled on this server",
                    colour: "#ff0000"
                }]
            });
        }

        if (!args || args.length < 2) {
            return msg.reply({
                embeds: [{
                    title: "Invalid Usage",
                    description: "Please provide a user ID and reason",
                    colour: "#ff0000"
                }]
            });
        }

        const targetMember = await msg.channel?.server?.fetchMember(args[0]);
        
        if (!targetMember) {
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "User not found in this server",
                    colour: "#ff0000"
                }]
            });
        }

        if (targetMember.user?.bot) {
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Cannot warn a bot",
                    colour: "#ff0000"
                }]
            });
        }

        const reason = args.slice(1).join(" ");

        try {
            // Send DM to user if possible
            const channel = await targetMember.user?.openDM();
            if (channel) {
                await channel.sendMessage({
                    content: `You have been warned in ${msg.channel?.server?.name} for: ${reason}`
                });
            }

            return msg.reply({
                embeds: [{
                    title: "User Warned",
                    description: [
                        `**User**: ${targetMember.user?.username}`,
                        `**Reason**: ${reason}`,
                        `**Warned by**: ${msg.author?.username}`
                    ].join("\n"),
                    colour: "#00ff00"
                }]
            });
        } catch (error) {
            // If DM fails, still show warning in channel
            return msg.reply({
                embeds: [{
                    title: "User Warned (Could not DM)",
                    description: [
                        `**User**: ${targetMember.user?.username}`,
                        `**Reason**: ${reason}`,
                        `**Warned by**: ${msg.author?.username}`
                    ].join("\n"),
                    colour: "#00ff00"
                }]
            });
        }
    }
};

export default warn;
