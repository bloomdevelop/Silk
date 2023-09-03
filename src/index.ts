import { Client, Message, User } from "revolt.js";
import { Command } from "./types";

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";


dotenv.config();

const revolt = new Client();

const disabledCommands =
    process.env.DISABLED_PLUGINS?.split(",") || "";

console.log("disabledCommands:", disabledCommands);

export const packageInfo = require("../package.json");
export const commands: Map<string, Command> = new Map();

const categories = fs.readdirSync("./dist/commands");

// Uptime
export let startup: Date;

// Get commands declared in files

for (const folder of categories) {
    const files = fs
        .readdirSync(`./dist/commands/${folder}`)
        .filter((file) => file.endsWith(".js"));

    for (const file of files) {
        const command: Command = require(path.resolve(
            `./dist/commands/${folder}/${file}`
        ));
        if (!disabledCommands?.includes(command.name)) {
            commands.set(command.name, command);
            console.log("Loaded", command.name);
        } else {
            console.log("Not loading", file, "because it's disabled");
        }
    }
}

revolt.once("ready", async () => {
    console.log("I am ready!");
});

revolt.on("message", async (message: Message) => {
    if (
        !message.content?.startsWith(process.env.PREFIX as string) ||
        message.author?.bot
    )
        return;

    const args: string[] = message.content
        .slice((process.env.PREFIX as string).length)
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
                `Unimate: ${command}: Command not found`
            );

        console.log("executing", `${cmd.name}...`);
        cmd?.execute(message, args, revolt);
    } catch (error) {
        // If command fails, notify the user
        message.reply(`I had an error while executting ${command}`);
        message.channel?.sendMessage(`\`\`\`ts\n${error}\n\`\`\``);
    }
});

revolt.loginBot(process.env.TOKEN!);
