import { ICommand } from "../../types.js";
import { DatabaseService } from "../../services/DatabaseService.js";
import { Message } from "stoat.js";
import { mainLogger } from "../../utils/Logger.js";
import { RateLimitHandler } from "../../utils/RateLimitHandler.js";

async function deleteMessagesInQueue(messages: Message[]): Promise<number> {
    let deletedCount = 0;
    const BATCH_SIZE = 5; // Process 5 messages at a time
    const BATCH_DELAY = 5000; // Wait 5 seconds between batches

    // Split messages into batches
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);
        
        // Process each batch
        try {
            await Promise.all(batch.map(async (message) => {
                try {
                    await RateLimitHandler.executeWithRetry(
                        async () => {
                            await message.delete();
                            deletedCount++;
                            return true;
                        },
                        {
                            maxRetries: 3,
                            baseDelay: 1000,
                            maxDelay: 5000
                        }
                    );
                } catch (error) {
                    mainLogger.error(`Failed to delete message ${message._id}:`, error);
                }
            }));

            // Wait between batches unless it's the last batch
            if (i + BATCH_SIZE < messages.length) {
                mainLogger.debug(`Waiting ${BATCH_DELAY}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
        } catch (error) {
            mainLogger.error(`Error processing batch:`, error);
        }
    }

    return deletedCount;
}

const purge: ICommand = {
    name: "purge",
    description: "Bulk delete messages from a channel",
    usage: "purge <amount> [user]",
    category: "Moderation",
    permissions: {
        user: ["ManageMessages"],
        bot: ["ManageMessages"]
    },

    async execute(msg: Message, args: string[]): Promise<void> {
        const db = DatabaseService.getInstance();
        const serverId = msg.channel?.server?._id;
        
        // Check if moderation is enabled
        const config = await db.getServerConfig(serverId || '');
        if (!config.features.experiments.moderation) {
            await msg.reply({
                embeds: [{
                    title: "Feature Disabled",
                    description: "Moderation commands are disabled on this server",
                    colour: "#ff0000"
                }]
            });
            return;
        }

        // Check permissions
        const server = msg.channel?.server;
        if (!server) {
            await msg.reply({
                embeds: [{
                    title: "Error",
                    description: "This command can only be used in a server",
                    colour: "#ff0000"
                }]
            });
            return;
        }

        // Check bot permissions
        const botMember = await server.fetchMember(msg.client.user?._id || '');
        if (!botMember?.hasPermission(server, "ManageMessages")) {
            await msg.reply({
                embeds: [{
                    title: "Missing Permissions",
                    description: "I need the 'Manage Messages' permission to delete messages",
                    colour: "#ff0000"
                }]
            });
            return;
        }

        // Check user permissions
        if (!msg.member?.hasPermission(server, "ManageMessages")) {
            await msg.reply({
                embeds: [{
                    title: "Permission Denied",
                    description: "You need the Manage Messages permission to use this command",
                    colour: "#ff0000"
                }]
            });
            return;
        }

        if (!args.length) {
            await msg.reply({
                embeds: [{
                    title: "Invalid Usage",
                    description: "Please specify the number of messages to delete",
                    colour: "#ff0000"
                }]
            });
            return;
        }

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            await msg.reply({
                embeds: [{
                    title: "Invalid Amount",
                    description: "Please provide a number between 1 and 100",
                    colour: "#ff0000"
                }]
            });
            return;
        }

        try {
            const channel = msg.channel;
            if (!channel) {
                await msg.reply({
                    embeds: [{
                        title: "Error",
                        description: "Could not access channel",
                        colour: "#ff0000"
                    }]
                });
                return;
            }

            // Fetch messages with rate limit handling
            const messages = await RateLimitHandler.executeWithRetry(
                async () => channel.fetchMessages({ limit: amount + 1 }), // +1 to include command message
                {
                    maxRetries: 3,
                    baseDelay: 1000,
                    maxDelay: 5000
                }
            );

            if (!messages) {
                throw new Error("Could not fetch messages");
            }

            // Filter messages if user specified
            const targetUser = args[1] ? await server.fetchMember(args[1]) : null;
            const toDelete = targetUser 
                ? messages.filter((m: Message) => m.author_id === targetUser._id.user)
                : messages;

            // Send initial status message
            const statusMsg = await msg.reply({
                embeds: [{
                    title: "Purging Messages",
                    description: `Starting to delete ${toDelete.length} messages...`,
                    colour: "#ffff00"
                }]
            });

            // Delete messages using queue system
            const deletedCount = await deleteMessagesInQueue(toDelete);

            // Delete the status message
            if (statusMsg) {
                try {
                    await RateLimitHandler.executeWithRetry(
                        async () => statusMsg.delete(),
                        {
                            maxRetries: 2,
                            baseDelay: 500,
                            maxDelay: 2000
                        }
                    );
                } catch (error) {
                    mainLogger.error("Failed to delete status message:", error);
                }
            }

            // Send final confirmation
            const confirmationMsg = await RateLimitHandler.executeWithRetry(
                async () => channel.sendMessage({
                    embeds: [{
                        title: "Messages Purged",
                        description: [
                            `Successfully deleted ${deletedCount} messages`,
                            targetUser ? `from user ${targetUser.user?.username}` : "",
                            `Requested by ${msg.author?.username}`
                        ].filter(Boolean).join("\n"),
                        colour: "#00ff00"
                    }]
                })
            );

            // Delete confirmation message after 5 seconds
            if (confirmationMsg) {
                setTimeout(async () => {
                    try {
                        await RateLimitHandler.executeWithRetry(
                            async () => confirmationMsg.delete(),
                            {
                                maxRetries: 2,
                                baseDelay: 500,
                                maxDelay: 2000
                            }
                        );
                    } catch (error) {
                        mainLogger.error("Failed to delete confirmation message:", error);
                    }
                }, 5000);
            }

        } catch (error) {
            mainLogger.error("Error executing purge command:", error);
            await msg.reply({
                embeds: [{
                    title: "Error",
                    description: "An error occurred while purging messages",
                    colour: "#ff0000"
                }]
            });
        }
    }
};

export default purge;