import { Message } from "revolt.js";

export = {
    name: 'say',
    description: 'Make the bot say something',
    args: true,
    usage: '<string>',
    async execute(message: Message, args: string[]) {
        if (!args) return message.reply("You didn't provide anything...");

        const sentence = args.join(' ');
        return await message.channel?.sendMessage(sentence);
    },
  };