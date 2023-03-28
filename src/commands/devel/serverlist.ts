import { Command } from "../../types";

const serverlist: Command = {
    name: "serverlist",
    description: "Lists all servers the bot has joined",
    async execute(message, args, client) {
        const servers = Array.from(client.servers.values())
        const data: string[] = [];

        await message.reply("I am in:")

        return servers.forEach(async (server) => {
            await message.channel?.sendMessage(`- ${server.name}`);
        })
        
    },
}

export = serverlist;