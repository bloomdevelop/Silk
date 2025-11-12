import type { ICommand, ShopItem } from "../../types.js";

const shopItems: ShopItem[] = [
    {
        id: "trophy",
        name: "Trophy",
        description: "A shiny trophy to show off your wealth",
        price: 10000,
        type: "collectable",
        emoji: "🏆"
    },
    {
        id: "lucky_coin",
        name: "Lucky Coin",
        description: "Increases your work rewards by 10%",
        price: 5000,
        type: "usable",
        emoji: "🪙"
    },
    // Add more items as needed
];

const shop: ICommand = {
    name: "shop",
    description: "View available items in the shop",
    usage: "shop",
    category: "Economy",

    async execute(msg) {
        const itemList = shopItems.map(item => 
            `${item.emoji} **${item.name}** - 💰 ${item.price}\n` +
            `*${item.description}*`
        ).join("\n\n");

        return msg.reply({
            embeds: [{
                title: "🏪 Shop",
                description: [
                    "Welcome to the shop! Here's what's available:",
                    "",
                    itemList,
                    "",
                    "Use `buy <item>` to purchase an item!"
                ].join("\n"),
                colour: "#00ff00"
            }]
        });
    }
};

export default shop; 