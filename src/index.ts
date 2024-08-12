import { Client, Message, User } from "revolt.js";
import { ICommand } from "./types";

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { log, commandLog } from "./utilities/log";

dotenv.config();

const revolt = new Client();

const disabledCommands =
  process.env.DISABLED_PLUGINS?.split(",") || "";

if (disabledCommands === "") log.warn("No disabled commands found.");
else log.info(`Disabled Commands: ${disabledCommands}`);

export const packageInfo = require("../package.json");
export const commands: Map<string, ICommand> = new Map();

const categories = fs.readdirSync("./dist/commands");

// Uptime
export let startup: number = new Date().getTime();

// Get commands declared in files
log.info("Loading commands...");
for (const folderName of categories) {
  log.info(`Loading commands from "${folderName}" folder`);
  const files = fs
    .readdirSync(`./dist/commands/${folderName}`)
    .filter((file) => file.endsWith(".js"));

  for (const file of files) {
    const command: ICommand = require(
      path.resolve(`./dist/commands/${folderName}/${file}`),
    );
    if (!disabledCommands?.includes(command.name)) {
      commands.set(command.name, command);
      commandLog.info(`Loaded: ${command.name}`);
    } else {
      commandLog.warn(`Not loading ${file} because it's disabled`);
    }
  }
}

revolt.once("ready", async () => {
  log.info(
    `Silk is ready to use, it took ${Date.now() - startup}ms to start...`,
  );

  
});

revolt.on("messageCreate", async (message: Message) => {
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
  if (command) {
    let cmdToExecute;
    for (const [name, cmd] of commands.entries()) {
      if (name === command || cmd.aliases?.includes(command)) {
        cmdToExecute = cmd;
        break;
      }
    }
    if (cmdToExecute) {
      try {
        // Pass the arguments into that command
        log.info("Executing", `${cmdToExecute.name}...`);
        cmdToExecute?.execute(message, args, revolt);
      } catch (error) {
        // If command fails, notify the user
        log.error(error);
        message.reply({
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
      message.reply({
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

revolt.loginBot(process.env.TOKEN!);
