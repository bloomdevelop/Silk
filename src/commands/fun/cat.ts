import axios from "axios";
import { Message } from "revolt.js";
import { Command } from "../../types";

const cat: Command = {
    name: "cat",
    description:
        "Sends a random image of a cat. Powered by aws.random.cat",
    args: false,
    async execute(message: Message) {
        axios.get("https://cataas.com/cat?json=true").then((res) => {
            message.reply(`[cat :3](https://cataas.com${res.data.url})`)
        });
    },
};

export = cat;
