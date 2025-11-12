import type { ICommand } from "../../types.js";
import { Logger } from "../../utils/Logger.js";
import { uploadFile } from "../../services/AutumnService.js";
import type { Message } from "stoat.js";

interface BunnyApiResponse {
    id: string;
    url: string;
    source: string;
    media: {
        gif?: string;
        poster?: string;
    };
}

const bunny: ICommand = {
    name: "bunny",
    description: "Get a random bunny picture",
    usage: "bunny",
    category: "Fun",
    aliases: ["rabbit", "bun"],
    logger: Logger.getInstance("bunny"),
    rateLimit: {
        usages: 3,
        duration: 10000,
        users: new Map()
    },

    async execute(msg) {
        let loadingMsg: Message | undefined;

        try {
            // Send initial response to show command is processing
            loadingMsg = await msg.reply({
                embeds: [{
                    title: "🐰 Fetching Bunny",
                    description: "Please wait while I find a cute bunny for you...",
                    colour: "#ffc0cb" // Pink color for bunnies
                }]
            });

            if (!loadingMsg) {
                throw new Error("Failed to send loading message");
            }

            // Fetch bunny image from bunnies.io API
            const response = await fetch("https://api.bunnies.io/v2/loop/random/?media=gif,png");

            if (!response.ok) {
                throw new Error(`Bunny API responded with status: ${response.status}`);
            }

            const data = await response.json() as BunnyApiResponse;

            if (!data?.media) {
                throw new Error("No bunny image found in the response");
            }

            // Prefer static image over GIF to save bandwidth
            const imageUrl = data.media.poster || data.media.gif;
            if (!imageUrl) {
                throw new Error("No valid image URL found");
            }

            // Fetch the image data
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image: ${imageResponse.status}`);
            }

            const imageBlob = await imageResponse.blob();

            // Upload to Autumn with proper filename and content type
            const fileId = await uploadFile(
                'attachments',
                imageBlob,
                `bunny_${data.id}${imageUrl.endsWith('.gif') ? '.gif' : '.jpg'}`
            );

            // Edit the loading message with the bunny image
            return loadingMsg.edit({
                embeds: [{
                    title: "🐰 Random Bunny",
                    description: [
                        "Here's your random bunny picture!",
                        `Original Bunny ID: \`${data.id}\``,
                        data.source ? `[Source](${data.source})` : null
                    ].filter(Boolean).join("\n"),
                    media: fileId,
                    colour: "#ffc0cb"
                }]
            });

        } catch (error) {
            this.logger?.error("Error fetching bunny picture:", error);

            // Try to edit the loading message if it exists
            try {
                if (loadingMsg) {
                    await loadingMsg.edit({
                        embeds: [{
                            title: "Error",
                            description: "Failed to fetch a bunny picture. Try again later!",
                            colour: "#ff0000"
                        }]
                    });
                    return;
                }
            } catch (editError) {
                this.logger?.error("Failed to edit loading message:", editError);
            }

            // Fallback to new message if editing fails or loading message doesn't exist
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Failed to fetch a bunny picture. Try again later!",
                    colour: "#ff0000"
                }]
            });
        }
    }
};

export default bunny; 