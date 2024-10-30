import { Client, Message } from "revolt.js";
import { ICommand } from "./types";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { log, commandLog, folderLog } from "./utils/";

// Uptime
export let startup: number = new Date().getTime();

dotenv.config();

const revolt = new Client();

const disabledCommands =
    process.env.DISABLED_PLUGINS?.split(",") || "";

if (disabledCommands === "")
    commandLog.warn("No disabled commands found.");
else commandLog.info(`Disabled Commands: ${disabledCommands}`);

export const commands: Map<string, ICommand> = new Map();

// Get commands declared in files
commandLog.info("Loading commands...");
fs.readdir("./dist/commands").then((categories) => {
    for (const folderName of categories) {
        folderLog.info(
            `Loading commands from "${folderName}" folder`,
        );
        fs.readdir(`./dist/commands/${folderName}`).then((files) => {
            files.filter((file) => file.endsWith(".js"));
            for (const file of files) {
                const loadTime = new Date().getTime();
                const command: ICommand = require(
                    path.resolve(
                        `./dist/commands/${folderName}/${file}`,
                    ),
                );
                if (!disabledCommands?.includes(command.name)) {
                    commands.set(command.name, command);
                    commandLog.info(
                        `Loaded: ${command.name} took ${new Date().getTime() - loadTime}ms to load`,
                    );
                } else {
                    commandLog.warn(
                        `Not loading ${file} because it's disabled`,
                    );
                }
            }
        });
    }
});

revolt.once("ready", async () => {
    log.info(
        `Silk is ready to use, it took ${Date.now() - startup}ms to start...`,
    );
});

revolt.on("messageCreate", async (msg: Message) => {
    if (
        !msg.content?.startsWith(process.env.PREFIX as string) ||
        msg.author?.bot
    )
        return;

    const fileTemplate = `${msg.server?.id}-config.json`;

    fs.readFile(fileTemplate).then((data) => {
        const configData = JSON.parse(data.toString());
        const args: string[] = msg.content
            .slice((process.env.PREFIX as string).length)
            .trim()
            .split(/ +/);

        const command = args.shift()!.toLowerCase();

        if (configData.disabled_commands.includes(command)) {
            return msg.reply({
                embeds: [
                    {
                        title: "Configuration",
                        description: `Command \`${command}\` is disabled!`,
                        colour: "#FF0000",
                    },
                ],
            });
        }

        // See if command name is equals to the request
        if (command) {
            let cmdToExecute;
            for (const [name, cmd] of commands.entries()) {
                if (
                    name === command ||
                    cmd.aliases?.includes(command)
                ) {
                    cmdToExecute = cmd;
                    break;
                }
            }
            if (cmdToExecute) {
                try {
                    // Pass the arguments into that command
                    commandLog.info(
                        "Executing",
                        `${cmdToExecute.name}...`,
                    );
                    cmdToExecute?.execute(msg, args, revolt);
                } catch (error) {
                    // If command fails, notify the user
                    commandLog.error(error);
                    msg.reply({
                        embeds: [
                            {
                                title: "Error",
                                description: `Something went wrong while executing \`${command}\`\n\`\`\`ts\n${error}\n\`\`\``,
                                colour: "#FF0000",
                            },
                        ],
                    });
                }
            } else {
                // If command is not found, notify the user
                msg.reply({
                    embeds: [
                        {
                            title: "Error",
                            description: `Command not found: \`${command}\``,
                            colour: "#FF0000",
                        },
                    ],
                });
            }
        }
    });
});

await revolt.loginBot(process.env.TOKEN!);
