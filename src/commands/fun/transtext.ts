import { Message } from "revolt.js";
import { Command } from "../../types";
import { gradient, trans } from "../../util";

const transtext: Command = {
    name: "transtext",
    description:
        "Make the bot say something using the transexual flag's colourscheme (INCOMPLETE PLEASE FIX D:)",
    args: true,
    use: "<message>",
    async execute(message: Message, args: string[]) {
        try {
            if (!args)
                return message.reply(
                    "You didn't provide anything..."
                );
            const sentence = args.join(" ");
            const response = await trans(sentence);

            return await message.channel?.sendMessage(response);
        } catch (error) {
            return await message.reply(`Failed to execute transtext, stacktrace:\n\`\`\`ts\n${error}\n\`\`\``)
        }
    },
};

export = transtext;
