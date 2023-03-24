import { Client, Message } from "revolt.js";

declare interface Command {
    name: string,
    description: string,
    execute(message: Message, args?: string[], client: Client): Promise<any>,
    use?: string,
    cooldown?: number,
    args?: boolean,
}