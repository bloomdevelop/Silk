import { Client, Message } from "revolt.js";

declare interface Command {
    name: string;
    description: string;
    execute(
        message: Message,
        args?: string[],
        client: Client
    ): Promise<any>;
    use?: string;
    cooldown?: number;
    args?: boolean;
}

declare interface StackoverflowPost {
    tags: string[];
    owner: {
        account_id: number;
        reputation: number;
        user_id: number;
        user_type:
            | "unregistered"
            | "registered"
            | "moderator"
            | "does_not_exist";
        profile_image: string;
        display_name: string;
        link: string;
    };
    is_answered: boolean;
    view_count: number;
    answer_count: number;
    score: number;
    last_activity_date: number;
    creation_date: number;
    last_edit_date: number;
    question_id: number;
    content_license: string;
    link: string;
    title: string;
}
