import { Message } from "revolt.js";

const ban: Command = {
    name: "ban",
    description: "Ban users from your server",
    args: true,
    use: "<userid>",
    execute(message: Message, args: string[]) {
        args.forEach(arg => {
            message.channel?.server?.banUser(arg, {
                reason: `Banned by ${message.author?.username}`
            });
        })

        message.reply(`Banned ${args.length} user${args.length > 1 ? "s" : ""}`)
    },
};

export = ban