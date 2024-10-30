import { ICommand } from "../../types";
import { commandLogger } from "../../utils";
import fs from "node:fs/promises";

const votekick: ICommand = {
    name: "votekick",
    description:
        "Starts a votekick for a user with a reason provided",
    usage: "votekick <userId> <reason>",
    async execute(msg, args) {
        let config;
        try {
            const data = await fs.readFile(
                `${msg.server?.id}-config.json`,
                "utf-8",
            );
            config = JSON.parse(data);
        } catch (err) {
            return msg.reply({
                embeds: [
                    {
                        title: "Error",
                        description: "Failed to read config file",
                        colour: "#ff0000",
                    },
                ],
            });
        }

        // Now you can use the config object
        if (config && config.blocked_users) {
            // Check if the user is in the blocked_users list
            if (config.blocked_users.includes(msg.author?.id)) {
                return msg.reply({
                    embeds: [
                        {
                            title: "Votekick",
                            description:
                                "You are blocked from using this command.",
                            colour: "#ff0000",
                        },
                    ],
                });
            }
        }

        if (!args || args.length < 2) {
            return msg.reply({
                embeds: [
                    {
                        title: "Votekick",
                        description:
                            "Please provide a user ID and a reason.",
                        colour: "#ff0000",
                    },
                ],
            });
        }
        let member;
        try {
            member = msg.server?.getMember(args[0]);
            msg.reply({
                embeds: [
                    {
                        title: "Votekick",
                        description:
                            `A user started a votekick against ${member?.displayName} (${member?.user?.username}#${member?.user?.discriminator})\nReason: ${args[1]}`,
                        colour: "#ff0000",
                    },
                ],
            })?.then((msg) => {
                msg.react(":white_check_mark:").catch((err) => {
                    throw new Error(err); // if it fails, you know what... (Think before you comment it please)
                });
                msg.react(":negative_squared_cross_mark:").catch((err) => {
                    throw new Error(err);
                });
            });
        } catch (error) {
            commandLogger.error(`Error getting member: ${error}`);
            return msg.reply({
                embeds: [
                    {
                        title: "Votekick",
                        description:
                            "Error retrieving member information.",
                        colour: "#ff0000",
                    },
                ],
            });
        }
    },
};

module.exports = votekick;
