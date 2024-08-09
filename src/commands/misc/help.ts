import { commands } from "../../index"; // I had to manually use relative import bc of f****king TS :/
import { ICommand } from "@/types";

const help: ICommand = {
  name: "help",
  description: "Help",
  usage: "help <command>",
  async execute(msg, args) {
    const commandsList = Array.from(commands.entries())
      .map(([name, cmd]) => {
        const aliases = cmd.aliases?.length
          ? cmd.aliases.join(", ")
          : "No aliases";
        return `- **${name}** Aliases: ${aliases}`;
      })
      .join("\n");
    if (args) {
      let commandInfo;
      for (const [name, cmd] of commands.entries()) {
        if (name === args[0] || cmd.aliases?.includes(args[0])) {
          commandInfo = cmd;
          break;
        }
      }

      if (!commandInfo)
        return msg.reply({
          embeds: [
            {
              title: "Help",
              description: `No commands was found, but there's a list of available commands:\n${commandsList}`,
            },
          ],
        });

      msg.reply({
        embeds: [
          {
            title: `Help`,
            description: `# ${commandInfo?.name}\n${commandInfo?.description}\n## Usage\n${commandInfo?.usage ? `\`${commandInfo?.usage}\`` : "This command doesn't have usage"}\n## Aliases\n${
              commandInfo?.aliases
                ? commandInfo.aliases
                    .map((a) => `\`${a}\``)
                    .join(", ")
                : "This command doesn't have aliases"
            }`,
          },
        ],
      });
    } else
      return msg.reply({
        embeds: [
          {
            title: "Help",
            description:
              "Use `help <command>` to get more information about a specific command.",
          },
        ],
      });
  },
};
module.exports = help;
