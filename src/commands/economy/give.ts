import type { ICommand } from '../../types.js';
import { DatabaseService } from '../../services/DatabaseService.js';

const give: ICommand = {
    name: 'give',
    description: 'Give money to another user',
    usage: 'give <user> <amount>',
    category: 'Economy',
    aliases: ['pay', 'transfer'],

    async execute(msg, args) {
        if (!args || args.length < 2) {
            return msg.reply({
                embeds: [
                    {
                        title: 'Error',
                        description:
                            'Please specify a user and amount\nUsage: `give <user> <amount>`',
                        colour: '#ff0000',
                    },
                ],
            });
        }

        const db = DatabaseService.getInstance();
        const fromUserId = msg.author?.id;
        if (!fromUserId) return;

        // Try to find the target user
        const targetId = args[0];
        const amount = Number.parseInt(args[1]);

        if (Number.isNaN(amount) || amount <= 0) {
            return msg.reply({
                embeds: [
                    {
                        title: 'Error',
                        description: 'Please provide a valid amount',
                        colour: '#ff0000',
                    },
                ],
            });
        }

        if (fromUserId === targetId) {
            return msg.reply({
                embeds: [
                    {
                        title: 'Error',
                        description:
                            "You can't give money to yourself",
                        colour: '#ff0000',
                    },
                ],
            });
        }

        const fromEconomy = await db.getUserEconomy(fromUserId);
        if (amount > fromEconomy.balance) {
            return msg.reply({
                embeds: [
                    {
                        title: 'Error',
                        description:
                            "You don't have enough money in your wallet",
                        colour: '#ff0000',
                    },
                ],
            });
        }

        const toEconomy = await db.getUserEconomy(targetId);

        // Perform the transfer
        fromEconomy.balance -= amount;
        toEconomy.balance += amount;

        await db.updateUserEconomy(fromUserId, fromEconomy);
        await db.updateUserEconomy(targetId, toEconomy);

        return msg.reply({
            embeds: [
                {
                    title: 'Transfer Successful',
                    description: [
                        `Transferred: 💰 ${amount} to <@${targetId}>`,
                        `Your new balance: 💰 ${fromEconomy.balance}`,
                    ].join('\n'),
                    colour: '#00ff00',
                },
            ],
        });
    },
};

export default give;
