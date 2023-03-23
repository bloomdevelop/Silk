import { Client, Message, User } from "revolt.js";

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

// Please forgive me for what I am about to do
import E621 from "e621";

// Export the client so that it can be used through the esix command
export const esixAPI = new E621();

dotenv.config();

const revolt = new Client();

const categories = fs.readdirSync("./dist/commands");

const commands: Map<string, Command> = new Map();

export const userCache: Map<string, User> = new Map();

// Get commands declared in files

for (const folder of categories) {
    const files = fs
        .readdirSync(`./dist/commands/${folder}`)
        .filter((file) => file.endsWith(".js"));

    for (const file of files) {
        const command: Command = require(path.resolve(
            `./dist/commands/${folder}/${file}`
        ));

        commands.set(command.name, command);
        console.log("Loaded", command.name);
    }
}

revolt.once("ready", () => {
    console.log("I am ready!");
});

revolt.on("message", async (message: Message) => {
    // Cache user objects
    if (message.author)
        userCache.set(message.author.username, message.author);

    if (
        !message.content?.startsWith(process.env.prefix as string) ||
        message.author?.bot
    )
        return;

    const args: string[] = message.content
        .slice((process.env.prefix as string).length)
        .trim()
        .split(/ +/);

    const command = args.shift()!.toLowerCase();

    // See if command name is equals to the request
    if (command && !commands.has(command)) return;

    try {
        // Pass the arguments into that command
        const cmd = commands.get(command);

        if (!cmd)
            return message.reply(
                `StationBot: ${command}: Command not found`
            );

        console.log("executing", `${cmd.name}...`);
        cmd?.execute(message, args, commands, revolt);
    } catch (error) {
        // If command fails, notify the user
        message.reply(`I had an error while executting ${command}`);
        message.channel?.sendMessage(`\`\`\`ts\n${error}\n\`\`\``);
    }
});

revolt.loginBot(process.env.TOKEN!);
