import { Client, Message } from "revolt.js";

declare interface ICommand {
    name: string;
    description: string;
    usage?: string;
    aliases?: string[];
    args?: boolean;
    cooldown?: number;
    execute(
        message: Message,
        args?: string[],
        client: Client,
    ): Promise<any>;
}

declare interface IConfiguration {}
