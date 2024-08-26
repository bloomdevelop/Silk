import { ICommand } from "../../types";

const ping: ICommand = {
    name: "ping",
    description: "Ping the bot",
    usage: "ping",
    async execute(msg) {
        const sendDate = new Date().getTime();
        const testAPI = await fetch("https://api.revolt.chat/"); // Lets assume that this testAPI is for pinging into the server, not the bot.
        const timeElapsed = new Date().getTime() - sendDate;
        msg.reply({
            embeds: [
                {
                    title: "Ping",
                    description: `# Pong!\nRevolt API's Latency is \`${timeElapsed}ms\``,
                    colour: "#00FF00",
                },
            ],
        });
    },
};

module.exports = ping;
