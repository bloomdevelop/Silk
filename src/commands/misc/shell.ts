import { Command } from "../../types";
import { spawnSync } from "node:child_process";

const shell: Command = {
    name: "shell",
    description: "Run shell commands",
    alias: ["sh"],
    usage: "<command>",
    async execute(msg, args) {
        const spacedArgs: string =
            args?.toString().replace(/,/gm, " ") || "";
        if (!args || args.length === 0)
            return msg.reply("Please provide a command to run.");
        const result = spawnSync(spacedArgs, {
            shell: true,
        });
        msg.reply(
            `Command output:\n \`\`\`\n${result.stdout.toString()}\n\`\`\``,
        );
    },
};

module.exports = shell;
