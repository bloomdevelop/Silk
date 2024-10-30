import { Client, Message } from "revolt.js";

export interface ICommand {
    name: string;
    description: string;
    category?: string;
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
    cooldown?: {
        duration: number;
        users?: Set<string>;
    };
    flags?: {
        wip?: boolean;
        disabled?: boolean;
        ownerOnly?: boolean;
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

export interface IEvent {
    name: string;
    once?: boolean;
    execute(...args: any[]): Promise<void>;
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