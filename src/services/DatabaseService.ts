import { createClient, Client } from "@libsql/client";
import { mainLogger } from "../utils/Logger.js";
import { IConfiguration, UserEconomy } from "../types.js";

export class DatabaseService {
    private static instance: DatabaseService;
    private client: Client;
    private configCache: Map<string, IConfiguration>;

    private constructor() {
        const url = process.env.TURSO_DATABASE_URL;

        if (!url) {
            throw new Error("TURSO_DATABASE_URL not found in environment variables");
        }

        this.client = createClient({
            url: url
        });
        
        this.configCache = new Map();
        this.initializeTables();
    }

    private async initializeTables(): Promise<void> {
        // Server configs table
        await this.client.execute(`
            CREATE TABLE IF NOT EXISTS server_configs (
                server_id TEXT PRIMARY KEY,
                config TEXT NOT NULL
            )
        `);

        // Economy table
        await this.client.execute(`
            CREATE TABLE IF NOT EXISTS economy (
                user_id TEXT PRIMARY KEY,
                balance INTEGER DEFAULT 0,
                bank INTEGER DEFAULT 0,
                inventory TEXT DEFAULT '[]',
                last_daily INTEGER DEFAULT 0,
                last_work INTEGER DEFAULT 0,
                work_streak INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (unixepoch()),
                updated_at INTEGER DEFAULT (unixepoch())
            )
        `);
    }

    static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    async getServerConfig(serverId: string | undefined): Promise<IConfiguration> {
        mainLogger.debug(`Fetching config for server: ${serverId}`);
        if (!serverId) {
            mainLogger.info('No server ID provided, returning default config');
            return {
                commands: { dangerous: [], disabled: [] },
                features: { experiments: { economy: false, moderation: false } },
                bot: {
                    prefix: 's?',
                    owners: [],
                    defaultCooldown: 3000
                },
                security: {
                    blockedUsers: [],
                    allowedServers: []
                }
            };
        }

        if (this.configCache.has(serverId)) {
            mainLogger.debug(`Config found in cache for server: ${serverId}`);
            return this.configCache.get(serverId)!;
        }

        const result = await this.client.execute({
            sql: "SELECT config FROM server_configs WHERE server_id = ?",
            args: [serverId]
        });

        if (result.rows.length) {
            mainLogger.debug(`Config loaded from database for server: ${serverId}`);
            const config = JSON.parse(result.rows[0].config as string) as IConfiguration;
            this.configCache.set(serverId, config);
            return config;
        }

        mainLogger.info(`No config found for server: ${serverId}, creating default`);
        return this.createDefaultConfig(serverId);
    }

    async getUserEconomy(userId: string): Promise<UserEconomy> {
        const result = await this.client.execute({
            sql: "SELECT * FROM economy WHERE user_id = ?",
            args: [userId]
        });

        if (!result.rows.length) {
            const defaultEconomy: UserEconomy = {
                balance: 0,
                bank: 0,
                inventory: [],
                lastDaily: 0,
                lastWork: 0,
                workStreak: 0
            };
            
            await this.client.execute({
                sql: `
                    INSERT INTO economy (
                        user_id, balance, bank, inventory, 
                        last_daily, last_work, work_streak
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    userId,
                    defaultEconomy.balance,
                    defaultEconomy.bank,
                    JSON.stringify(defaultEconomy.inventory),
                    defaultEconomy.lastDaily,
                    defaultEconomy.lastWork,
                    defaultEconomy.workStreak
                ]
            });

            return defaultEconomy;
        }

        const row = result.rows[0];
        return {
            balance: Number(row.balance),
            bank: Number(row.bank),
            inventory: JSON.parse(row.inventory as string),
            lastDaily: Number(row.last_daily),
            lastWork: Number(row.last_work),
            workStreak: Number(row.work_streak)
        };
    }

    async updateUserEconomy(userId: string, economy: UserEconomy): Promise<void> {
        await this.client.execute({
            sql: `
                INSERT OR REPLACE INTO economy (
                    user_id, balance, bank, inventory, 
                    last_daily, last_work, work_streak, 
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
            `,
            args: [
                userId,
                economy.balance,
                economy.bank,
                JSON.stringify(economy.inventory),
                economy.lastDaily,
                economy.lastWork,
                economy.workStreak
            ]
        });
    }

    async updateServerConfig(serverId: string, config: Partial<IConfiguration>, isDefault = false): Promise<void> {
        mainLogger.debug(`Updating config for server: ${serverId}`);

        let newConfig: IConfiguration;
        if (!isDefault) {
            const currentConfig = await this.getServerConfig(serverId);
            newConfig = { ...currentConfig, ...config };
        } else {
            newConfig = config as IConfiguration;
        }

        const configString = JSON.stringify(newConfig);

        try {
            await this.client.execute({
                sql: "INSERT OR REPLACE INTO server_configs (server_id, config) VALUES (?, ?)",
                args: [serverId, configString]
            });
            this.configCache.set(serverId, newConfig);
            mainLogger.info(`Successfully updated config for server: ${serverId}`);
        } catch (error) {
            mainLogger.error(`Failed to update config for server: ${serverId}`, error);
            throw error;
        }
    }

    async createDefaultConfig(serverId: string): Promise<IConfiguration> {
        mainLogger.info(`Creating default config for server: ${serverId}`);
        const defaultConfig: IConfiguration = {
            bot: {
                prefix: 's?',
                owners: [],
                defaultCooldown: 3000
            },
            commands: {
                dangerous: [],
                disabled: []
            },
            features: {
                experiments: {
                    economy: false,
                    moderation: false
                }
            },
            security: {
                blockedUsers: [],
                allowedServers: []
            }
        };

        await this.updateServerConfig(serverId, defaultConfig, true);
        return defaultConfig;
    }

    // For leaderboard command
    async getLeaderboard(page: number, limit: number): Promise<Array<{
        user_id: string;
        balance: number;
        bank: number;
        total: number;
    }>> {
        const offset = (page - 1) * limit;
        const result = await this.client.execute({
            sql: `
                SELECT user_id, balance, bank,
                       (balance + bank) as total
                FROM economy
                ORDER BY total DESC
                LIMIT ? OFFSET ?
            `,
            args: [limit, offset]
        });

        return result.rows.map(row => ({
            user_id: row.user_id as string,
            balance: Number(row.balance),
            bank: Number(row.bank),
            total: Number(row.total)
        }));
    }
}