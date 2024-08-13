import { ICommand } from "../../types";

const ping: ICommand = {
    name: "ping",
    description: "Ping the bot",
    usage: "ping",
    async execute(msg) {
        const sendDate = new Date().getTime();
        const testAPI = await fetch("https://api.revolt.com/"); // Lets assume that this testAPI is for pinging into the server, not the bot.
        const timeElapsed = new Date().getTime() - sendDate;
        msg.reply({
            embeds: [
                {
                    title: "Ping",
                    description: `# Pong!\nAPI's Latency is \`${timeElapsed}ms\``,
                },
            ],
        });
    },
};

module.exports = ping;
