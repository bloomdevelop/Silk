import { ICommand } from "../../types.js";
import { Logger } from "../../utils/Logger.js";
import { Message } from "revolt.js";

const OPTION_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const MAX_OPTIONS = 10;

const poll: ICommand = {
    name: "poll",
    description: "Create a poll with up to 10 options",
    usage: "poll <question> | <option1> | <option2> | [option3] ...\nExample: poll What's for dinner? | Pizza | Burger | Salad",
    category: "Utility",
    aliases: ["vote"],
    logger: Logger.getInstance("poll"),

    async execute(msg: Message, args: string[]): Promise<void> {
        // Join all arguments and split by |
        const input = args.join(" ").split("|").map(item => item.trim());

        if (input.length < 3) {
            await msg.reply({
                embeds: [{
                    title: "Error",
                    description: [
                        "Please provide a question and at least 2 options!",
                        "",
                        "**Format:**",
                        "`poll <question> | <option1> | <option2> | [option3] ...`",
                        "",
                        "**Example:**",
                        "`poll What's for dinner? | Pizza | Burger | Salad`"
                    ].join("\n"),
                    colour: "#ff0000"
                }]
            });
            return;
        }

        const question = input[0];
        const options = input.slice(1);

        if (options.length > MAX_OPTIONS) {
            await msg.reply({
                embeds: [{
                    title: "Error",
                    description: `Maximum number of options is ${MAX_OPTIONS}!`,
                    colour: "#ff0000"
                }]
            });
            return;
        }

        // Create poll message
        const pollMessage = await msg.reply({
            embeds: [{
                title: "📊 " + question,
                description: [
                    "**Options:**",
                    ...options.map((option, index) => 
                        `${OPTION_EMOJIS[index]} ${option}`
                    ),
                    "",
                    `Poll started by ${msg.author?.username}`,
                    "React with the corresponding number to vote!"
                ].join("\n"),
                colour: "#00ff00"
            }]
        });

        if (!pollMessage) {
            this.logger?.error("Failed to create poll message");
            return;
        }

        // Add reactions one by one with error handling
        try {
            for (let i = 0; i < options.length; i++) {
                try {
                    await pollMessage.react(encodeURIComponent(OPTION_EMOJIS[i]));
                    // Small delay to prevent rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    this.logger?.error(`Failed to add reaction ${OPTION_EMOJIS[i]}:`, error);
                }
            }
        } catch (error) {
            this.logger?.error("Error adding reactions:", error);
            await msg.reply({
                embeds: [{
                    title: "Warning",
                    description: "Poll created but some reactions couldn't be added. Users can still react manually.",
                    colour: "#ffff00"
                }]
            });
        }

        // Optional: Set up a timer to end the poll
        // setTimeout(async () => {
        //     try {
        //         const updatedPoll = await pollMessage.fetch();
        //         const results = options.map((option, index) => ({
        //             option,
        //             votes: updatedPoll.reactions?.[OPTION_EMOJIS[index]]?.count || 0
        //         }));

        //         await pollMessage.edit({
        //             embeds: [{
        //                 title: "📊 Poll Results: " + question,
        //                 description: [
        //                     "**Final Results:**",
        //                     ...results.map(result => 
        //                         `${result.option}: ${result.votes} votes`
        //                     ),
        //                     "",
        //                     "Poll has ended!"
        //                 ].join("\n"),
        //                 colour: "#0000ff"
        //             }]
        //         });
        //     } catch (error) {
        //         this.logger?.error("Error ending poll:", error);
        //     }
        // }, 24 * 60 * 60 * 1000); // 24 hours
    }
};

export default poll; 