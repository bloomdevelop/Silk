import { Message } from "revolt.js";
import { Command } from "../../types";
import OpenAI from "openai";

const chat: Command = {
  name: "chat",
  description: "talk to a bot",
  use: "<prompt>",
  args: true,
  async execute(message: Message, args: string[]) {
    const prompt: string = args.join(" ");
    const openai = new OpenAI({
      apiKey: process.env.AI_API_KEY,
    });
    const response: any = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    message.channel?.sendMessage(response.choices[0]?.message?.content);
  },
};

module.exports = chat;
