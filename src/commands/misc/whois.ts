import { Message } from "revolt.js";
import { userCache } from "../..";
import { Command } from "../../types";

const whois: Command = {
    name: "whois",
    description: "Search for a user in cache",
    args: true,
    use: "<username>",
    async execute(message: Message, args: string[]) {
        try {
            const user =
                userCache.get(args.join(" ")) ||
                (await message.client.users.fetch(args[0]));

            return message.channel?.sendMessage({
                embeds: [
                    {
                        title: "WhoIs",
                        description: `Username: ${
                            user?.username
                        }\nProfile Picture: ${user?.generateAvatarURL()}\nUser ID: ${
                            user?._id
                        }\nIs Online: ${user?.online}\nIs on cache: ${
                            userCache.get(user.username)
                                ? true
                                : false
                        }`,
                    },
                ],
            });
        } catch {
            return message.channel?.sendMessage({
                embeds: [
                    {
                        title: "WhoIs",
                        description: `User not Found on Cache or Revolt`,
                    },
                ],
            });
        }
    },
};

export = whois;
