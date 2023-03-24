import { Message } from "revolt.js";
import { Command } from "../../types";

const say: Command = {
    name: "transtext",
    description: "Make the bot say something using the transexual flag's colourscheme",
    args: true,
    use: "<message>",
    async execute(message: Message, args: string[]) {
        if (!args)
            return message.reply("You didn't provide anything...");

        const sentence = args.join(" ");
        return await message.channel?.sendMessage(sentence);
    },
};

export = say;
