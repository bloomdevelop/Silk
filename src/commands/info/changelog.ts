import { ICommand } from "../../types.js";
import { Message } from "revolt.js";
import { mainLogger } from "../../utils/Logger.js";
import { VersionManager } from "../../managers/VersionManager.js";

const changelog: ICommand = {
    name: "changelog",
    description: "Shows the bot's version history and updates",
    usage: "changelog [version]",
    category: "Info",
    aliases: ["updates", "version"],

    async execute(msg: Message, args: string[]): Promise<void> {
        const versionManager = VersionManager.getInstance();

        try {
            // Send initial loading message
            const loadingMessage = await msg.reply(
                "Generating changelog data...",
            );

            const currentVersion = versionManager.getCurrentVersion();
            const changelogData = versionManager.getChangelog();

            // Delete loading message
            await loadingMessage?.delete();

            if (args.length > 0) {
                const requestedVersion = args[0];
                const versionEntry = changelogData.find(
                    (entry) => entry.version === requestedVersion,
                );

                if (!versionEntry) {
                    await msg.reply({
                        embeds: [
                            {
                                title: "Version Not Found",
                                description: `Version ${requestedVersion} not found in changelog`,
                                colour: "#ff0000",
                            },
                        ],
                    });
                    return;
                }

                await msg.reply({
                    embeds: [
                        {
                            title: `Changelog for v${versionEntry.version}`,
                            description: [
                                `**Released:** ${versionEntry.date}`,
                                "",
                                "**Changes:**",
                                ...versionEntry.changes.map(
                                    (change) => `• ${change}`,
                                ),
                            ].join("\n"),
                            colour: "#00ff00",
                        },
                    ],
                });
                return;
            }

            const recentVersions = changelogData.slice(0, 5);
            await msg.reply({
                embeds: [
                    {
                        title: `Silk Bot Changelog (Current: v${currentVersion})`,
                        description: [
                            recentVersions
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
                            "\nUse `changelog <version>` to see a specific version",
                        ].join("\n"),
                        colour: "#00ff00",
                    },
                ],
            });
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
