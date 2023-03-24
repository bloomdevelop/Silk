import axios from "axios";
import { Message } from "revolt.js";
import { Command } from "../../types";

const dog: Command = {
    name: "dog",
    description:
        "Sends a random image of a dog. Powered by random.dog",
    args: false,
    async execute(message: Message) {
        axios.get("https://random.dog/woof?filter=mp4,webm").then(async (res) => {
            await message.reply(`[dog :3](https://random.dog/${res.data})`);
        });
    },
};

export = dog;
