import { Message } from "revolt.js";
import { userCache } from "../..";

const ban: Command = {
    name: "ban",
    description: "Ban users from your server",
    args: true,
    use: "<userid or user_in_cache>",
    async execute(message: Message, args: string[]) {
        if (!args) return message.reply("I need a userID");

        args.forEach(async (arg: string) => {
            const user = userCache.get(arg)?._id || arg; 
            console.log("Banning", user);
            await message.channel?.server
                ?.banUser(user, {
                    reason: "Banned by StationBot using ?ban",
                })
                .then(() => {
                    message.channel?.sendMessage(`Banned ${user}`)
                }).catch(() => message.channel?.sendMessage(`Couldn't ban ${user}`))
        });
    },
};

export = ban;
