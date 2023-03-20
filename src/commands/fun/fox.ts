import axios from "axios";
import { Message } from "revolt.js";

const fox: Command = {
    name: "fox",
    description:
        "Sends a random image of a fox. Powered by randomfox.ca",
    args: false,
    async execute(message: Message) {
        axios.get("https://randomfox.ca/floof").then((res) => {
            message.reply(`[fox :3](${res.data.image})`);
        });
    },
};

export = fox;