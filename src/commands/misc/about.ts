import dayjs from "dayjs";
import { Message } from "revolt.js";
import { commands, packageInfo, startup, userCache } from "../..";
import { Command } from "../../types";

const about: Command = {
    name: "about",
    description: "About StationBot",
    args: false,
    async execute (message, _, client) {
        await message.reply({
            embeds: [
                {
                    title: "StationBot",
                    description: `Version: ${packageInfo.version}\nCommands Enabled: \`${Array.from(commands.keys()).join(", ")}\`\nServers Joined: \`${Array.from(client.servers.values()).length}\`\nUptime: <t:${Math.floor(startup.getTime()/1000)}:R>`
                }
            ]
        })
    }
}

export = about;