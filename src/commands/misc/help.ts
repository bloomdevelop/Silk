import { ICommand } from "../../types";
import { Client, Message } from "revolt.js";
import { CommandManager } from "../../managers/CommandManager";

const help: ICommand = {
    name: "help",
    description: "Display information about available commands",
    usage: "help [command]",
    category: "misc",
    execute: async (message: Message, args: string[], client: Client) => {
        const commandManager = new CommandManager(client);
        await commandManager.loadCommands();
        const commands = commandManager.getCommands();        if (!args.length) {
            const categories = new Map<string, ICommand[]>();

            commands.forEach((cmd) => {
                const category = cmd.category || 'Uncategorized';
                if (!categories.has(category)) {
                    categories.set(category, []);
                }
                categories.get(category)!.push(cmd);
            });
            console.log("Commands size:", commands.size);
            console.log("Categories:", Array.from(categories.entries()));


            const helpText = Array.from(categories.entries())
                .map(([category, cmds]) => {
                    const commandList = cmds
                        .map(cmd => `\`${cmd.name}\``)
                        .join(', ');
                    return `## ${category}\n${commandList}`;
                })
                .join('\n\n');

            return message.reply({
                embeds: [{
                    title: "📚 Command List",
                    description: helpText + "\n\nUse `help <command>` for detailed info",
                    colour: "#00ff00"
                }]
            });
        }

        // Detailed command help
        const commandName = args[0].toLowerCase();
        const command = commands.get(commandName);

        if (!command) {
            return message.reply({
                embeds: [{
                    title: "❌ Command Not Found",
                    description: `No command found with name \`${commandName}\``,
                    colour: "#ff0000"
                }]
            });
        }

        const commandInfo = [
            `# ${command.name}`,
            command.description,
            '',
            `**Usage:** \`${command.usage || command.name}\``,
            `**Category:** ${command.category || "None"}`,
            command.aliases?.length ? `**Aliases:** ${command.aliases.map((a: string) => `\`${a}\``).join(', ')}` : null
        ].filter(Boolean).join('\n');

        return message.reply({
            embeds: [{
                title: "Command Details",
                description: commandInfo,
                colour: "#0099ff"
            }]
        });
    }
};

module.exports = help;