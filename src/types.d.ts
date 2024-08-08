import { Client, Message } from "revolt.js";

declare interface Command {
    name: string;
    description: string;
    usage?: string;
    alias?: string[];
    args?: boolean;
    cooldown?: number;
    execute(
        message: Message,
        args?: string[],
        client: Client
    ): Promise<any>;
}