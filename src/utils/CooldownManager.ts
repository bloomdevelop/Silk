export class CooldownManager {
    private cooldowns: Map<string, Map<string, number>>;
    
    constructor() {
        this.cooldowns = new Map();
    }

    isOnCooldown(userId: string, commandName: string, cooldownTime: number): boolean {
        const now = Date.now();
        const userCooldowns = this.cooldowns.get(userId) || new Map();
        const lastUsed = userCooldowns.get(commandName) || 0;
        
        return (now - lastUsed) < cooldownTime;
    }

    setCooldown(userId: string, commandName: string): void {
        const userCooldowns = this.cooldowns.get(userId) || new Map();
        userCooldowns.set(commandName, Date.now());
        this.cooldowns.set(userId, userCooldowns);
    }
} 