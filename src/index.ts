import { Client, Message } from "revolt.js";

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

dotenv.config();

const revolt = new Client();

const config = {
    prefix: "?",
};

const categories = fs.readdirSync("./dist/commands");

const commands: Map<string, Command> = new Map();

// Get commands declared in files

for (const folder of categories) {
    const files = fs
        .readdirSync(`./dist/commands/${folder}`)
        .filter((file) => file.endsWith(".js"));

    for (const file of files) {
        console.log(file);
        const command: Command = require(
            path.resolve(`./dist/commands/${folder}/${file}`)
        );

        commands.set(command.name, command);
    }
}

revolt.on("ready", () => {
    console.log("I am ready!");
});

revolt.on("message", async (message: Message) => {
    if (
        !message.content?.startsWith(config.prefix) ||
        message.author?.bot
    )
        return;

    const args: string[] = message.content
        .slice(config.prefix.length)
        .trim()
        .split(/ +/);

    const command = args.shift()!.toLowerCase();

    // See if command name is equals to the request
    if (command && !commands.has(command)) return;

    try {
        // Pass the arguments into that command
        const cmd = commands.get(command);
        console.log(cmd);
        cmd?.execute(message, args, commands, revolt);
    } catch (error) {
        // If command fails, notify the user
        message.reply(`I had an error while executting ${command}`);
        message.channel?.sendMessage(`\`\`\`ts\n${error}\n\`\`\``);
    }
});

revolt.loginBot(process.env.TOKEN!);
