import { Message } from "revolt.js";
import { userCache } from "../..";
import { Command } from "../../types";

const cache: Command = {
    name: "cache",
    description: "Display cache",
    args: true,
    use: "<username>",
    async execute (message: Message, args: string[]) {
        message.channel?.sendMessage(`${Array.from(userCache.keys()).toString()}`)
    }
}

export = cache;