import axios from "axios";
import { Command } from "../../types";
import gotiny from "gotiny";

const shorten: Command = {
    name: "shorten",
    args: true,
    description: "Generate short links using gotiny.cc",
    use: "<url>",
    async execute(message, args, client) {
        try {
            if(!args) return message.reply("You didn't provide a url!")
            const data = await gotiny.set(args[0]);

            return message.reply(`Shortened link: <${data[0].link}>`);
        } catch (error) {
            return message.reply(error as string);
        }
    },
};

export = shorten;
