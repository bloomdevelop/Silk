import { ICommand } from "../../types.js";

const programming_quotes: ICommand = {
    name: "programming_quotes",
    description:
        "Uses [Programming Quotes API](https://programming-quotesapi.vercel.app/) for get random quotes.",
    category: "Utility",
    usage: "programming_quote",
    aliases: ["p_quote"],
    async execute(msg) {
        await fetch(
            `https://programming-quotesapi.vercel.app/api/random`,
        )
            .then((res) => res.json())
            .then((data) => {
                msg.reply({
                    embeds: [
                        {
                            title: "Programming Quotes",
                            description: `*"${data.quote}"*\n\- ${data.author}`,
                        },
                    ],
                });
            });
    },
};

export default programming_quotes;
