import type { Client, Message } from 'stoat.js';
import type { Logger } from './utils/Logger.js';

export type Category =
    | 'Moderation'
    | 'Economy'
    | 'System'
    | 'Utility'
    | 'Fun'
    | 'Info'
    | 'Hidden';

export interface RateLimitConfig {
    usages: number; // How many times the command can be used
    duration: number; // Time window in milliseconds
    users?: Map<string, RateLimitInfo>; // Track user rate limits
    global?: boolean; // Whether this limit applies globally
}

export interface RateLimitInfo {
    usages: number; // Current number of uses
    resetTime: number; // When the rate limit resets
    lastUsed?: number; // Last time the command was used
}

export interface ICommand {
    name: string;
    description: string;
    category: Category;
    usage: string;
    aliases?: string[];
    args?: {
        required: boolean;
        minimum?: number;
        maximum?: number;
    };
    permissions?: {
        user?: string[];
        bot?: string[];
    };
    rateLimit?: RateLimitConfig; // Added rate limit configuration
    flags?: {
        wip?: boolean;
        disabled?: boolean;
        ownerOnly?: boolean;
        dangerous?: boolean;
        hidden?: boolean;
    };
    validate?: (args: string[]) => boolean;
    logger?: Logger;
    execute(
        message: Message,
        args: string[],
        client?: Client,
    ): Promise<any>;
}

export interface IConfiguration {
    prefix: string;
    welcomeChannel: string | null;
    logChannel: string | null;
    bot: {
        name: string;
        status: string;
        prefix: string;
        defaultCooldown: number;
        owners: string[];
    };
    commands: {
        enabled: boolean;
        disabled: string[];
        dangerous: string[];
    };
    features: {
        welcome: boolean;
        logging: boolean;
        automod: boolean;
        experiments: {
            moderation: boolean;
            economy: boolean;
        };
    };
    security: {
        antiSpam: boolean;
        maxMentions: number;
        maxLines: number;
        blockedUsers: string[];
        allowedServers: string[];
    };
    automod: {
        enabled: boolean;
        filters: {
            spam: boolean;
            invites: boolean;
            links: boolean;
            mentions: boolean;
            caps: boolean;
        };
        thresholds: {
            maxMentions: number;
            maxCaps: number;
            messageBurst: number;
        };
        whitelist: {
            users: string[];
            roles: string[];
            channels: string[];
            links: string[];
        };
        actions: {
            delete: boolean;
            warn: boolean;
            timeout?: number;
        };
    };
}

export type Events = {
    error(error: Error): void;

    connected(): void;
    connecting(): void;
    disconnected(): void;
    ready(): void;
    logout(): void;

    messageCreate(message: Message): void;
};

export interface UserEconomy {
    balance: number;
    bank: number;
    lastDaily: Date | null;
    lastWork: Date | null;
    workStreak: number;
    inventory: string[];
    total: number;
    user_id: string;
}

export interface ShopItem {
    id: string;
    name: string;
    description: string;
    price: number;
    type: 'collectable' | 'usable' | 'rare';
    emoji?: string;
}

export interface TodoItem {
    id: number;
    server_id: string;
    user_id: string;
    content: string;
    completed: boolean;
    created_at: number;
    updated_at: number;
}

export interface ErrorHandler {
    message: string;
    statusCode: number;
}

export interface AutoModConfig {
    enabled: boolean;
    filters: {
        spam: boolean;
        invites: boolean;
        links: boolean;
        mentions: boolean;
        caps: boolean;
    };
    thresholds: {
        maxMentions: number;
        maxCaps: number;
        maxLines: number;
        messageInterval: number; // ms between messages
        messageBurst: number; // max messages in interval
    };
    actions: {
        warn: boolean;
        delete: boolean;
        timeout?: number; // timeout duration in minutes
    };
    whitelist: {
        users: string[];
        roles: string[];
        channels: string[];
        links: string[];
    };
}

export interface AutoModViolation {
    type: 'spam' | 'invites' | 'links' | 'mentions' | 'caps';
    userId: string;
    channelId: string;
    messageId: string;
    timestamp: number;
    details?: string;
}
