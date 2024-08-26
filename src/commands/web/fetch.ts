import { MessageEmbed, TextEmbed } from "revolt.js";
import { ICommand } from "../../types";

const fetch: ICommand = {
  name: "fetch",
  description: "Fetches a URL and returns the response in json",
  usage: "fetch <url> <useHttps>",
  aliases: ["curl", "wget", "aria2", "xh"],
  async execute(message, args) {
    if (!args || args.length < 1)
      return message.reply("Please provide a URL to fetch");
    try {
      const url = args[0];
      const useHttps = args[0];
      const response = await global.fetch(
        `${useHttps === "true" ? "https" : "http"}://${url}`,
      );
      const json = await response.json();
      return await message.reply({
        embeds: [
          {
            title: "Fetch Command",
            colour: "#00ff00",
            description: `\`\`\`json\n${JSON.stringify(json, null, 2)}\n\`\`\``,
          },
        ],
      });
    } catch (err) {
      return message.reply({
        embeds: [
          {
            title: "Error",
            colour: "#ff0000",
            description: `# Something went wrong!\n\`\`\`ts\n${err}\n\`\`\``,
          },
        ],
      });
    }
  },
};

module.exports = fetch;
