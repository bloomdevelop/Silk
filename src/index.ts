import { Client, Message, User } from "revolt.js";
import { Command } from "./types";

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import E621 from "e621";
import { Server } from "node:http";
import { VotekickItem } from "./classes/Votekick";


dotenv.config();

// Export the client so that it can be used through the esix command
export const esixAPI = new E621();

const revolt = new Client();

const disabledCommands =
    process.env.DISABLED_PLUGINS?.split(",") || "";

console.log("disabledCommands:", disabledCommands);

export const packageInfo = require("../package.json");
export const commands: Map<string, Command> = new Map();

export const userCache: Map<string, User> = new Map();
export const currentVotekicks: Map<string, VotekickItem> = new Map();

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
    console.log("Populating user cache, please wait...");

    const serverArray = Array.from(revolt.servers.values());

    serverArray.forEach(async (server) => {
        const members = await server.fetchMembers();

        members.users.forEach((user) => {
            userCache.set(user.username, user);
        });
    });

    console.log("I am ready!");

    // Log Startup Unix Timestamp
    startup = new Date();
});

revolt.on("member/join", async (member) => {
    console.log("New user joined to server, adding to cache...");
    if (member.user) userCache.set(member.user.username, member.user);
    else
        console.log(
            "Cannot add member to cache. Missing user object."
        );
});

revolt.on("message/updated", async (m) => {
    const votekick = currentVotekicks.get(m._id)
    if (votekick && votekick.member.kickable && votekick.limit <= m.reactions.size) {
        try {
            await votekick.passVote().then(() => {
                console.log("Kicked", votekick.member.user?.username, "for", votekick.reason)
                // Assumes the user is already kicked
                currentVotekicks.delete(votekick.id);
            });
        } catch (error) {
            console.error("Failed to pass vote...")
        }
    }
})

revolt.on("message", async (message: Message) => {
    // Cache user objects
    if (message.author)
        userCache.set(message.author.username, message.author);

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
                `StationBot: ${command}: Command not found`
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
