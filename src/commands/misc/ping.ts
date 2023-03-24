import { Message } from "revolt.js";
import { Command } from "../../types";

const ping: Command = {
    name: "ping",
    description: "Bot's Ping",
    args: false,
    async execute(message: Message) {
        await message.channel?.sendMessage(`Current Ping: ${Date.now() - message.createdAt}ms`)
    }
}

export = ping