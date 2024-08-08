import { Command } from "../../types";

const ping: Command = {
    name: "ping",
    description: "Ping the bot",
    execute: async (msg, args) => {
        msg.reply("Pong!");
    },
};

module.exports = ping;