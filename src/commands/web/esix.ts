import { Message } from "revolt.js";
import { esixAPI } from "../..";

const esix: Command = {
    name: "esix",
    description: "Search images on E621",
    args: true,
    use: "<tags>",
    async execute(message: Message, args: string[]) {
        const post = await esixAPI.posts.search({
            limit: 100,
            tags: `rating:safe ${args.join(" ")}`,
        }).then(posts => posts[Math.floor(Math.random() *  (Math.floor(100) - Math.ceil(0) + 1)) + Math.ceil(0)]);

        await message.reply(`[Result from E621](${post.file.url})`);
    },
};

export = esix;
