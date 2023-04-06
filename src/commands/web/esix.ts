import { E621APIHandler } from "./../../classes/e621";
import { Message } from "revolt.js";
import { esixAPI } from "../..";
import { Command } from "../../types";

const api = new E621APIHandler();

const esix: Command = {
    name: "esix",
    description: "Search images on E621",
    args: true,
    use: "<tags>",
    async execute(message: Message, args: string[]) {
        let tags: string;
        if (!message.channel?.nsfw) {
            tags = `rating:safe ${args.join(" ")}`;
        } else {
            tags = args.join(" ");
        }
        try {
            const post = await api.getRandomPost(tags, 100);
            return await message.reply(
                `[Result from E621](${post.file.url})`
            );
        } catch (error) {
            return await message.reply(
                `Error trying to find "${tags}"\n\`\`\`\n${error}\n\`\`\``
            );
        }
    },
};

export = esix;
