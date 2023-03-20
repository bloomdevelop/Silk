import { Message } from "revolt.js";
import { userCache } from "../..";

const whois: Command = {
    name: "whois",
    description: "Search for a user in cache",
    args: true,
    use: "<username>",
    async execute (message: Message, args: string[]) {
        const user = userCache.get(args[0]) || await message.client.users.fetch(args[0]);

        message.channel?.sendMessage({
            embeds: [{
                title: "WhoIs",
                description: `Username: ${user?.username}\nProfile Picture: ${user?.generateAvatarURL()}\nUser ID: ${user?._id}\nIs Online: ${user?.online}\nIs on cache: ${userCache.get(user.username) ? true : false}`
            }]
        })
    }
}

export = whois;