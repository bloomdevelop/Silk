import { ICommand } from "../../types";

const ping: ICommand = {
  name: "ping",
  description: "Ping the bot",
  usage: "ping",
  async execute(msg) {
    const sendDate = new Date().getTime();
    const testAPI = await fetch("https://api.revolt.com/");
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
