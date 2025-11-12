import type { ICommand, Category } from "../../types.js";
import type { Message } from "stoat.js";
import { Bot } from "../../Bot.js";
import { Logger } from "../../utils/Logger.js";

// Helper functions moved outside the command object
async function showCommandList(msg: Message, commands: ICommand[]): Promise<void> {
    // Group commands by category
    const categories = new Map<Category, ICommand[]>();
    
    for (const cmd of commands) {
        if (cmd.flags?.disabled) continue;
        
        if (!categories.has(cmd.category)) {
            categories.set(cmd.category, []);
        }
        categories.get(cmd.category)?.push(cmd);
    }

    // Build the help message
    const helpText = Array.from(categories.entries())
        .filter(([_, cmds]) => cmds.length > 0)
        .map(([category, cmds]) => {
            const commandList = cmds
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(cmd => {
                    const flags = [];
                    if (cmd.flags?.ownerOnly) flags.push("👑");
                    if (cmd.flags?.dangerous) flags.push("⚠️");
                    if (cmd.flags?.wip) flags.push("🚧");
                    return `\`${cmd.name}\` ${flags.join("")}`;
                })
                .join(" • ");

            return [
                `## ${category}`,
                commandList,
                "" // Empty line for spacing
            ].join("\n");
        })
        .join("\n");

    await msg.reply({
        embeds: [{
            title: "📚 Command Help",
            description: [
                "Welcome to the help menu! Here are all available commands:",
                "",
                helpText,
                "",
                "**Command Usage:**",
                "• Use `help <command>` for detailed information about a specific command",
                "• Required arguments are marked with `<>`",
                "• Optional arguments are marked with `[]`",
                "",
                "**Flag Legend:**",
                "👑 Owner Only  •  ⚠️ Dangerous  •  🚧 Work in Progress"
            ].join("\n"),
            colour: "#00ff00"
        }]
    });
}

async function showCommandDetails(msg: Message, commandName: string, commands: ICommand[]): Promise<void> {
    const command = commands.find(cmd => 
        cmd.name === commandName || 
        cmd.aliases?.includes(commandName)
    );

    if (!command) {
        await msg.reply({
            embeds: [{
                title: "Command Not Found",
                description: `No command found with name \`${commandName}\`.\nUse \`help\` to see all available commands.`,
                colour: "#ff0000"
            }]
        });
        return;
    }

    const flagDescriptions = [];
    if (command.flags?.ownerOnly) flagDescriptions.push("👑 This command can only be used by the bot owner");
    if (command.flags?.dangerous) flagDescriptions.push("⚠️ This command can be dangerous if misused");
    if (command.flags?.wip) flagDescriptions.push("🚧 This command is still under development");

    const permissionInfo = [];
    if (command.permissions?.user) {
        permissionInfo.push("**Required User Permissions:**");
        permissionInfo.push(command.permissions.user.map(perm => `• ${perm}`).join("\n"));
    }
    if (command.permissions?.bot) {
        permissionInfo.push("**Required Bot Permissions:**");
        permissionInfo.push(command.permissions.bot.map(perm => `• ${perm}`).join("\n"));
    }

    await msg.reply({
        embeds: [{
            title: `Command: ${command.name}`,
            description: [
                command.description,
                "",
                "**Usage:**",
                `\`${command.usage || command.name}\``,
                "",
                command.aliases?.length ? [
                    "**Aliases:**",
                    command.aliases.map(alias => `\`${alias}\``).join(", "),
                    ""
                ].join("\n") : null,
                command.rateLimit ? [
                    "**Rate Limit:**",
                    `${command.rateLimit.usages} uses per ${command.rateLimit.duration / 1000} seconds`,
                    ""
                ].join("\n") : null,
                flagDescriptions.length ? [
                    "**Flags:**",
                    ...flagDescriptions,
                    ""
                ].join("\n") : null,
                permissionInfo.length ? permissionInfo.join("\n") : null
            ].filter(Boolean).join("\n"),
            colour: "#0099ff"
        }]
    });
}

const help: ICommand = {
    name: "help",
    description: "Shows information about commands",
    usage: "help [command]",
    category: "Info",
    aliases: ["commands", "h"],
    logger: Logger.getInstance("help"),

    async execute(msg: Message, args: string[]): Promise<void> {
        try {
            const bot = Bot.getInstance();
            const commands = Array.from(bot.getCommandManager().getAllCommands().values());

            if (!args.length) {
                await showCommandList(msg, commands);
                return;
            }

            const commandName = args[0].toLowerCase();
            await showCommandDetails(msg, commandName, commands);

        } catch (error) {
            this.logger?.error("Error executing help command:", error);
            await msg.reply({
                embeds: [{
                    title: "Error",
                    description: "An error occurred while fetching help information.",
                    colour: "#ff0000"
                }]
            });
        }
    }
};

export default help;