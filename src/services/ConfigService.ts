import dotenv from "dotenv";

export class ConfigService {
    private startupTime: number;

    constructor() {
        this.startupTime = Date.now();
        dotenv.config();
    }

    getToken(): string {
        return process.env.TOKEN!;
    }

    getPrefix(): string {
        return process.env.PREFIX!;
    }

    getStartupTime(): number {
        return this.startupTime;
    }

    isValid(): boolean {
        return Boolean(this.getToken());
    }
}