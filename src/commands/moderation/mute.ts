import type { ICommand } from '../../types.js';
import { Logger } from '../../utils/Logger.js';
import type { Message } from 'stoat.js';
import { DatabaseService } from '../../services/DatabaseService.js';

const mute: ICommand = {
    name: 'mute',
    description: 'Mute a user for a specified duration',
    usage: 'mute <user> <duration> [reason]\nExample: mute @user 1h spam',
    category: 'Moderation',
    aliases: ['timeout'],
    logger: Logger.getInstance('mute'),

    async execute(msg: Message, args: string[]): Promise<void> {
        const db = DatabaseService.getInstance();
        const server = msg.channel?.server;

        if (!server) {
            await msg.reply({
                embeds: [
                    {
                        title: 'Error',
                        description:
                            'This command can only be used in servers!',
                        colour: '#ff0000',
                    },
                ],
            });
            return;
        }

        // Check if moderation is enabled
        const config = await db.getServerConfig(server.id);
        if (!config.features.experiments.moderation) {
            await msg.reply({
                embeds: [
                    {
                        title: 'Feature Disabled',
                        description:
                            'Moderation commands are disabled on this server',
                        colour: '#ff0000',
                    },
                ],
            });
            return;
        }

        // Check permissions
        if (!msg.member?.hasPermission(server, 'KickMembers')) {
            await msg.reply({
                embeds: [
                    {
                        title: 'Error',
                        description:
                            'You need the Kick Members permission to use this command',
                        colour: '#ff0000',
                    },
                ],
            });
            return;
        }

        if (args.length < 2) {
            await msg.reply({
                embeds: [
                    {
                        title: 'Error',
                        description: [
                            'Please provide a user and duration!',
                            '**Usage:** `mute <user> <duration> [reason]`',
                            '**Example:** `mute @user 1h spam`',
                            '',
                            '**Duration format:**',
                            '• d = days',
                            '• h = hours',
                            '• m = minutes',
                            '',
                            '**Examples:**',
                            '• 1h30m',
                            '• 2d',
                            '• 45m',
                        ].join('\n'),
                        colour: '#ff0000',
                    },
                ],
            });
            return;
        }

        try {
            const targetId = args[0].replace(/[<@>]/g, '');
            const duration = parseDuration(args[1]);
            const reason =
                args.slice(2).join(' ') || 'No reason provided';

            if (duration === 0) {
                await msg.reply({
                    embeds: [
                        {
                            title: 'Error',
                            description: 'Invalid duration format!',
                            colour: '#ff0000',
                        },
                    ],
                });
                return;
            }

            const maxDuration = 28 * 24 * 60 * 60 * 1000; // 28 days
            if (duration > maxDuration) {
                await msg.reply({
                    embeds: [
                        {
                            title: 'Error',
                            description:
                                'Mute duration cannot exceed 28 days!',
                            colour: '#ff0000',
                        },
                    ],
                });
                return;
            }

            const targetMember = await server.fetchMember(targetId);

            if (!targetMember) {
                await msg.reply({
                    embeds: [
                        {
                            title: 'Error',
                            description:
                                'User not found in this server',
                            colour: '#ff0000',
                        },
                    ],
                });
                return;
            }

            // Check if target is moderator
            if (targetMember.hasPermission(server, 'KickMembers')) {
                await msg.reply({
                    embeds: [
                        {
                            title: 'Error',
                            description: 'Cannot mute a moderator',
                            colour: '#ff0000',
                        },
                    ],
                });
                return;
            }

            // Check if we can timeout the member
            if (!targetMember) {
                await msg.reply({
                    embeds: [
                        {
                            title: 'Error',
                            description:
                                'Cannot mute this user. Missing permissions or invalid user.',
                            colour: '#ff0000',
                        },
                    ],
                });
                return;
            }

            // Apply timeout using edit method
            await targetMember.edit({
                timeout: new Date(
                    Date.now() + duration,
                ).toISOString(),
            });

            // Log the mute
            this.logger?.info(
                `${msg.author?.username} muted ${targetMember.user?.username} for ${formatDuration(duration)}: ${reason}`,
            );

            // Send confirmation
            await msg.reply({
                embeds: [
                    {
                        title: 'User Muted',
                        description: [
                            `**User:** ${targetMember.user?.username}`,
                            `**Duration:** ${formatDuration(duration)}`,
                            `**Reason:** ${reason}`,
                            `**Muted by:** ${msg.author?.username}`,
                        ].join('\n'),
                        colour: '#00ff00',
                    },
                ],
            });

            // Try to DM the user
            try {
                const dmChannel = await targetMember.user?.openDM();
                if (dmChannel) {
                    await dmChannel.sendMessage({
                        embeds: [
                            {
                                title: 'You have been muted',
                                description: [
                                    `You have been muted in ${server.name}`,
                                    `**Duration:** ${formatDuration(duration)}`,
                                    `**Reason:** ${reason}`,
                                ].join('\n'),
                                colour: '#ff0000',
                            },
                        ],
                    });
                }
            } catch (error) {
                this.logger?.warn('Failed to DM muted user:', error);
            }
        } catch (error) {
            this.logger?.error(
                'Error executing mute command:',
                error,
            );
            await msg.reply({
                embeds: [
                    {
                        title: 'Error',
                        description:
                            'Failed to mute user. Make sure I have the required permissions.',
                        colour: '#ff0000',
                    },
                ],
            });
        }
    },
};

// Helper function to parse duration string (e.g., "1h30m", "2d", "45m")
function parseDuration(durationStr: string): number {
    let totalMs = 0;
    const regex = /(\d+)([dhm])/g;
    const match = regex.exec(durationStr);

    while (match !== null) {
        const value = Number.parseInt(match[1]);
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
    const remainingMs = ms % (24 * 60 * 60 * 1000);
    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const remainingHours = remainingMs % (60 * 60 * 1000);
    const minutes = Math.floor(remainingHours / (60 * 1000));

    const parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0)
        parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0)
        parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);

    return parts.join(', ');
}

export default mute;
