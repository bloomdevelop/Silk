import { Message } from "revolt.js";
import { Command } from "../../types";
import { commands } from "../..";

const help: Command = {
    name: "help",
    description: "Help about a command",
    args: true,
    use: "<command>",
    async execute(
        message: Message,
        args: string[]
    ) {
        const data: string[] = [];
        if (!args.length) {
            data.push("Here is a list of all my commands:");
            // This should be command.name
            data.push(
                Array.from(commands.values())
                    .map((command) => command.name)
                    .join(", ")
            );
            data.push(
                `\nYou can send \`?help [command]\` to get help on a specific command!`
            );

            return message.author
                ?.openDM()
                .then(async (channel) => {
                    console.log(
                        `Opened DM with ${message.author?.username}`
                    );
                    for (const info of data) {
                        console.log(info);
                        await channel.sendMessage(info);
                    }
                })
                .catch()
                .then(() => {
                    message.reply(
                        "I sent you a message with all of my commands!"
                    );
                });
        }

        const name = args[0].toLowerCase();

        const command = commands.get(name);

        if (!command) {
            return message.reply("That's not a valid command!");
        }

        data.push(`**Name:** ${command.name}`);
        // Check if there is a <command.something> and push it to data
        if (command.description)
            data.push(`**Description:** ${command.description}`);
        if (command.use)
            data.push(`**Usage:** ?${command.name} ${command.use}`);
        if (command.cooldown)
            data.push(`**Cooldown:** ${command.cooldown} second(s)`);

        for (const info of data) {
            await message.channel?.sendMessage(info);
        }
    },
};

export = help
