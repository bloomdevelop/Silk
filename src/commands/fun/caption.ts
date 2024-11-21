import { Message } from "revolt.js";
import { ICommand } from "../../types.js";
import sharp from "sharp";
import { createCanvas, loadImage } from "canvas";
import { AutumnService } from "../../services/AutumnService.js";

const calculateFontSize = (text: string, width: number, height: number): number => {
    // Start with a base size that's proportional to image dimensions
    const baseSize = Math.min(width, height) * 0.1;
    // Adjust based on text length (longer text = smaller font)
    const lengthFactor = Math.max(0.5, 1 - (text.length * 0.02));
    return Math.max(20, Math.floor(baseSize * lengthFactor));
};

const command: ICommand = {
    name: "caption",
    description: "Add a caption to an image",
    category: "Fun",
    usage: "caption <text>",
    args: {
        required: true,
        minimum: 1
    },
    flags: {
        wip: true
    },
    async execute(message: Message, args: string[]) {
        // Check if there's an attachment
        const attachment = message.attachments?.[0];
        if (!attachment) {
            await message.reply("Please provide an image to caption!");
            return;
        }

        // Check if it's an image
        if (!('metadata' in attachment) || attachment.metadata.type !== 'Image') {
            await message.reply("Please provide a valid image file!");
            return;
        }

        // Get the caption text
        const captionText = args.join(" ");

        try {
            // Download the image using the autumn URL
            const response = await fetch(`https://autumn.revolt.chat/attachments/${attachment._id}`);
            if (!response.ok) {
                throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
            }

            const imageBuffer = Buffer.from(await response.arrayBuffer());

            // Get image dimensions
            const metadata = await sharp(imageBuffer).metadata();
            const { width = 800, height = 600 } = metadata;

            // Create canvas with padding for text
            const canvas = createCanvas(width, height + Math.floor(height * 0.2));
            const ctx = canvas.getContext("2d");

            // Load and draw the original image
            const image = await loadImage(imageBuffer);
            ctx.drawImage(image, 0, Math.floor(height * 0.2), width, height);

            // Calculate and set font size
            const fontSize = calculateFontSize(captionText, width, height);
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.fillStyle = "white";
            ctx.strokeStyle = "black";
            ctx.lineWidth = fontSize / 20;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // Draw text
            const textY = Math.floor(height * 0.1);
            ctx.strokeText(captionText, width / 2, textY);
            ctx.fillText(captionText, width / 2, textY);

            // Convert canvas to buffer
            const outputBuffer = canvas.toBuffer();

            // Upload to Autumn
            const fileId = await AutumnService.uploadFile("attachments", outputBuffer, "caption.png");

            // Reply with the captioned image
            await message.reply({
                embeds: [{
                    title: "Captioned Image",
                    description: `**${captionText}**`,
                    colour: "#ff69b4",
                    media: fileId
                }]
            });

        } catch (error) {
            console.error("Error in caption command:", error);
            await message.reply("Sorry, there was an error processing your image! " + (error as Error).message);
        }
    }
};

export default command;