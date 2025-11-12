import type { ICommand } from '../../types.js';
import { DatabaseService } from '../../services/DatabaseService.js';
import { mainLogger } from '../../utils/Logger.js';
import type { Message } from 'stoat.js';
import type { IConfiguration } from '../../types.js';

const ConfigCommand: ICommand = {
    name: 'config',
    description: 'Configure bot settings for your server',
    usage: 'config <view|set|reset> <key> <value>',
    category: 'System',

    async execute(message: Message, args: string[]): Promise<void> {
        if (!args?.length) {
            await message.reply({
                embeds: [
                    {
                        title: 'Error',
                        description:
                            'Please specify a subcommand: view, moderation, economy, owners',
                        colour: '#ff0000',
                    },
                ],
            });
            return;
        }

        const subcommand = args[0].toLowerCase();
        const serverId = message.channel?.server?.id;

        if (!serverId) {
            await message.reply({
                embeds: [
                    {
                        title: 'Error',
                        description:
                            'This command can only be used in a server',
                        colour: '#ff0000',
                    },
                ],
            });
            return;
        }

        const db = DatabaseService.getInstance();
        const config = await db.getServerConfig(serverId);

        switch (subcommand) {
            case 'view': {
                await message.reply({
                    embeds: [
                        {
                            title: 'Server Configuration',
                            description: [
                                '**Features:**',
                                `• Moderation: ${config.features.experiments.moderation ? '✅' : '❌'}`,
                                `• Economy: ${config.features.experiments.economy ? '✅' : '❌'}`,
                                `• AutoMod: ${config.automod.enabled ? '✅' : '❌'}`,
                                '',
                                '**AutoMod Settings:**',
                                `• Spam Filter: ${config.automod.filters.spam ? '✅' : '❌'}`,
                                `• Invite Filter: ${config.automod.filters.invites ? '✅' : '❌'}`,
                                `• Link Filter: ${config.automod.filters.links ? '✅' : '❌'}`,
                                `• Mention Filter: ${config.automod.filters.mentions ? '✅' : '❌'}`,
                                `• Caps Filter: ${config.automod.filters.caps ? '✅' : '❌'}`,
                                '',
                                '**Bot Settings:**',
                                `• Owners: ${config.bot.owners.length ? config.bot.owners.map((id) => `<@${id}>`).join(', ') : 'None'}`,
                                '',
                                'Use `config <setting> <value>` to modify settings',
                                'Example: `config moderation true`',
                            ].join('\n'),
                            colour: '#00ff00',
                        },
                    ],
                });
                return;
            }
            case 'moderation': {
                const key = args[1]?.toLowerCase();
                const value = args.slice(2).join(' ');

                if (!key) {
                    await message.reply({
                        embeds: [
                            {
                                title: 'Invalid Usage',
                                description:
                                    'Usage: config moderation set <true/false>',
                                colour: '#ff0000',
                            },
                        ],
                    });
                    return;
                }

                switch (key) {
                    case 'set': {
                        const updatedConfig: IConfiguration = {
                            ...config,
                            features: {
                                ...config.features,
                                experiments: {
                                    ...config.features.experiments,
                                    moderation: value === 'true',
                                },
                            },
                        };
                        await db.updateServerConfig(
                            serverId,
                            updatedConfig,
                        );
                        mainLogger.info(
                            `Updated moderation for server ${serverId}`,
                        );
                        await message.reply({
                            embeds: [
                                {
                                    title: 'Configuration Updated',
                                    description: `Successfully updated moderation to: ${value}`,
                                    colour: '#00ff00',
                                },
                            ],
                        });
                        return;
                    }
                    default: {
                        await message.reply({
                            embeds: [
                                {
                                    title: 'Invalid Configuration Key',
                                    description:
                                        'Available keys: set',
                                    colour: '#ff0000',
                                },
                            ],
                        });
                        return;
                    }
                }
            }
            case 'set': {
                const key = args[1]?.toLowerCase();
                const value = args.slice(2).join(' ');

                if (!key) {
                    await message.reply({
                        embeds: [
                            {
                                title: 'Invalid Usage',
                                description: [
                                    'Available settings:',
                                    '**Features:**',
                                    '• `moderation <true/false>` - Toggle moderation features',
                                    '• `economy <true/false>` - Toggle economy features',
                                    '• `automod <true/false>` - Toggle AutoMod features',
                                    '',
                                    '**Bot Settings:**',
                                    '• `prefix <value>` - Set bot prefix',
                                    '• `cooldown <value>` - Set command cooldown',
                                    '• `owners <id1,id2,...>` - Set bot owners',
                                    '• `blockedUsers <id1,id2,...>` - Set blocked users',
                                ].join('\n'),
                                colour: '#ff0000',
                            },
                        ],
                    });
                    return;
                }

                switch (key) {
                    case 'moderation': {
                        const updatedConfig: IConfiguration = {
                            ...config,
                            features: {
                                ...config.features,
                                experiments: {
                                    ...config.features.experiments,
                                    moderation: value === 'true',
                                },
                            },
                        };
                        await db.updateServerConfig(
                            serverId,
                            updatedConfig,
                        );
                        mainLogger.info(
                            `Updated moderation for server ${serverId} to ${value}`,
                        );
                        await message.reply({
                            embeds: [
                                {
                                    title: 'Configuration Updated',
                                    description: `Successfully ${value === 'true' ? 'enabled' : 'disabled'} moderation features`,
                                    colour: '#00ff00',
                                },
                            ],
                        });
                        return;
                    }
                    case 'economy': {
                        const updatedConfig: IConfiguration = {
                            ...config,
                            features: {
                                ...config.features,
                                experiments: {
                                    ...config.features.experiments,
                                    economy: value === 'true',
                                },
                            },
                        };
                        await db.updateServerConfig(
                            serverId,
                            updatedConfig,
                        );
                        mainLogger.info(
                            `Updated economy for server ${serverId} to ${value}`,
                        );
                        await message.reply({
                            embeds: [
                                {
                                    title: 'Configuration Updated',
                                    description: `Successfully ${value === 'true' ? 'enabled' : 'disabled'} economy features`,
                                    colour: '#00ff00',
                                },
                            ],
                        });
                        return;
                    }
                    case 'automod': {
                        const updatedConfig: IConfiguration = {
                            ...config,
                            features: {
                                ...config.features,
                                automod: value === 'true',
                            },
                            automod: {
                                ...config.automod,
                                enabled: value === 'true',
                            },
                        };
                        await db.updateServerConfig(
                            serverId,
                            updatedConfig,
                        );
                        mainLogger.info(
                            `Updated AutoMod for server ${serverId} to ${value}`,
                        );
                        await message.reply({
                            embeds: [
                                {
                                    title: 'Configuration Updated',
                                    description: `Successfully ${value === 'true' ? 'enabled' : 'disabled'} AutoMod features`,
                                    colour: '#00ff00',
                                },
                            ],
                        });
                        return;
                    }
                    case 'prefix': {
                        const updatedConfig: IConfiguration = {
                            ...config,
                            bot: { ...config.bot, prefix: value },
                        };
                        await db.updateServerConfig(
                            serverId,
                            updatedConfig,
                        );
                        mainLogger.info(
                            `Updated prefix for server ${serverId}`,
                        );
                        await message.reply({
                            embeds: [
                                {
                                    title: 'Configuration Updated',
                                    description: `Successfully updated prefix to: ${value}`,
                                    colour: '#00ff00',
                                },
                            ],
                        });
                        return;
                    }
                    case 'cooldown': {
                        const cooldown = Number.parseInt(value);
                        if (Number.isNaN(cooldown) || cooldown < 0) {
                            await message.reply({
                                embeds: [
                                    {
                                        title: 'Invalid Cooldown',
                                        description:
                                            'Cooldown must be a positive number',
                                        colour: '#ff0000',
                                    },
                                ],
                            });
                            return;
                        }
                        const updatedConfig: IConfiguration = {
                            ...config,
                            bot: {
                                ...config.bot,
                                defaultCooldown: cooldown,
                            },
                        };
                        await db.updateServerConfig(
                            serverId,
                            updatedConfig,
                        );
                        mainLogger.info(
                            `Updated cooldown for server ${serverId}`,
                        );
                        await message.reply({
                            embeds: [
                                {
                                    title: 'Configuration Updated',
                                    description: `Successfully updated cooldown to: ${cooldown}ms`,
                                    colour: '#00ff00',
                                },
                            ],
                        });
                        return;
                    }
                    case 'owners': {
                        const owners = value
                            .split(',')
                            .map((id) => id.trim());
                        const updatedConfig: IConfiguration = {
                            ...config,
                            bot: { ...config.bot, owners },
                        };
                        await db.updateServerConfig(
                            serverId,
                            updatedConfig,
                        );
                        mainLogger.info(
                            `Updated owners for server ${serverId}`,
                        );
                        await message.reply({
                            embeds: [
                                {
                                    title: 'Configuration Updated',
                                    description: `Successfully updated owners to: ${owners.map((id) => `<@${id}>`).join(', ')}`,
                                    colour: '#00ff00',
                                },
                            ],
                        });
                        return;
                    }
                    case 'blockedUsers': {
                        const users = value
                            .split(',')
                            .map((id) => id.trim());
                        const updatedConfig: IConfiguration = {
                            ...config,
                            security: {
                                ...config.security,
                                blockedUsers: users,
                            },
                        };
                        await db.updateServerConfig(
                            serverId,
                            updatedConfig,
                        );
                        mainLogger.info(
                            `Updated blocked users for server ${serverId}`,
                        );
                        await message.reply({
                            embeds: [
                                {
                                    title: 'Configuration Updated',
                                    description: `Successfully updated blocked users to: ${users.map((id) => `<@${id}>`).join(', ')}`,
                                    colour: '#00ff00',
                                },
                            ],
                        });
                        return;
                    }
                    default: {
                        await message.reply({
                            embeds: [
                                {
                                    title: 'Invalid Configuration Key',
                                    description:
                                        'Available keys: prefix, cooldown, owners, blockedUsers',
                                    colour: '#ff0000',
                                },
                            ],
                        });
                        return;
                    }
                }
            }
            case 'reset': {
                await db.createDefaultConfig(serverId);
                mainLogger.info(
                    `Reset configuration for server ${serverId}`,
                );
                await message.reply({
                    embeds: [
                        {
                            title: 'Configuration Reset',
                            description:
                                'Server configuration has been reset to defaults',
                            colour: '#00ff00',
                        },
                    ],
                });
                return;
            }
            default: {
                await message.reply({
                    embeds: [
                        {
                            title: 'Invalid Usage',
                            description:
                                'Use `config view`, `config set <key> <value>`, or `config reset`',
                            colour: '#ff0000',
                        },
                    ],
                });
                return;
            }
        }
    },
};

export default ConfigCommand;
