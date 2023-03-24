import { Message } from "revolt.js";
import { userCache } from "../..";
import { Command } from "../../types";

const whois: Command = {
    name: "whois",
    description: "Search for a user in cache",
    args: true,
    use: "<username>",
    async execute (message: Message, args: string[]) {
        let notFound: boolean = false;
        const user = userCache.get(args[0]) || await message.client.users.fetch(args[0]).catch((e) => {
            notFound = true;
            return e;
        });

        if (notFound) return message.channel?.sendMessage({
            embeds: [{
                title: "WhoIs",
                description: `User not Found on Cache or Revolt`
            }]
        })
        
        return message.channel?.sendMessage({
            embeds: [{
                title: "WhoIs",
                description: `Username: ${user?.username}\nProfile Picture: ${user?.generateAvatarURL()}\nUser ID: ${user?._id}\nIs Online: ${user?.online}\nIs on cache: ${userCache.get(user.username) ? true : false}`
            }]
        })
    }
}

export = whois;