import { ICommand } from "../../types.js";
import { Logger } from "../../utils/Logger.js";
import { Message } from "stoat.js";

interface Reminder {
    userId: string;
    channelId: string;
    message: string;
    timestamp: number;
}

const reminders = new Map<string, Reminder>();

const reminder: ICommand = {
    name: "reminder",
    description: "Set a reminder for later",
    usage: "reminder <time> <message>\nExample: reminder 1h30m Check the laundry",
    category: "Utility",
    aliases: ["remind", "remindme"],
    logger: Logger.getInstance("reminder"),

    async execute(msg: Message, args: string[]): Promise<void> {
        if (args.length < 2) {
            await msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Please provide both time and message!\nExample: `reminder 1h30m Check the laundry`",
                    colour: "#ff0000"
                }]
            });
            return;
        }

        const timeStr = args[0].toLowerCase();
        const message = args.slice(1).join(" ");

        // Parse time string (e.g., 1h30m, 2d, 45m)
        const duration = parseTimeString(timeStr);
        if (duration === 0) {
            await msg.reply({
                embeds: [{
                    title: "Error",
                    description: [
                        "Invalid time format! Please use a combination of:",
                        "• d (days)",
                        "• h (hours)",
                        "• m (minutes)",
                        "",
                        "Examples:",
                        "• 1h30m",
                        "• 2d",
                        "• 45m"
                    ].join("\n"),
                    colour: "#ff0000"
                }]
            });
            return;
        }

        // Check if duration is too long (max 30 days)
        const maxDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        if (duration > maxDuration) {
            await msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Reminder time cannot be longer than 30 days!",
                    colour: "#ff0000"
                }]
            });
            return;
        }

        // Create reminder
        const timestamp = Date.now() + duration;
        const reminderId = `${msg.author_id}-${timestamp}`;
        
        const reminder: Reminder = {
            userId: msg.author_id,
            channelId: msg.channel_id,
            message: message,
            timestamp: timestamp
        };

        reminders.set(reminderId, reminder);

        // Set timeout for the reminder
        setTimeout(async () => {
            try {
                const channel = await msg.client.channels.get(reminder.channelId);
                if (channel?.havePermission("SendMessage")) {
                    await channel.sendMessage({
                        content: `<@${reminder.userId}>`,
                        embeds: [{
                            title: "⏰ Reminder",
                            description: reminder.message,
                            colour: "#00ff00"
                        }]
                    });
                }
                reminders.delete(reminderId);
            } catch (error) {
                this.logger?.error("Failed to send reminder:", error);
            }
        }, duration);

        // Format confirmation message
        const formattedTime = formatDuration(duration);
        await msg.reply({
            embeds: [{
                title: "⏰ Reminder Set",
                description: [
                    `I'll remind you in **${formattedTime}**`,
                    `About: ${message}`,
                    "",
                    `Reminder will trigger <t:${Math.floor(timestamp / 1000)}:R>`
                ].join("\n"),
                colour: "#00ff00"
            }]
        });
    }
};

// Helper function to parse time string
function parseTimeString(timeStr: string): number {
    let totalMs = 0;
    const regex = /(\d+)([dhm])/g;
    let match;

    while ((match = regex.exec(timeStr)) !== null) {
        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'd':
                totalMs += value * 24 * 60 * 60 * 1000;
                break;
            case 'h':
                totalMs += value * 60 * 60 * 1000;
                break;
            case 'm':
                totalMs += value * 60 * 1000;
                break;
        }
    }

    return totalMs;
}

// Helper function to format duration for display
function formatDuration(ms: number): string {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    ms %= 24 * 60 * 60 * 1000;
    const hours = Math.floor(ms / (60 * 60 * 1000));
    ms %= 60 * 60 * 1000;
    const minutes = Math.floor(ms / (60 * 1000));

    const parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);

    return parts.join(', ');
}

export default reminder; 