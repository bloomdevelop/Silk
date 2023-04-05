import { currentVotekicks } from "../..";
import { VotekickItem } from "../../classes/Votekick";
import { Command } from "../../types";

const votekick: Command = {
    name: "votekick",
    description: "Votekick an user",
    args: true,
    use: "<mention> <reason>",
    async execute(message, args, client) {
        if (!message.mention_ids)
            return message.reply("Provide a user to votekick");
        if (!args)
            return message.reply(
                "Provide a reason to votekick that user"
            );
        if (message.channel?.channel_type !== "TextChannel")
            return message.reply(
                "You can't votekick outside of servers..."
            );

        const memberToKick =
            await message.channel.server?.fetchMember(
                message.mention_ids[0]
            );

        if (!memberToKick)
            return message.reply("Failed to find user...");

        const voteMSG = await message.reply(
            "React to this message to vote..."
        );

        if (!voteMSG)
            return message.reply("Failed to send message....");

        currentVotekicks.set(
            voteMSG._id,
            new VotekickItem(memberToKick, message.channel, {
                id: message._id,
                // We already know that there is going to be an author
                issuedBy: message.author!.username,
                reason: args.slice(1).join(" "),
            })
        );
    },
};

export = votekick;
