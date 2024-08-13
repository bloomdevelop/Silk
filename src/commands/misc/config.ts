import { ICommand, IConfiguration } from "@/types";
import fs from "node:fs/promises";

const default_settings: IConfiguration = {
    disabled_commands: [],
    prefix: "s?",
    dangerous_command: false,
    experiments: {
        experimental_moderation: true,
    },
    blocked_users: []
};

const config: ICommand = {
    name: "config",
    description:
        "Configures the bot, only on your server, not system-wide.",
    usage: "config <get|set|new> <set:key> <set:value>",
    async execute(msg, args) {
        const fileTemplate = `${msg.server?.id}-config.json`;
        if (!args)
            return msg.reply({
                embeds: [
                    {
                        title: "Configuration",
                        description: "No arguments were provided!",
                    },
                ],
            });
        if (args[0] == "new") {
            try {
                const file = await fs.stat(fileTemplate).catch(() => {
                    return;
                });
                if (file)
                    return msg.reply({
                        embeds: [
                            {
                                title: "Configuration",
                                description:
                                    "A configuration file already exists for this server!",
                            },
                        ],
                    });

                fs.appendFile(
                    fileTemplate,
                    JSON.stringify(default_settings, null, 2),
                ).then(() => {
                    msg.reply({
                        embeds: [
                            {
                                title: "Configuration",
                                description:
                                    "Configuration file created!",
                            },
                        ],
                    });
                });
            } catch (err) {
                msg.reply({
                    embeds: [
                        {
                            title: "Configuration",
                            description: `Something went wrong while creating the configuration file!\n\`\`\`\n${err}\n\`\`\``,
                        },
                    ],
                });
            }
        }

        if (args[0] == "get") {
            try {
                const file = await fs.readFile(
                    `${fileTemplate}`,
                    "utf-8",
                );
                const fileJSON = JSON.parse(file);
                msg.reply({
                    embeds: [
                        {
                            title: "Configuration",
                            description: `Your server's configuration:\n\`\`\`json\n${JSON.stringify(fileJSON, null, 2)}\n\`\`\``,
                        },
                    ],
                });
            } catch (err) {
                return msg.reply({
                    embeds: [
                        {
                            title: "Configuration",
                            description: `Something went wrong while getting the configuration file!\n\`\`\`\n${err}\n\`\`\``,
                        },
                    ],
                });
            }
        }
        if (args[0] == "set") {
            if (!args[1])
                return msg.reply({
                    embeds: [
                        {
                            title: "Configuration",
                            description:
                                "No arguments were provided!",
                        },
                    ],
                });
            try {
                const file = await fs.readFile(
                    `${fileTemplate}`,
                    "utf-8",
                );
                const fileJSON = JSON.parse(file);
                const newFile = JSON.stringify(
                    {
                        ...fileJSON,
                        ...(args[1] == "prefix"
                            ? {
                                  prefix: args[2],
                              }
                            : {} || args[1] == "disabled_commands"
                              ? {
                                    disabled_commands: [
                                        args[2]
                                            .replace(/,/gm, " ")
                                            .trim()
                                            .split(" ")
                                            .flat(),
                                    ],
                                }
                              : {}),
                    },
                    null,
                    2,
                );
                fs.writeFile(`${fileTemplate}`, newFile).then(() => {
                    msg.reply({
                        embeds: [
                            {
                                title: "Configuration",
                                description:
                                    "Configuration file updated!",
                            },
                        ],
                    });
                });
            } catch (err) {
                return msg.reply({
                    embeds: [
                        {
                            title: "Configuration",
                            description: `Something went wrong while getting the configuration file!\n\`\`\`\n${err}\n\`\`\``,
                        },
                    ],
                });
            }
        }
    },
};

module.exports = config;
