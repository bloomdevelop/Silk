import { Message } from "revolt.js";

const ping: Command = {
    name: "ping",
    description: "Bot's Ping",
    args: false,
    execute(message: Message) {
        message.channel?.sendMessage(`Current Ping: ${Date.now() - message.createdAt}ms`)
    }
}

export = ping