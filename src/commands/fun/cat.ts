import axios from "axios";
import { Message } from "revolt.js";
import { Command } from "../../types";

const cat: Command = {
    name: "cat",
    description:
        "Sends a random image of a cat. Powered by aws.random.cat",
    args: false,
    async execute(message: Message) {
        axios.get("https://aws.random.cat/meow").then((res) => {
            message.reply(`[cat :3](${res.data.file})`);
        });
    },
};

export = cat;
