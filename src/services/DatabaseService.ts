import { createClient, Client } from "@libsql/client";
import { mainLogger } from "../utils/Logger.js";
import { IConfiguration, UserEconomy, TodoItem } from "../types.js";
import { mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export class DatabaseService {
    private static instance: DatabaseService;
    private client: Client;
    private configCache: Map<string, IConfiguration>;

    private constructor() {
        const url = process.env.TURSO_DATABASE_URL || 'file:data/local.db';
        
        this.client = createClient({
            url: url
        });
        
        this.configCache = new Map();
        mainLogger.info(`Database initialized with URL: ${url.startsWith('file:') ? 'local SQLite' : 'Turso'}`);
    }

    static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    async initialize(): Promise<void> {
        // Create data directory if using local SQLite
        if (!process.env.TURSO_DATABASE_URL) {
            const dataDir = join(process.cwd(), 'data');
            if (!existsSync(dataDir)) {
                await mkdir(dataDir, { recursive: true });
                mainLogger.info('Created data directory for local SQLite database');
            }
        }

        // Initialize database tables
        await this.initializeTables();
        mainLogger.info('Database tables initialized successfully');
    }

    private async initializeTables(): Promise<void> {
        // Server configs table
        await this.client.execute(`
            CREATE TABLE IF NOT EXISTS server_configs (
                server_id TEXT PRIMARY KEY,
                config TEXT NOT NULL,
                created_at INTEGER DEFAULT (unixepoch()),
                updated_at INTEGER DEFAULT (unixepoch())
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

        // Todos table
        await this.client.execute(`
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL,
                completed BOOLEAN DEFAULT FALSE,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (server_id) REFERENCES server_configs(server_id) ON DELETE CASCADE
            )
        `);

        // Create indexes for better performance
        await this.client.execute(`
            CREATE INDEX IF NOT EXISTS idx_todos_server_id ON todos(server_id);
            CREATE INDEX IF NOT EXISTS idx_economy_balance ON economy(balance);
            CREATE INDEX IF NOT EXISTS idx_economy_bank ON economy(bank);
        `);
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

    async updateServerConfig(serverId: string | undefined, config: IConfiguration): Promise<void> {
        if (!serverId) {
            // Handle global config updates
            const globalConfig = await this.getServerConfig(undefined);
            const newConfig = {
                ...globalConfig,
                ...config,
                bot: { ...globalConfig.bot, ...config.bot },
                commands: { ...globalConfig.commands, ...config.commands },
                features: { ...globalConfig.features, ...config.features },
                security: { ...globalConfig.security, ...config.security }
            };
            
            // Store the global config in memory only
            this.configCache.set('global', newConfig);
            return;
        }

        mainLogger.debug(`Updating config for server: ${serverId}`);

        let newConfig: IConfiguration;
        if (!serverId) {
            newConfig = config as IConfiguration;
        } else {
            const currentConfig = await this.getServerConfig(serverId);
            newConfig = { ...currentConfig, ...config };
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
                    moderation: false,
                    economy: false
                }
            },
            security: {
                blockedUsers: [],
                allowedServers: []
            }
        };

        await this.updateServerConfig(serverId, defaultConfig);
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

    // Todo Methods
    async getTodos(serverId: string): Promise<TodoItem[]> {
        const result = await this.client.execute({
            sql: `
                SELECT * FROM todos 
                WHERE server_id = ?
                ORDER BY completed ASC, created_at DESC
            `,
            args: [serverId]
        });

        return result.rows.map(row => ({
            id: Number(row.id),
            server_id: row.server_id as string,
            user_id: row.user_id as string,
            content: row.content as string,
            completed: Boolean(row.completed),
            created_at: Number(row.created_at),
            updated_at: Number(row.updated_at)
        }));
    }

    async createTodo(serverId: string, userId: string, content: string): Promise<TodoItem> {
        const now = Date.now();
        const result = await this.client.execute({
            sql: `
                INSERT INTO todos (server_id, user_id, content, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                RETURNING *
            `,
            args: [serverId, userId, content, now, now]
        });

        const row = result.rows[0];
        return {
            id: Number(row.id),
            server_id: row.server_id as string,
            user_id: row.user_id as string,
            content: row.content as string,
            completed: Boolean(row.completed),
            created_at: Number(row.created_at),
            updated_at: Number(row.updated_at)
        };
    }

    async updateTodo(todoId: number, serverId: string, content: string): Promise<boolean> {
        const result = await this.client.execute({
            sql: `
                UPDATE todos 
                SET content = ?, updated_at = ?
                WHERE id = ? AND server_id = ?
            `,
            args: [content, Date.now(), todoId, serverId]
        });
        return result.rowsAffected > 0;
    }

    async toggleTodo(todoId: number, serverId: string): Promise<boolean> {
        const result = await this.client.execute({
            sql: `
                UPDATE todos 
                SET completed = NOT completed, updated_at = ?
                WHERE id = ? AND server_id = ?
            `,
            args: [Date.now(), todoId, serverId]
        });
        return result.rowsAffected > 0;
    }

    async removeTodo(todoId: number, serverId: string): Promise<boolean> {
        const result = await this.client.execute({
            sql: 'DELETE FROM todos WHERE id = ? AND server_id = ?',
            args: [todoId, serverId]
        });
        return result.rowsAffected > 0;
    }

    async removeAllTodos(serverId: string): Promise<number> {
        const result = await this.client.execute({
            sql: 'DELETE FROM todos WHERE server_id = ?',
            args: [serverId]
        });
        return result.rowsAffected;
    }
}