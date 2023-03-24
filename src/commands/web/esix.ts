import { Message } from "revolt.js";
import { esixAPI } from "../..";
import { Command } from "../../types";

const esix: Command = {
    name: "esix",
    description: "Search images on E621",
    args: true,
    use: "<tags>",
    async execute(message: Message, args: string[]) {
        try {
            const post = await esixAPI.posts.search({
                limit: 100,
                tags: `rating:safe ${args.join(" ")}`,
            }).then(posts => posts[Math.floor(Math.random() *  (Math.floor(posts.length) - Math.ceil(0) + 1)) + Math.ceil(0)]).catch(e => {
                throw e;
            })
            return await message.reply(`[Result from E621](${post.file.url})`);
        } catch (error) {
            return await message.reply(`Error trying to find "rating:safe ${args.join(" ")}"\n\`\`\`\n${error}\n\`\`\``);
        }
    },
};

export = esix;
