import { Message } from "revolt.js";
import { Command } from "../../types";

const transtext: Command = {
    name: "transtext",
    description: "Make the bot say something using the transexual flag's colourscheme (INCOMPLETE PLEASE FIX D:)",
    args: true,
    use: "<message>",
    async execute(message: Message, args: string[]) {
        if (!args)
            return message.reply("You didn't provide anything...");

        const sentence = args.join(" ");
        return await message.channel?.sendMessage(sentence);
    },
};

export = transtext;
