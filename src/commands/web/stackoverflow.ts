import axios from "axios";
import dayjs from "dayjs";
import { Message } from "revolt.js";
import { Command, StackoverflowPost } from "../../types";

const stackoverflow: Command = {
    name: "stackoverflow",
    description: "Search questions on stackoverflow",
    args: true,
    use: "<search_query>",
    async execute(message: Message, args: string[]) {
        const query = args.join(" ");
        const SOMessage = await message.reply(
            `Searching for ${query}`
        );
        // Maximum is 7
        const items: StackoverflowPost[] = await axios
            .get(
                `https://api.stackexchange.com/2.3/search?order=desc&sort=activity&pagesize=5&intitle=${query}&site=stackoverflow`
            )
            .then(({ data }) => data.items);

        if (items.length) {
            const data: string[] = [];

            items.forEach((post) =>
                data.push(
                    `- [${post.title}](<${
                        post.link
                    }>) (Tags: ${post.tags.join(", ")})`
                )
            );

            return await SOMessage?.edit({
                content: `## ${query} on StackOverflow\n${data.join(
                    "\n"
                )}`,
            });
        }

        return await SOMessage?.edit({
            content: `Couldn't find ${query}...`,
        });
    },
};

export = stackoverflow;
