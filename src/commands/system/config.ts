import { ICommand } from "../../types.js";
import { DatabaseService } from "../../services/DatabaseService.js";
import { mainLogger } from "../../utils/Logger.js";
import { Message } from "revolt.js";

const ConfigCommand: ICommand = {
    name: "config",
    description: "Configure bot settings for your server",
    usage: "config <view|set|reset> <key> <value>",
    category: "System",

    async execute(message: Message, args: string[]) {
        const db: DatabaseService = DatabaseService.getInstance();
        const serverId = message.channel?.server?._id;

        if (!serverId) {
            return message.reply({
                embeds: [
                    {
                        title: "Configuration Error",
                        description:
                            "This command can only be used in servers",
                        colour: "#ff0000",
                    },
                ],
            });
        }

        // Reset config
        if (args[0] === "reset") {
            await db.createDefaultConfig(serverId);
            return message.reply({
                embeds: [
                    {
                        title: "Configuration Reset",
                        description:
                            "Server configuration has been reset to defaults",
                        colour: "#00ff00",
                    },
                ],
            });
        }

        if (!args.length) {
            return message.reply({
                embeds: [
                    {
                        title: "Available Configuration Settings",
                        description: `
**Commands:**
\`config view\` - View current configuration
\`config reset\` - Reset to default configuration
\`config set <key> <value>\` - Update a setting

**Available Settings:**
• \`prefix\` - Bot command prefix
• \`cooldown\` - Default command cooldown in ms
• \`moderation\` - Enable/disable moderation (true/false)
• \`economy\` - Enable/disable economy (true/false)
• \`owners\` - Server bot owners (comma-separated IDs)
• \`blockedUsers\` - Blocked users (comma-separated IDs)

**Examples:**
\`config set prefix !\`
\`config set cooldown 5000\`
\`config set moderation true\`
\`config set owners id1,id2,id3\``,
                        colour: "#00ff00",
                    },
                ],
            });
        }

        // View config when no args or 'view' is specified
        if (args[0] === "view") {
            const config = await db.getServerConfig(serverId);
            return message.reply({
                embeds: [
                    {
                        title: "Server Configuration",
                        description: `\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\``,
                        colour: "#00ff00",
                    },
                ],
            });
        }

        // Handle set command
        if (args[0] === "set" && args.length >= 3) {
            const [, key, ...valueArgs] = args;
            const value = valueArgs.join(" ");
            const config = await db.getServerConfig(serverId);

            switch (key) {
                case "prefix": {
                    await db.updateServerConfig(serverId, {
                        bot: { ...config.bot, prefix: value },
                    });
                    break;
                }
                case "cooldown": {
                    const cooldown = parseInt(value);
                    if (isNaN(cooldown) || cooldown < 0) {
                        return message.reply({
                            embeds: [
                                {
                                    title: "Invalid Value",
                                    description:
                                        "Cooldown must be a positive number",
                                    colour: "#ff0000",
                                },
                            ],
                        });
                    }
                    await db.updateServerConfig(serverId, {
                        bot: {
                            ...config.bot,
                            defaultCooldown: cooldown,
                        },
                    });
                    break;
                }
                case "moderation": {
                    await db.updateServerConfig(serverId, {
                        features: {
                            ...config.features,
                            experiments: {
                                ...config.features.experiments,
                                moderation: value === "true",
                            },
                        },
                    });
                    break;
                }
                case "economy": {
                    await db.updateServerConfig(serverId, {
                        features: {
                            ...config.features,
                            experiments: {
                                ...config.features.experiments,
                                economy: value === "true",
                            },
                        },
                    });
                    break;
                }
                case "owners": {
                    const owners = value
                        .split(",")
                        .map((id) => id.trim());
                    await db.updateServerConfig(serverId, {
                        bot: { ...config.bot, owners },
                    });
                    break;
                }
                case "blockedUsers": {
                    const users = value
                        .split(",")
                        .map((id) => id.trim());
                    await db.updateServerConfig(serverId, {
                        security: {
                            ...config.security,
                            blockedUsers: users,
                        },
                    });
                    break;
                }
                default: {
                    return message.reply({
                        embeds: [
                            {
                                title: "Invalid Configuration Key",
                                description:
                                    "Available keys: prefix, cooldown, moderation, economy, owners, blockedUsers",
                                colour: "#ff0000",
                            },
                        ],
                    });
                }
            }

            mainLogger.info(
                `Updated ${key} for server ${serverId}`,
            );
            return message.reply({
                embeds: [
                    {
                        title: "Configuration Updated",
                        description: `Successfully updated ${key} to: ${value}`,
                        colour: "#00ff00",
                    },
                ],
            });
        }

        // Invalid usage
        return message.reply({
            embeds: [
                {
                    title: "Invalid Usage",
                    description:
                        "Use `config view`, `config set <key> <value>`, or `config reset`",
                    colour: "#ff0000",
                },
            ],
        });
    },
};

export default ConfigCommand;
