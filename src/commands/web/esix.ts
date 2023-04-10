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
        try {
            const post = await api.getRandomPost(
                args.join(" "),
                100,
                message.channel!.nsfw || false
            );
            return await message.reply(
                `[Result from E621](${post.file.url})`
            );
        } catch (error) {
            return await message.reply(
                `Error trying to find "${args.join(
                    " "
                )}"\n\`\`\`\n${error}\n\`\`\``
            );
        }
    },
};

export = esix;
