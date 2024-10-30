import { ICommand } from "../../types";
import { DatabaseService } from "../../services/DatabaseService";
import { commandLogger } from "../../utils";

const config: ICommand = {
    name: "config",
    description: "Configure bot settings for your server",
    usage: "config <view|set> <key> <value>",
    category: "admin",
    execute: async (message, args) => {
        const db = DatabaseService.getInstance();
        const serverId = message.server?.id;

        if (!serverId) {
            return message.reply({
                embeds: [{
                    title: "Configuration",
                    description: "This command can only be used in servers",
                    colour: "#ff0000"
                }]
            });
        }

        if (!args.length || args[0] === "view") {
            const config = await db.getServerConfig(serverId);
            return message.reply({
                embeds: [{
                    title: "Server Configuration",
                    description: `\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\``,
                    colour: "#00ff00"
                }]
            });
        }

        if (args[0] === "set" && args.length >= 3) {
            const [, key, value] = args;
            const config = await db.getServerConfig(serverId);

            switch (key) {
                case "prefix":
                    await db.updateServerConfig(serverId, {
                        bot: { ...config.bot, prefix: value }
                    });
                    break;

                case "moderation":
                    await db.updateServerConfig(serverId, {
                        features: {
                            ...config.features,
                            experiments: {
                                ...config.features.experiments,
                                moderation: value === "true"
                            }
                        }
                    });
                    break;

                default:
                    return message.reply({
                        embeds: [{
                            title: "Invalid Configuration Key",
                            description: "Available keys: prefix, moderation",
                            colour: "#ff0000"
                        }]
                    });
            }

            commandLogger.info(`Updated ${key} for server ${serverId}`);
            return message.reply({
                embeds: [{
                    title: "Configuration Updated",
                    description: `Successfully updated ${key}`,
                    colour: "#00ff00"
                }]
            });
        }

        return message.reply({
            embeds: [{
                title: "Invalid Usage",
                description: "Use `config view` or `config set <key> <value>`",
                colour: "#ff0000"
            }]
        });
    }
};

module.exports = config;