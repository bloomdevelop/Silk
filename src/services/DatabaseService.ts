import { createClient, Client, ResultSet, Value, Transaction } from "@libsql/client";
import { mainLogger } from "../utils/Logger.js";
import { IConfiguration, UserEconomy, TodoItem, InventoryItem } from "../types.js";
import { CircuitBreaker } from "../utils/CircuitBreaker.js";
import { mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import process from 'process';
import { ProcessManager } from "../utils/ProcessManager.js";

// Define row interfaces with index signatures
interface ConfigRow extends Record<string, Value> {
    config: Value;
}

interface EconomyRow extends Record<string, Value> {
    user_id: Value;
    balance: Value;
    bank: Value;
    inventory: Value;
    last_daily: Value;
    last_work: Value;
    work_streak: Value;
}

interface TodoRow extends Record<string, Value> {
    id: Value;
    server_id: Value;
    user_id: Value;
    content: Value;
    completed: Value;
    created_at: Value;
    updated_at: Value;
}

export class DatabaseService {
    private static instance: DatabaseService;
    private client!: Client;
    private configCache: Map<string, {
        data: IConfiguration;
        timestamp: number;
    }>;
    private economyCache: Map<string, {
        data: UserEconomy;
        timestamp: number;
    }>;
    private dbCircuit: CircuitBreaker;
    private cleanupInterval?: NodeJS.Timeout;
    private readonly CACHE_TTL = 300000; // 5 minutes

    private constructor() {
        this.configCache = new Map();
        this.economyCache = new Map();
        this.dbCircuit = new CircuitBreaker('Database');
        
        // Cleanup cache every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanupCache(), this.CACHE_TTL);
        
        // Add cleanup handler for process exit
        ProcessManager.getInstance().registerCleanupFunction(() => this.destroy());
    }

    static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    async initialize(): Promise<void> {
        try {
            // Create data directory if using local SQLite
            if (!process.env.TURSO_DATABASE_URL) {
                const dataDir = join(process.cwd(), 'data');
                if (!existsSync(dataDir)) {
                    await mkdir(dataDir, { recursive: true });
                    mainLogger.info('Created data directory for local SQLite database');
                }
            }

            // Initialize database connection
            const url = process.env.TURSO_DATABASE_URL || 'file:data/local.db';
            this.client = createClient({ url });
            mainLogger.info(`Database initialized with URL: ${url.startsWith('file:') ? 'local SQLite' : 'Turso'}`);

            // Initialize database tables
            await this.initializeTables();
            mainLogger.info('Database tables initialized successfully');
        } catch (error) {
            mainLogger.error('Failed to initialize database:', error);
            throw error;
        }
    }

    private async executeQuery<T extends Record<string, Value>>(
        sql: string, 
        args: any[] = []
    ): Promise<ResultSet & { rows: T[] }> {
        if (!this.client) {
            throw new Error('Database not initialized');
        }

        return this.dbCircuit.execute(async () => {
            const result = await this.client!.execute({ sql, args });
            return result as ResultSet & { rows: T[] };
        });
    }

    public async destroy(): Promise<void> {
        try {
            // Check if already destroyed
            if (!this.client) {
                mainLogger.debug('Database service already destroyed, skipping cleanup');
                return;
            }

            mainLogger.debug('Starting database service cleanup...');

            try {
                // Clear cleanup interval first
                if (this.cleanupInterval) {
                    clearInterval(this.cleanupInterval);
                    this.cleanupInterval = undefined;
                }

                // Run final cleanup before closing connection
                await this.cleanup();

                // Close database connection
                // @ts-ignore - LibSQL client doesn't expose close method in types
                if (typeof this.client.close === 'function') {
                    await this.client.close();
                }

                // Use type assertion to handle nulling the client
                (this.client as any) = null;

                mainLogger.info('Database service destroyed successfully');
            } catch (error) {
                mainLogger.error('Error during database service cleanup:', error);
                // Use type assertion here as well
                (this.client as any) = null;
                throw error;
            }
        } catch (error) {
            mainLogger.error('Error during database service cleanup:', error);
            throw error;
        }
    }

    private async initializeTables(): Promise<void> {
        // Server configs table
        await this.client!.execute(`
            CREATE TABLE IF NOT EXISTS server_configs (
                server_id TEXT PRIMARY KEY,
                config TEXT NOT NULL,
                created_at INTEGER DEFAULT (unixepoch()),
                updated_at INTEGER DEFAULT (unixepoch())
            )
        `);

        // Economy table
        await this.client!.execute(`
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
        await this.client!.execute(`
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
        await this.client!.execute(`
            CREATE INDEX IF NOT EXISTS idx_todos_server_id ON todos(server_id);
            CREATE INDEX IF NOT EXISTS idx_economy_balance ON economy(balance);
            CREATE INDEX IF NOT EXISTS idx_economy_bank ON economy(bank);
        `);
    }

    async getServerConfig(serverId: string | undefined): Promise<IConfiguration> {
        // Check cache first
        const cacheKey = serverId || 'global';
        const cached = this.configCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
            mainLogger.debug(`Using cached config for server: ${serverId || 'global'}`);
            return cached.data;
        }

        try {
            // For undefined serverId, return default config without saving
            if (!serverId) {
                const defaultConfig = this.getDefaultConfig();
                this.configCache.set('global', {
                    data: defaultConfig,
                    timestamp: Date.now()
                });
                return defaultConfig;
            }

            const result = await this.executeQuery<ConfigRow>(
                "SELECT config FROM server_configs WHERE server_id = ?",
                [serverId]
            );

            if (result.rows.length) {
                const configStr = result.rows[0].config?.toString();
                if (!configStr) throw new Error("Invalid config data");
                
                const config = JSON.parse(configStr) as IConfiguration;
                // Update cache
                this.configCache.set(serverId, {
                    data: config,
                    timestamp: Date.now()
                });
                return config;
            }

            // If no config exists, create default
            mainLogger.info(`No config found for server: ${serverId}, creating default`);
            const defaultConfig = await this.createDefaultConfig(serverId);
            return defaultConfig;
        } catch (error) {
            mainLogger.error(`Error getting server config: ${error}`);
            throw error;
        }
    }

    private getDefaultConfig(): IConfiguration {
        return {
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
    }

    async getUserEconomy(userId: string): Promise<UserEconomy> {
        const result = await this.executeQuery<EconomyRow>(
            "SELECT *, (balance + bank) as total FROM economy WHERE user_id = ?",
            [userId]
        );

        if (!result.rows.length) {
            return {
                user_id: userId,
                balance: 0,
                bank: 0,
                inventory: [],
                lastDaily: 0,
                lastWork: 0,
                workStreak: 0,
                total: 0
            };
        }

        const row = result.rows[0];
        const inventoryStr = row.inventory?.toString() || '[]';
        const inventory = JSON.parse(inventoryStr) as InventoryItem[];

        const economy: UserEconomy = {
            user_id: userId,
            balance: Number(row.balance),
            bank: Number(row.bank),
            inventory,
            lastDaily: Number(row.last_daily),
            lastWork: Number(row.last_work),
            workStreak: Number(row.work_streak),
            total: Number(row.balance) + Number(row.bank)
        };

        this.economyCache.set(userId, {
            data: economy,
            timestamp: Date.now()
        });

        return economy;
    }

    async updateUserEconomy(userId: string, economy: UserEconomy): Promise<void> {
        await this.executeQuery(
            `
                INSERT OR REPLACE INTO economy (
                    user_id, balance, bank, inventory, 
                    last_daily, last_work, work_streak, 
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
            `,
            [
                userId,
                economy.balance,
                economy.bank,
                JSON.stringify(economy.inventory),
                economy.lastDaily,
                economy.lastWork,
                economy.workStreak
            ]
        );
    }

    async updateServerConfig(serverId: string | undefined, config: IConfiguration): Promise<void> {
        const cacheKey = serverId || 'global';
        
        try {
            await this.executeQuery(
                "INSERT OR REPLACE INTO server_configs (server_id, config) VALUES (?, ?)",
                [serverId, JSON.stringify(config)]
            );

            // Update cache
            this.configCache.set(cacheKey, {
                data: config,
                timestamp: Date.now()
            });

            mainLogger.debug(`Updated config for server: ${serverId}`);
        } catch (error) {
            mainLogger.error(`Error updating server config: ${error}`);
            throw error;
        }
    }

    async createDefaultConfig(serverId: string): Promise<IConfiguration> {
        const defaultConfig = this.getDefaultConfig();

        try {
            await this.executeQuery(
                "INSERT INTO server_configs (server_id, config) VALUES (?, ?)",
                [serverId, JSON.stringify(defaultConfig)]
            );

            // Update cache
            this.configCache.set(serverId, {
                data: defaultConfig,
                timestamp: Date.now()
            });

            mainLogger.info(`Created default config for server: ${serverId}`);
            return defaultConfig;
        } catch (error) {
            mainLogger.error(`Error creating default config: ${error}`);
            throw error;
        }
    }

    // For leaderboard command
    async getLeaderboard(page: number, limit: number): Promise<UserEconomy[]> {
        const result = await this.executeQuery<EconomyRow>(
            `SELECT *, (balance + bank) as total 
             FROM economy 
             ORDER BY (balance + bank) DESC 
             LIMIT ? OFFSET ?`,
            [limit, (page - 1) * limit]
        );

        return result.rows.map(row => ({
            user_id: row.user_id?.toString() || '',
            balance: Number(row.balance),
            bank: Number(row.bank),
            inventory: JSON.parse(row.inventory?.toString() || '[]'),
            lastDaily: Number(row.last_daily),
            lastWork: Number(row.last_work),
            workStreak: Number(row.work_streak),
            total: Number(row.balance) + Number(row.bank)
        }));
    }

    // Todo Methods
    async getTodos(serverId: string): Promise<TodoItem[]> {
        const result = await this.executeQuery<TodoRow>(
            `SELECT * FROM todos WHERE server_id = ? ORDER BY completed ASC, created_at DESC`,
            [serverId]
        );

        return result.rows.map(row => ({
            id: Number(row.id),
            server_id: row.server_id?.toString() || '',
            user_id: row.user_id?.toString() || '',
            content: row.content?.toString() || '',
            completed: Boolean(row.completed),
            created_at: Number(row.created_at),
            updated_at: Number(row.updated_at)
        }));
    }

    async createTodo(serverId: string, userId: string, content: string): Promise<TodoItem> {
        const now = Date.now();
        const result = await this.executeQuery(
            `
                INSERT INTO todos (server_id, user_id, content, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                RETURNING *
            `,
            [serverId, userId, content, now, now]
        );

        const row = result.rows[0];
        return {
            id: Number(row.id),
            server_id: row.server_id?.toString() || '',
            user_id: row.user_id?.toString() || '',
            content: row.content?.toString() || '',
            completed: Boolean(row.completed),
            created_at: Number(row.created_at),
            updated_at: Number(row.updated_at)
        };
    }

    async updateTodo(todoId: number, serverId: string, content: string): Promise<boolean> {
        return this.executeModification(
            `UPDATE todos SET content = ?, updated_at = ? WHERE id = ? AND server_id = ?`,
            [content, Date.now(), todoId, serverId]
        );
    }

    async toggleTodo(todoId: number, serverId: string): Promise<boolean> {
        return this.executeModification(
            `UPDATE todos SET completed = NOT completed, updated_at = ? WHERE id = ? AND server_id = ?`,
            [Date.now(), todoId, serverId]
        );
    }

    async removeTodo(todoId: number, serverId: string): Promise<boolean> {
        return this.executeModification(
            'DELETE FROM todos WHERE id = ? AND server_id = ?',
            [todoId, serverId]
        );
    }

    async removeAllTodos(serverId: string): Promise<number> {
        const result = await this.executeQuery<Record<string, Value>>(
            'DELETE FROM todos WHERE server_id = ?',
            [serverId]
        );
        return result.rowsAffected;
    }

    // Add batch operations for performance
    async batchUpdateEconomy(updates: Array<{ userId: string, economy: UserEconomy }>): Promise<void> {
        const values = updates.map(update => [
            update.userId,
            update.economy.balance,
            update.economy.bank,
            JSON.stringify(update.economy.inventory),
            update.economy.lastDaily,
            update.economy.lastWork,
            update.economy.workStreak,
            Date.now()
        ]).flat();

        const placeholders = updates.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");

        await this.executeQuery(
            `
                INSERT OR REPLACE INTO economy (
                    user_id, balance, bank, inventory, 
                    last_daily, last_work, work_streak, 
                    updated_at
                ) VALUES ${placeholders}
            `,
            values
        );

        // Update cache
        updates.forEach(update => {
            this.economyCache.set(update.userId, {
                data: update.economy,
                timestamp: Date.now()
            });
        });
    }

    // Add cleanup methods
    async cleanup(): Promise<void> {
        try {
            mainLogger.debug('Starting database cleanup...');
            
            // Clean up old records
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            
            // Delete old server configs that haven't been updated
            const deletedConfigs = await this.executeQuery(
                "DELETE FROM server_configs WHERE updated_at < ?",
                [thirtyDaysAgo]
            );
            
            // Delete old economy records with zero balance and no activity
            const deletedEconomy = await this.executeQuery(
                `DELETE FROM economy 
                 WHERE balance = 0 
                 AND bank = 0 
                 AND last_daily < ? 
                 AND last_work < ?`,
                [thirtyDaysAgo, thirtyDaysAgo]
            );
            
            // Delete completed todos older than 30 days
            const deletedTodos = await this.executeQuery(
                "DELETE FROM todos WHERE completed = TRUE AND updated_at < ?",
                [thirtyDaysAgo]
            );

            mainLogger.info('Database cleanup completed:', {
                configs: deletedConfigs.rowsAffected,
                economy: deletedEconomy.rowsAffected,
                todos: deletedTodos.rowsAffected
            });

        } catch (error) {
            mainLogger.error('Error during database cleanup:', error);
            throw error;
        }
    }

    private cleanupCache(): void {
        const now = Date.now();
        let cleanedEntries = 0;
        
        // Cleanup config cache
        for (const [key, value] of this.configCache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.configCache.delete(key);
                cleanedEntries++;
            }
        }

        // Cleanup economy cache
        for (const [key, value] of this.economyCache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.economyCache.delete(key);
                cleanedEntries++;
            }
        }

        if (cleanedEntries > 0) {
            mainLogger.debug(`Cleaned up ${cleanedEntries} cache entries`);
        }
    }

    // For methods returning rowsAffected
    private async executeModification(sql: string, args: any[] = []): Promise<boolean> {
        const result = await this.executeQuery<Record<string, Value>>(sql, args);
        return result.rowsAffected > 0;
    }

    async beginTransaction(): Promise<Transaction> {
        return await this.client.transaction();
    }

    async commitTransaction(transaction: Transaction): Promise<void> {
        await transaction.commit();
    }

    async rollbackTransaction(transaction: Transaction): Promise<void> {
        await transaction.rollback();
    }
}