import { ICommand } from "../../types.js";
import { Message } from "revolt.js";
import { Bot } from "../../Bot.js";

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
        const bot = Bot.getInstance();
        const commandManager = bot.getCommandManager();
        const commands = commandManager.getCommands();

        if (!args.length) {
            const categories = new Map<string, ICommand[]>();

            commands.forEach((cmd) => {
                // Skip disabled commands unless user is owner
                if (cmd.flags?.disabled && !message.author?.bot) {
                    return;
                }
                
                const category = cmd.category || 'Uncategorized';
                if (!categories.has(category)) {
                    categories.set(category, []);
                }
                categories.get(category)!.push(cmd);
            });

            const helpText = Array.from(categories.entries())
                .map(([category, cmds]) => {
                    const commandList = cmds
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

        const flags = formatFlags(command.flags);
        const commandInfo = [
            `# ${command.name}`,
            command.description,
            '',
            `**Usage:** \`${command.usage || command.name}\``,
            `**Category:** ${command.category || "None"}`,
            command.aliases?.length ? `**Aliases:** ${command.aliases.map(a => `\`${a}\``).join(', ')}` : null,
            flags ? `\n**Flags:**\n${flags}` : null,
            command.permissions ? [
                "",
                "**Required Permissions:**",
                command.permissions.user ? `User: ${command.permissions.user.join(", ")}` : null,
                command.permissions.bot ? `Bot: ${command.permissions.bot.join(", ")}` : null
            ].filter(Boolean).join("\n") : null
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

export default help;