import { Client, Message } from "revolt.js";

type Category = "Moderation" | "Economy" | "System" | "Utility" | "Fun" | "Info" | "Hidden";

export interface RateLimitConfig {
    usages: number;      // How many times the command can be used
    duration: number;    // Time window in milliseconds
    users?: Map<string, RateLimitInfo>; // Track user rate limits
    global?: boolean;    // Whether this limit applies globally
}

export interface RateLimitInfo {
    usages: number;      // Current number of uses
    resetTime: number;   // When the rate limit resets
    lastUsed?: number;   // Last time the command was used
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
    };
    execute(
        message: Message,
        args: string[],
        client: Client,
    ): Promise<any>;
}

export interface IConfiguration {
    bot: {
        prefix: string;
        owners: string[];
        defaultCooldown: number;
    };
    commands: {
        disabled: string[];
        dangerous: string[];
    };
    features: {
        experiments: {
            moderation: boolean;
            economy: boolean;
        };
    };
    security: {
        blockedUsers: string[];
        allowedServers: string[];
    };
}

export type Events = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error(error: any): void;

    connected(): void;
    connecting(): void;
    disconnected(): void;
    ready(): void;
    logout(): void;

    messageCreate(message: Message): void;
}