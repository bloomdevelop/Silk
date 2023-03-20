import { Message } from "revolt.js";

const kick: Command = {
    name: "kick",
    description: "Kick users from your server",
    args: true,
    use: "<userid>",
    execute(message: Message, args: string[]) {
        args.forEach((arg) => {
            message.channel?.server
                ?.fetchMember(arg)
                .then((member) => member.kick());
        });

        message.reply(
            `Kicked ${args.length} user${args.length > 1 ? "s" : ""}`
        );
    },
};
export = kick;
