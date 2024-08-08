import { Command } from "../../types";

const warn: Command = {
    name: "warn",
    description: "Warns a user",
    execute: async (msg, args) => {
        if (!args || args.length < 2)
            return msg.reply("Please provide a user id and a reason");
        const user = msg.server?.getMember(args[0])?.user;
        if (user?.bot)
            return msg.reply(
                "This user is a bot! You cannot warn it D:",
            );
        if (!user) return msg.reply("User not found.");
        user.openDM().then((dmChannel) => {
            dmChannel.sendMessage(
                `You have been warned in ${msg.server?.name} for ${args[1]}`,
            );
        });
        msg.reply(`${user.username} has been warned for ${args[1]}`);
    },
};

module.exports = warn;
