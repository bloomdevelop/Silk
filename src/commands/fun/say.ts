import { Message } from "revolt.js";

const say: Command = {
    name: "say",
    description: "Make the bot say something",
    args: true,
    use: "<string>",
    async execute(message: Message, args: string[]) {
        if (!args)
            return message.reply("You didn't provide anything...");

        const sentence = args.join(" ");
        return await message.channel?.sendMessage(sentence);
    },
};

export = say;
