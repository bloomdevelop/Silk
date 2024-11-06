import { ICommand, Category } from "../../types.js";
import { Message } from "revolt.js";
import { Bot } from "../../Bot.js";
import { mainLogger } from "../../utils/Logger.js";

interface CommandInfo {
    name: string;
    description: string;
    category: Category;
    aliases?: string[];
    flags?: {
        ownerOnly?: boolean;
        disabled?: boolean;
        wip?: boolean;
        dangerous?: boolean;
    };
    usage?: string;
}

const formatFlags = (flags?: { [key: string]: boolean }): string | null => {
    if (!flags || Object.keys(flags).length === 0) return null;

    const flagEmojis: { [key: string]: string } = {
        ownerOnly: "👑",
        disabled: "🚫",
        wip: "🚧",
        dangerous: "⚠️"
    };

    return Object.entries(flags)
        .filter(([_, value]) => value)
        .map(([flag, _]) => `${flagEmojis[flag] || "🔹"} ${flag}`)
        .join("\n");
};

const help: ICommand = {
    name: "help",
    description: "Display information about available commands",
    usage: "help [command]",
    category: "Info",
    aliases: ["h", "commands"],

    async execute(message: Message, args: string[]) {
        const startTime = Date.now();
        try {
            const bot = Bot.getInstance();
            const commandManager = bot.getCommandManager();
            const commands = commandManager.getCommands();
            
            mainLogger.debug(`Help command execution:`, {
                messageId: message._id,
                author: message.author?.username,
                args,
                commandCount: commands.size
            });
            
            if (!args.length) {
                const categories = new Map<Category, CommandInfo[]>();
                
                // Group commands by category
                for (const [_, cmd] of commands) {
                    if (cmd.flags?.disabled) continue; // Skip disabled commands
                    
                    if (!categories.has(cmd.category)) {
                        categories.set(cmd.category, []);
                    }
                    categories.get(cmd.category)?.push(cmd);
                }

                const helpText = Array.from(categories.entries())
                    .filter(([_, cmds]) => cmds.length > 0) // Skip empty categories
                    .map(([category, cmds]) => {
                        const commandList = cmds
                            .sort((a, b) => a.name.localeCompare(b.name)) // Sort commands alphabetically
                            .map(cmd => {
                                const flagIcons = [];
                                if (cmd.flags?.ownerOnly) flagIcons.push("👑");
                                if (cmd.flags?.dangerous) flagIcons.push("⚠️");
                                if (cmd.flags?.wip) flagIcons.push("🚧");
                                return `\`${cmd.name}\` ${flagIcons.join("")}`;
                            })
                            .join(', ');
                        return `## ${category}\n${commandList}`;
                    })
                    .join('\n\n');

                const executionTime = Date.now() - startTime;
                mainLogger.debug(`Help command list generated in ${executionTime}ms`);

                return message.reply({
                    embeds: [{
                        title: "📚 Command List",
                        description: [
                            helpText,
                            "",
                            "**Flag Legend:**",
                            "👑 Owner Only",
                            "⚠️ Dangerous",
                            "🚧 Work in Progress",
                            "🚫 Disabled",
                            "",
                            "Use `help <command>` for detailed info"
                        ].join("\n"),
                        colour: "#00ff00"
                    }]
                });
            }

            // Detailed command help
            const commandName = args[0].toLowerCase();
            const command = commands.get(commandName) || 
                           Array.from(commands.values()).find(cmd => 
                               cmd.aliases?.includes(commandName)
                           );

            if (!command) {
                return message.reply({
                    embeds: [{
                        title: "❌ Command Not Found",
                        description: `No command found with name \`${commandName}\``,
                        colour: "#ff0000"
                    }]
                });
            }

            const flags = formatFlags(command.flags);
            const commandInfo = [
                `# ${command.name}`,
                command.description,
                '',
                `**Usage:** \`${command.usage || command.name}\``,
                `**Category:** ${command.category}`,
                command.aliases?.length ? `**Aliases:** ${command.aliases.map(alias => `\`${alias}\``).join(', ')}` : null,
                flags ? `\n**Flags:**\n${flags}` : null,
                command.permissions ? [
                    "",
                    "**Required Permissions:**",
                    command.permissions.user ? `User: ${command.permissions.user.join(", ")}` : null,
                    command.permissions.bot ? `Bot: ${command.permissions.bot.join(", ")}` : null
                ].filter(Boolean).join("\n") : null
            ].filter(Boolean).join('\n');

            const executionTime = Date.now() - startTime;
            mainLogger.debug(`Help command detail generated in ${executionTime}ms`);

            return message.reply({
                embeds: [{
                    title: "Command Details",
                    description: commandInfo,
                    colour: "#0099ff"
                }]
            });
        } catch (error) {
            mainLogger.error(`Help command error:`, error);
            return message.reply({
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