import Database from 'better-sqlite3'
import { IConfiguration, UserEconomy } from "../types.js"
import path from "node:path"
import { mainLogger } from "../utils/Logger.js"
import fs from "node:fs/promises"

interface DbResult {
    config: string;
}

interface EconomyRow {
    user_id: string;
    balance: number;
    bank: number;
    inventory: string;
    last_daily: number;
    last_work: number;
    work_streak: number;
    created_at: number;
    updated_at: number;
}

export class DatabaseService {
    private static instance: DatabaseService
    private configCache: Map<string, IConfiguration>
    private db: Database.Database
    private readonly dbPath: string
    private readonly logger = mainLogger.getSubLogger({ name: 'DatabaseService' })

    private constructor() {
        this.logger.info('Initializing DatabaseService...')
        this.configCache = new Map()
        this.dbPath = path.join(process.cwd(), 'data', 'configs.db')
        this.ensureDatabase()
        this.db = new Database(this.dbPath)
        this.initDatabase()
        this.logger.info('DatabaseService initialized successfully')
    }

    private async ensureDatabase(): Promise<void> {
        const dataDir = path.dirname(this.dbPath)
        this.logger.info(`Ensuring database directory exists: ${dataDir}`)
        await fs.mkdir(dataDir, { recursive: true })

        try {
            await fs.access(this.dbPath)
            this.logger.info('Database file exists, proceeding with connection')
        } catch {
            this.logger.info('Database file not found, creating new database')
            await fs.writeFile(this.dbPath, '')
            this.logger.info('New database file created successfully')
        }
    }

    private initDatabase(): void {
        this.logger.info('Initializing database schema')
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS server_configs (
                server_id TEXT PRIMARY KEY,
                config TEXT NOT NULL
            )
        `)
        this.db.exec(`
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
        `)
        this.logger.info('Database schema initialized')
    }

    static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService()
        }
        return DatabaseService.instance
    }

    async getServerConfig(serverId: string | undefined): Promise<IConfiguration> {
        this.logger.debug(`Fetching config for server: ${serverId}`)
        if (!serverId) {
            this.logger.info('No server ID provided, returning default config')
            return {
                commands: { dangerous: [], disabled: [] },
                features: { experiments: { economy: false, moderation: false } },
                security: { allowedServers: [], blockedUsers: [] },
                bot: {
                    prefix: '!',
                    owners: [''],
                    defaultCooldown: 5,
                }
            }
        }
        if (this.configCache.has(serverId!)) {
            this.logger.debug(`Config found in cache for server: ${serverId}`)
            return this.configCache.get(serverId)!
        }

        const stmt = this.db.prepare('SELECT config FROM server_configs WHERE server_id = ?')
        const result = stmt.get(serverId) as DbResult | undefined

        if (result) {
            this.logger.debug(`Config loaded from database for server: ${serverId}`)
            const config = JSON.parse(result.config) as IConfiguration
            this.configCache.set(serverId, config)
            return config
        }

        this.logger.info(`No config found for server: ${serverId}, creating default`)
        return this.createDefaultConfig(serverId)
    }

    async updateServerConfig(serverId: string, config: Partial<IConfiguration>, isDefault = false): Promise<void> {
        this.logger.debug(`Updating config for server: ${serverId}`)

        let newConfig: IConfiguration
        if (!isDefault) {
            const currentConfig = await this.getServerConfig(serverId)
            newConfig = { ...currentConfig, ...config }
        } else {
            newConfig = config as IConfiguration
        }

        const configString = JSON.stringify(newConfig)

        try {
            const stmt = this.db.prepare('INSERT OR REPLACE INTO server_configs (server_id, config) VALUES (?, ?)')
            stmt.run(serverId, configString)
            this.configCache.set(serverId, newConfig)
            this.logger.info(`Successfully updated config for server: ${serverId}`)
        } catch (error) {
            this.logger.error(`Failed to update config for server: ${serverId}`, error)
            throw error
        }
    }

    async createDefaultConfig(serverId: string): Promise<IConfiguration> {
        this.logger.info(`Creating default config for server: ${serverId}`)
        const defaultConfig: IConfiguration = {
            bot: {
                prefix: 's?',
                owners: [],
                defaultCooldown: 3000
            },
            commands: {
                disabled: [],
                dangerous: []
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
        }

        await this.updateServerConfig(serverId, defaultConfig, true)
        return defaultConfig
    }

    async getUserEconomy(userId: string): Promise<UserEconomy> {
        const stmt = this.db.prepare('SELECT * FROM economy WHERE user_id = ?');
        const result = stmt.get(userId) as EconomyRow | undefined;

        if (!result) {
            const defaultEconomy: UserEconomy = {
                balance: 0,
                bank: 0,
                inventory: [],
                lastDaily: 0,
                lastWork: 0,
                workStreak: 0
            };
            
            const insertStmt = this.db.prepare(`
                INSERT INTO economy (user_id, balance, bank, inventory, last_daily, last_work, work_streak)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            insertStmt.run(
                userId,
                defaultEconomy.balance,
                defaultEconomy.bank,
                JSON.stringify(defaultEconomy.inventory),
                defaultEconomy.lastDaily,
                defaultEconomy.lastWork,
                defaultEconomy.workStreak
            );

            return defaultEconomy;
        }

        return {
            balance: result.balance,
            bank: result.bank,
            inventory: JSON.parse(result.inventory),
            lastDaily: result.last_daily,
            lastWork: result.last_work,
            workStreak: result.work_streak
        };
    }

    async updateUserEconomy(userId: string, economy: UserEconomy): Promise<void> {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO economy (
                user_id, balance, bank, inventory, last_daily, last_work, work_streak, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
        `);

        stmt.run(
            userId,
            economy.balance,
            economy.bank,
            JSON.stringify(economy.inventory),
            economy.lastDaily,
            economy.lastWork,
            economy.workStreak
        );
    }

    prepare<T extends {} | unknown[]>(sql: string): Database.Statement<T> {
        return this.db.prepare(sql) as Database.Statement<T>;
    }
}