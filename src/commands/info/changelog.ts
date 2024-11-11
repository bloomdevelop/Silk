import { ICommand } from "../../types.js";
import { Message } from "revolt.js";
import { mainLogger } from "../../utils/Logger.js";
import { VersionManager } from "../../managers/VersionManager.js";

const changelog: ICommand = {
    name: "changelog",
    description: "Shows the bot's latest updates",
    usage: "changelog",
    category: "Info",
    aliases: ["updates", "version"],

    async execute(msg: Message): Promise<void> {
        try {
            // Send initial loading message
            const loadingMessage = await msg.reply({
                embeds: [
                    {
                        title: "Loading changelog...",
                        description: "Please wait...",
                        colour: "#00ff00",
                    },
                ],
            });

            const versionManager = await VersionManager.getInstance();
            const currentVersion = versionManager.getCurrentVersion();
            const changelogData = await versionManager.getChangelog();

            // Delete loading message
            await loadingMessage?.edit({
                embeds: [
                    {
                        title: `Silk Bot Changelog (v${currentVersion})`,
                        description: changelogData
                            .map((version) =>
                                [
                                    `**v${version.version}** - ${version.date}`,
                                    ...version.changes.map(
                                        (change) => `• ${change}`,
                                    ),
                                    "",
                                ].join("\n"),
                            )
                            .join("\n"),
                        colour: "#00ff00",
                    },
                ],
            })
        } catch (error) {
            mainLogger.error(
                "Error executing changelog command:",
                error,
            );
            await msg.reply({
                embeds: [
                    {
                        title: "Error",
                        description:
                            "Failed to fetch changelog information",
                        colour: "#ff0000",
                    },
                ],
            });
        }
    },
};

export default changelog;
