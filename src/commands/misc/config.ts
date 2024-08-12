import { ICommand, IConfiguration } from "@/types";
import fs from "node:fs/promises";

const default_settings: IConfiguration = {
  disabled_commands: [],
  prefix: "s?",
  experiments: {
    experimental_moderation: true,
  },
};

const config: ICommand = {
  name: "config",
  description:
    "Configures the bot, only on your server, not system-wide.",
  async execute(msg, args, revolt) {
    const fileTemplate = `config/${msg.server?.id}-config.json`;
    if (!args)
      return msg.reply({
        embeds: [
          {
            title: "Configuration",
            description: "No arguments were provided!",
          },
        ],
      });
    if (args[0] == "new") {
      try {
        const file = await fs
          .stat(fileTemplate)
          .catch(() => {
            return;
          });
        if (file)
          return msg.reply({
            embeds: [
              {
                title: "Configuration",
                description:
                  "A configuration file already exists for this server!",
              },
            ],
          });

        fs.appendFile(
          fileTemplate,
          JSON.stringify(default_settings, null, 2),
        ).then(() => {
          msg.reply({
            embeds: [
              {
                title: "Configuration",
                description: "Configuration file created!",
              },
            ],
          });
        });
      } catch (err) {
        msg.reply({
          embeds: [
            {
              title: "Configuration",
              description: `Something went wrong while creating the configuration file!\n\`\`\`\n${err}\n\`\`\``,
            },
          ],
        });
      }
    }
  },
};

module.exports = config;
