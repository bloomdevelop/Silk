import { ICommand } from "../../types";
import { spawnSync } from "node:child_process";

const shell: ICommand = {
    name: "shell",
    description:
        "Runs shell commands. It does reflects depending what's OS you're running on this bot.\n> ### Security Note ⚠️.\n> This command can be dangerous to use without supervisions from the creator of this bot, not only it's is dangerous, but **you could absolutely execute any programs the host has it installed**, meaning it will be **more vulnerable to some specific scenario such as triggering arbitrary command execution using metacharacters as explained in the `node.js` documentation**.\n> #### So please use it carefully!",
    aliases: ["sh", "bash", "ps", "cmd", "fish", "zsh"],
    usage: "shell <command>",
    async execute(msg, args) {
        const spacedArgs: string =
            args?.toString().replace(/,/gm, " ") || "";
        if (!args || args.length === 0)
            return msg.reply("Please provide a command to run.");
        const result = spawnSync(spacedArgs, {
            shell: true,
        });
        msg.reply({
            embeds: [
                {
                    title: "Shell - Command Output",
                    description: `Command: \`${spacedArgs}\`\n\`\`\`\n${result.output.toString().substring(0, 1200).replace(/,/gm, "")}\`\`\``,
                },
            ],
        });
    },
};

module.exports = shell;
