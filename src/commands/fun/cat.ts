import type { ICommand } from "../../types.js";
import { Logger } from "../../utils/Logger.js";
import { uploadFile } from "../../services/AutumnService.js";
import type { Message } from "stoat.js";

interface CatApiResponse {
    id: string;
    url: string;
    width: number;
    height: number;
}

const cat: ICommand = {
    name: "cat",
    description: "Get a random cat picture",
    usage: "cat",
    category: "Fun",
    aliases: ["kitty", "meow"],
    logger: Logger.getInstance("cat"),
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
                    title: "🐱 Fetching Cat",
                    description: "Please wait while I find a cute cat for you...",
                    colour: "#ff69b4"
                }]
            });

            if (!loadingMsg) {
                throw new Error("Failed to send loading message");
            }

            // Fetch cat image
            const response = await fetch("https://api.thecatapi.com/v1/images/search", {
                headers: {
                    "x-api-key": process.env.CAT_API_KEY || "",
                }
            });

            if (!response.ok) {
                throw new Error(`Cat API responded with status: ${response.status}`);
            }

            const [data] = await response.json() as CatApiResponse[];

            if (!data?.url) {
                throw new Error("No cat image found in the response");
            }

            // Fetch the image data
            const imageResponse = await fetch(data.url);
            if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image: ${imageResponse.status}`);
            }

            const imageBlob = await imageResponse.blob();

            // Upload to Autumn with proper filename and content type
            const fileId = await uploadFile(
                'attachments',
                imageBlob,
                `cat_${data.id}.jpg`
            );

            // Edit the loading message with the cat image
            return loadingMsg.edit({
                embeds: [{
                    title: "🐱 Random Cat",
                    description: [
                        "Here's your random cat picture!",
                        `Original Cat ID: \`${data.id}\``,
                    ].join("\n"),
                    media: fileId,
                    colour: "#ff69b4"
                }]
            });

        } catch (error) {
            this.logger?.error("Error fetching cat picture:", error);

            // Try to edit the loading message if it exists
            try {
                if (loadingMsg) {
                    await loadingMsg.edit({
                        embeds: [{
                            title: "Error",
                            description: "Failed to fetch a cat picture. Try again later!",
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
                    description: "Failed to fetch a cat picture. Try again later!",
                    colour: "#ff0000"
                }]
            });
        }
    }
};

export default cat; 