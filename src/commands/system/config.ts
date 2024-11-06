import { ICommand } from "../../types.js";
import { DatabaseService } from "../../services/DatabaseService.js";
import { mainLogger } from "../../utils/Logger.js";
import { Message } from "revolt.js";
import { IConfiguration } from "../../types.js";

const ConfigCommand: ICommand = {
    name: "config",
    description: "Configure bot settings for your server",
    usage: "config <view|set|reset> <key> <value>",
    category: "System",

    async execute(message: Message, args: string[]): Promise<void> {
        const db: DatabaseService = DatabaseService.getInstance();
        const serverId = message.channel?.server?._id;

        if (!serverId) {
            message.reply({
                embeds: [
                    {
                        title: "Configuration Error",
                        description: "This command can only be used in servers",
                        colour: "#ff0000",
                    },
                ],
            });
            return;
        }

        // Reset config
        if (args[0] === "reset") {
            await db.createDefaultConfig(serverId);
            await message.reply({
                embeds: [
                    {
                        title: "Configuration Reset",
                        description: "Server configuration has been reset to defaults",
                        colour: "#00ff00",
                    },
                ],
            });
            return;
        }

        if (!args.length) {
            await message.reply({
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
            return;
        }

        // View config when no args or 'view' is specified
        if (args[0] === "view") {
            const config = await db.getServerConfig(serverId);
            await message.reply({
                embeds: [
                    {
                        title: "Current Configuration",
                        description: [
                            "**Bot Settings:**",
                            `• Prefix: ${config.bot.prefix}`,
                            `• Default Cooldown: ${config.bot.defaultCooldown}ms`,
                            "",
                            "**Features:**",
                            `• Moderation: ${config.features.experiments.moderation}`,
                            `• Economy: ${config.features.experiments.economy}`,
                            "",
                            "**Security:**",
                            `• Blocked Users: ${config.security.blockedUsers.length}`,
                            `• Allowed Servers: ${config.security.allowedServers.length}`,
                            "",
                            "**Commands:**",
                            `• Disabled: ${config.commands.disabled.length}`,
                            `• Dangerous: ${config.commands.dangerous.length}`,
                        ].join("\n"),
                        colour: "#00ff00",
                    },
                ],
            });
            return;
        }

        // Handle set command
        if (args[0] === "set" && args.length >= 3) {
            const key = args[1].toLowerCase();
            const value = args.slice(2).join(" ");
            const config = await db.getServerConfig(serverId);

            switch (key) {
                case "prefix": {
                    const updatedConfig: IConfiguration = {
                        ...config,
                        bot: { ...config.bot, prefix: value }
                    };
                    await db.updateServerConfig(serverId, updatedConfig);
                    break;
                }
                case "cooldown": {
                    const cooldown = parseInt(value);
                    if (isNaN(cooldown) || cooldown < 0) {
                        await message.reply({
                            embeds: [{
                                title: "Invalid Cooldown",
                                description: "Cooldown must be a positive number",
                                colour: "#ff0000"
                            }]
                        });
                        return;
                    }
                    const updatedConfig: IConfiguration = {
                        ...config,
                        bot: { ...config.bot, defaultCooldown: cooldown }
                    };
                    await db.updateServerConfig(serverId, updatedConfig);
                    break;
                }
                case "moderation": {
                    const updatedConfig: IConfiguration = {
                        ...config,
                        features: {
                            ...config.features,
                            experiments: {
                                ...config.features.experiments,
                                moderation: value === "true"
                            }
                        }
                    };
                    await db.updateServerConfig(serverId, updatedConfig);
                    break;
                }
                case "economy": {
                    const updatedConfig: IConfiguration = {
                        ...config,
                        features: {
                            ...config.features,
                            experiments: {
                                ...config.features.experiments,
                                economy: value === "true"
                            }
                        }
                    };
                    await db.updateServerConfig(serverId, updatedConfig);
                    break;
                }
                case "owners": {
                    const owners = value.split(",").map((id) => id.trim());
                    const updatedConfig: IConfiguration = {
                        ...config,
                        bot: { ...config.bot, owners }
                    };
                    await db.updateServerConfig(serverId, updatedConfig);
                    break;
                }
                case "blockedUsers": {
                    const users = value.split(",").map((id) => id.trim());
                    const updatedConfig: IConfiguration = {
                        ...config,
                        security: {
                            ...config.security,
                            blockedUsers: users
                        }
                    };
                    await db.updateServerConfig(serverId, updatedConfig);
                    break;
                }
                default: {
                    await message.reply({
                        embeds: [
                            {
                                title: "Invalid Configuration Key",
                                description: "Available keys: prefix, cooldown, moderation, economy, owners, blockedUsers",
                                colour: "#ff0000",
                            },
                        ],
                    });
                    return;
                }
            }

            mainLogger.info(`Updated ${key} for server ${serverId}`);
            await message.reply({
                embeds: [
                    {
                        title: "Configuration Updated",
                        description: `Successfully updated ${key} to: ${value}`,
                        colour: "#00ff00",
                    },
                ],
            });
            return;
        }

        // Invalid usage
        await message.reply({
            embeds: [
                {
                    title: "Invalid Usage",
                    description: "Use `config view`, `config set <key> <value>`, or `config reset`",
                    colour: "#ff0000",
                },
            ],
        });
    },
};

export default ConfigCommand;
