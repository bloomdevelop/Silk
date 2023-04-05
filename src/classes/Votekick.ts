import type { Member, Channel, Message } from "revolt.js";

class VotekickItem {
    readonly messageID: string;
    readonly issuedBy: string;
    readonly member: Member;
    readonly reason: string | undefined;
    private readonly channel: Channel;
    private readonly maxVotes: number;

    constructor(
        member: Member,
        channel: Channel,
        options: {
            id: string;
            issuedBy: string;
            reason?: string;
            limit?: number;
        }
    ) {
        this.member = member;
        this.issuedBy = options.issuedBy;
        this.messageID = options.id;
        this.channel = channel;
        this.reason = options.reason;
        this.channel = channel;
        this.maxVotes = options.limit || 3;
        console.log(
            "Created new Votekick Event!",
            this.member.user?.username,
            "is being kicked for",
            this.reason
        );
    }

    public async passVote(): Promise<Message> {
        if (this.member.kickable) {
            try {
                await this.member.kick();
                return this.channel.sendMessage(
                    `Kicked ${this.member.user?.username} because ${this.reason}.\nVotekick issued by: \`${this.issuedBy}\``
                );
            } catch (error) {
                return await this.channel.sendMessage(
                    `Couldn't kick ${this.member.user?.username}`
                );
            }
        } else {
            return await this.channel.sendMessage(
                `Couldn't kick ${this.member.user?.username}`
            );
        }
    }

    public get id() {
        return this.messageID;
    }

    public get limit() {
        return this.maxVotes;
    }
}

export { VotekickItem };
