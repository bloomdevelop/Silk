import { Client, Message } from "revolt.js";

declare interface ICommand {
    name: string;
    description: string;
    usage?: string;
    aliases?: string[];
    args?: boolean;
    cooldown?: number;
    wip?: boolean;
    execute(
        message: Message,
        args?: string[],
        client: Client,
    ): Promise<any>;
}

declare interface IConfiguration {
    disabled_commands: string[],
    prefix: string | "s?";
    dangerous_command: boolean,
    experiments: {
        experimental_moderation: boolean
    },
    blocked_users: string[] // Useful when users abuses the votekick.
}
