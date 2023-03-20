import { Message } from "revolt.js";

export = {
    name: "ping",
    description: "Bot's Ping",
    arguments: false,
    execute(message: Message) {
        message.channel?.sendMessage(`Current Ping: ${Date.now() - message.createdAt}ms`)
    }
}