import { createClient, Client, Transaction } from "@libsql/client";
import { Logger, mainLogger } from "../utils/Logger.js";
import { AutoModConfig, IConfiguration, UserEconomy, AutoModViolation } from "../types.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export class DatabaseService {
    private static instance: DatabaseService;
    private client!: Client;
    private isInitialized: boolean = false;
    private configCache: Map<string, {
        data: IConfiguration;
        timestamp: number;
    }>;
    private cleanupInterval?: NodeJS.Timeout;
    private logger: Logger;

    private constructor() {
        this.configCache = new Map();
        this.logger = Logger.getInstance("Database");
    }

    static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            mainLogger.warn('Database service already initialized');
            return;
        }

        const dbUrl = process.env.TURSO_DATABASE_URL;
        const authToken = process.env.TURSO_AUTH_TOKEN;

        try {
            if (!dbUrl) {
                // Use local SQLite database if Turso URL is not provided
                const __dirname = dirname(fileURLToPath(import.meta.url));
                const dbPath = join(__dirname, '..', '..', 'data', 'silk.db');

                // Create data directory if it doesn't exist
                const dataDir = join(__dirname, '..', '..', 'data');
                try {
                    await import('fs/promises').then(fs =>
                        fs.mkdir(dataDir, { recursive: true })
                    );
                    mainLogger.info(`Created data directory at: ${dataDir}`);
                } catch (mkdirError) {
                    mainLogger.error('Failed to create data directory:', mkdirError);
                    throw mkdirError;
                }

                mainLogger.info(`Using local SQLite database at: ${dbPath}`);
                this.client = createClient({
                    url: `file:${dbPath}`
                });
            } else {
                // Use Turso database if URL is provided
                mainLogger.info('Using Turso database');
                this.client = createClient({
                    url: dbUrl,
                    authToken
                });
            }

            // Test the connection
            await this.client.execute('SELECT 1');
            mainLogger.info('Database connection established');

            // Setup tables
            await this.setupTables();
            this.setupCleanupInterval();
            await this.initializeAutoModTables();
            this.isInitialized = true;
            mainLogger.info('Database service initialized successfully');

        } catch (error) {
            this.isInitialized = false;
            mainLogger.error('Failed to initialize database service:', error);
            throw error;
        }
    }

    private async setupTables(): Promise<void> {
        try {
            mainLogger.debug('Setting up database tables...');

            // Create configurations table
            await this.client.execute(`
                CREATE TABLE IF NOT EXISTS configurations (
                    server_id TEXT PRIMARY KEY,
                    prefix TEXT NOT NULL DEFAULT 's?',
                    welcome_channel TEXT,
                    log_channel TEXT,
                    bot_name TEXT DEFAULT 'Silk',
                    bot_status TEXT DEFAULT 'online',
                    bot_cooldown INTEGER DEFAULT 3000,
                    bot_owners TEXT,
                    commands_enabled INTEGER DEFAULT 1,
                    disabled_commands TEXT,
                    dangerous_commands TEXT,
                    feature_welcome INTEGER DEFAULT 0,
                    feature_logging INTEGER DEFAULT 0,
                    feature_automod INTEGER DEFAULT 1,
                    feature_exp_moderation INTEGER DEFAULT 0,
                    feature_exp_economy INTEGER DEFAULT 0,
                    security_antispam INTEGER DEFAULT 1,
                    security_max_mentions INTEGER DEFAULT 5,
                    security_max_lines INTEGER DEFAULT 10,
                    security_blocked_users TEXT,
                    security_allowed_servers TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create server_configs table for AutoMod
            await this.client.execute(`
                CREATE TABLE IF NOT EXISTS server_configs (
                    server_id TEXT PRIMARY KEY,
                    config TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Migrate existing configurations to server_configs if needed
            await this.migrateConfigurations();

            mainLogger.debug('Database tables setup completed');
        } catch (error) {
            mainLogger.error('Error setting up database tables:', error);
            throw error;
        }
    }

    private async migrateConfigurations(): Promise<void> {
        try {
            // Get all servers from configurations table that don't have a corresponding server_config
            const result = await this.client.execute(`
                SELECT c.server_id 
                FROM configurations c
                LEFT JOIN server_configs sc ON c.server_id = sc.server_id
                WHERE sc.server_id IS NULL
            `);

            for (const row of result.rows) {
                const serverId = row.server_id as string;
                
                // Create default AutoMod config
                const defaultConfig = {
                    automod: this.getDefaultAutoModConfig(),
                    version: 1  // Add version for future migrations
                };

                // Insert into server_configs
                await this.client.execute({
                    sql: `
                        INSERT INTO server_configs (server_id, config)
                        VALUES (?, ?)
                    `,
                    args: [serverId, JSON.stringify(defaultConfig)]
                });

                mainLogger.info(`Migrated configuration for server: ${serverId}`);
            }

            if (result.rows.length > 0) {
                mainLogger.info(`Successfully migrated ${result.rows.length} server configurations`);
            }
        } catch (error) {
            mainLogger.error('Error during configuration migration:', error);
            // Don't throw error to allow setup to continue
        }
    }

    private checkInitialized(): void {
        if (!this.isInitialized) {
            throw new Error('Database service not initialized');
        }
    }

    public async beginTransaction(): Promise<Transaction> {
        this.checkInitialized();
        return await this.client.transaction();
    }

    public async commitTransaction(transaction: Transaction): Promise<void> {
        this.checkInitialized();
        await transaction.commit();
    }

    public async rollbackTransaction(transaction: Transaction): Promise<void> {
        this.checkInitialized();
        await transaction.rollback();
    }

    // ... other database methods ...

    private async flushCache(): Promise<void> {
        try {
            this.logger.debug('Flushing database cache...');
            const promises: Promise<void>[] = [];

            // Save all cached configurations
            for (const [serverId, cache] of this.configCache) {
                try {
                    promises.push(this.updateServerConfig(serverId, cache.data));
                } catch (error) {
                    this.logger.error(`Error flushing config for server ${serverId}:`, error);
                }
            }

            // Wait for all updates to complete
            await Promise.allSettled(promises);
            this.logger.info(`Successfully flushed ${promises.length} cached configurations`);

        } catch (error) {
            this.logger.error('Error during cache flush:', error);
            throw error;
        }
    }

    public async destroy(): Promise<void> {
        try {
            this.checkInitialized();

            // First, stop the cleanup interval
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = undefined;
            }

            // Flush all cached data to database
            await this.flushCache();

            // Clear the cache after successful flush
            this.configCache.clear();

            // Close database connection
            // @ts-ignore - LibSQL client doesn't expose close method in types
            if (typeof this.client.close === 'function') {
                await this.client.close();
            }

            this.isInitialized = false;
            this.logger.info('Database service destroyed successfully');

        } catch (error) {
            this.logger.error('Error during database service cleanup:', error);
            throw error;
        }
    }

    private setupCleanupInterval(): void {
        const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), CLEANUP_INTERVAL);
    }

    private async cleanup(): Promise<void> {
        try {
            this.checkInitialized();
            const now = Date.now();
            const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

            // Cleanup config cache
            for (const [serverId, cache] of this.configCache.entries()) {
                if (now - cache.timestamp > CACHE_TTL) {
                    this.configCache.delete(serverId);
                }
            }

            mainLogger.debug('Database cleanup completed');
        } catch (error) {
            mainLogger.error('Error during database cleanup:', error);
        }
    }

    async getUserEconomy(userId: string): Promise<UserEconomy> {
        this.checkInitialized();
        try {
            const result = await this.client.execute({
                sql: "SELECT * FROM economy WHERE user_id = ?",
                args: [userId]
            });

            if (!result.rows[0]) {
                // Create default economy for new user
                const defaultEconomy: UserEconomy = {
                    user_id: userId,
                    balance: 0,
                    bank: 0,
                    lastDaily: null,
                    lastWork: null,
                    workStreak: 0,
                    inventory: [],
                    total: 0
                };

                await this.client.execute({
                    sql: `INSERT INTO economy (
                        user_id, balance, bank, work_streak, 
                        last_daily, last_work
                    ) VALUES (?, ?, ?, ?, ?, ?)`,
                    args: [
                        userId,
                        defaultEconomy.balance,
                        defaultEconomy.bank,
                        defaultEconomy.workStreak,
                        null,
                        null
                    ]
                });

                return defaultEconomy;
            }

            const row = result.rows[0];
            return {
                user_id: row.user_id as string,
                balance: Number(row.balance),
                bank: Number(row.bank),
                lastDaily: row.last_daily ? new Date(String(row.last_daily)) : null,
                lastWork: row.last_work ? new Date(String(row.last_work)) : null,
                workStreak: Number(row.work_streak || 0),
                inventory: (row.inventory as string || "").split(",").filter(Boolean),
                total: Number(row.balance) + Number(row.bank)
            };
        } catch (error) {
            mainLogger.error(`Error getting user economy for ${userId}:`, error);
            throw error;
        }
    }

    async updateUserEconomy(userId: string, economy: UserEconomy): Promise<void> {
        this.checkInitialized();
        try {
            await this.client.execute({
                sql: `UPDATE economy 
                      SET balance = ?, bank = ?, work_streak = ?,
                          last_daily = ?, last_work = ?, 
                          updated_at = CURRENT_TIMESTAMP 
                      WHERE user_id = ?`,
                args: [
                    economy.balance,
                    economy.bank,
                    economy.workStreak,
                    economy.lastDaily ? economy.lastDaily.toISOString() : null,
                    economy.lastWork ? economy.lastWork.toISOString() : null,
                    userId
                ]
            });
        } catch (error) {
            mainLogger.error(`Error updating user economy for ${userId}:`, error);
            throw error;
        }
    }

    async getLeaderboard(page: number = 1, perPage: number = 10): Promise<UserEconomy[]> {
        this.checkInitialized();
        try {
            const offset = (page - 1) * perPage;
            const result = await this.client.execute({
                sql: `SELECT * FROM economy 
                      ORDER BY (balance + bank) DESC 
                      LIMIT ? OFFSET ?`,
                args: [perPage, offset]
            });

            return result.rows.map(row => ({
                user_id: row.user_id as string,
                balance: Number(row.balance),
                bank: Number(row.bank),
                lastDaily: row.last_daily ? new Date(String(row.last_daily)) : null,
                lastWork: row.last_work ? new Date(String(row.last_work)) : null,
                workStreak: Number(row.work_streak || 0),
                inventory: (row.inventory as string || "").split(",").filter(Boolean),
                total: Number(row.balance) + Number(row.bank)
            }));
        } catch (error) {
            mainLogger.error("Error getting leaderboard:", error);
            throw error;
        }
    }

    async getServerConfig(serverId: string): Promise<IConfiguration> {
        this.checkInitialized();
        try {
            // Check cache first
            const cached = this.configCache.get(serverId);
            if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
                return cached.data;
            }

            // First check server_configs table
            const serverConfigResult = await this.client.execute({
                sql: "SELECT config FROM server_configs WHERE server_id = ?",
                args: [serverId]
            });

            if (serverConfigResult.rows[0]) {
                // Server has a config in server_configs
                const config = JSON.parse(serverConfigResult.rows[0].config as string);
                
                // Ensure all required properties exist
                const validatedConfig: IConfiguration = {
                    prefix: config.prefix || "s?",
                    welcomeChannel: config.welcomeChannel || null,
                    logChannel: config.logChannel || null,
                    bot: {
                        name: config.bot?.name || "Silk",
                        status: config.bot?.status || "online",
                        prefix: config.bot?.prefix || "s?",
                        defaultCooldown: config.bot?.defaultCooldown || 3000,
                        owners: config.bot?.owners || []
                    },
                    commands: {
                        enabled: config.commands?.enabled ?? true,
                        disabled: config.commands?.disabled || [],
                        dangerous: config.commands?.dangerous || []
                    },
                    features: {
                        welcome: config.features?.welcome ?? false,
                        logging: config.features?.logging ?? false,
                        automod: config.features?.automod ?? true,
                        experiments: {
                            moderation: config.features?.experiments?.moderation ?? false,
                            economy: config.features?.experiments?.economy ?? false
                        }
                    },
                    security: {
                        antiSpam: config.security?.antiSpam ?? true,
                        maxMentions: config.security?.maxMentions || 5,
                        maxLines: config.security?.maxLines || 10,
                        blockedUsers: config.security?.blockedUsers || [],
                        allowedServers: config.security?.allowedServers || []
                    },
                    automod: {
                        enabled: config.automod?.enabled ?? false,
                        filters: {
                            spam: config.automod?.filters?.spam ?? true,
                            invites: config.automod?.filters?.invites ?? true,
                            links: config.automod?.filters?.links ?? true,
                            mentions: config.automod?.filters?.mentions ?? true,
                            caps: config.automod?.filters?.caps ?? true
                        },
                        thresholds: {
                            maxMentions: config.automod?.thresholds?.maxMentions || 5,
                            maxCaps: config.automod?.thresholds?.maxCaps || 70,
                            messageBurst: config.automod?.thresholds?.messageBurst || 5
                        },
                        whitelist: {
                            users: config.automod?.whitelist?.users || [],
                            roles: config.automod?.whitelist?.roles || [],
                            channels: config.automod?.whitelist?.channels || [],
                            links: config.automod?.whitelist?.links || []
                        },
                        actions: {
                            delete: config.automod?.actions?.delete ?? true,
                            warn: config.automod?.actions?.warn ?? true,
                            timeout: config.automod?.actions?.timeout || 5
                        }
                    }
                };

                // Cache the validated config
                this.configCache.set(serverId, {
                    data: validatedConfig,
                    timestamp: Date.now()
                });

                return validatedConfig;
            }

            // If no configuration exists, create a new one
            return await this.createDefaultConfig(serverId);
        } catch (error) {
            mainLogger.error(`Error getting server config for ${serverId}:`, error);
            throw error;
        }
    }

    async createDefaultConfig(serverId: string): Promise<IConfiguration> {
        this.checkInitialized();
        const defaultConfig: IConfiguration = {
            prefix: "s?",
            welcomeChannel: null,
            logChannel: null,
            bot: {
                name: "Silk",
                status: "online",
                prefix: "s?",
                defaultCooldown: 3000,
                owners: []
            },
            commands: {
                enabled: true,
                disabled: [],
                dangerous: []
            },
            features: {
                welcome: false,
                logging: false,
                automod: true,
                experiments: {
                    moderation: false,
                    economy: false
                }
            },
            security: {
                antiSpam: true,
                maxMentions: 5,
                maxLines: 10,
                blockedUsers: [],
                allowedServers: []
            },
            automod: {
                enabled: false,
                filters: {
                    spam: true,
                    invites: true,
                    links: true,
                    mentions: true,
                    caps: true
                },
                thresholds: {
                    maxMentions: 5,
                    maxCaps: 70,
                    messageBurst: 5
                },
                whitelist: {
                    users: [],
                    roles: [],
                    channels: [],
                    links: []
                },
                actions: {
                    delete: true,
                    warn: true,
                    timeout: 5
                }
            }
        };

        try {
            await this.client.execute({
                sql: `INSERT INTO configurations (
                    server_id, prefix, bot_name, bot_status, bot_cooldown, bot_owners,
                    commands_enabled, disabled_commands, dangerous_commands,
                    feature_welcome, feature_logging, feature_automod,
                    feature_exp_moderation, feature_exp_economy,
                    security_antispam, security_max_mentions, security_max_lines,
                    security_blocked_users, security_allowed_servers
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    serverId,
                    defaultConfig.prefix,
                    defaultConfig.bot.name,
                    defaultConfig.bot.status,
                    defaultConfig.bot.defaultCooldown,
                    defaultConfig.bot.owners.join(","),
                    defaultConfig.commands.enabled ? 1 : 0,
                    defaultConfig.commands.disabled.join(","),
                    defaultConfig.commands.dangerous.join(","),
                    defaultConfig.features.welcome ? 1 : 0,
                    defaultConfig.features.logging ? 1 : 0,
                    defaultConfig.features.automod ? 1 : 0,
                    defaultConfig.features.experiments.moderation ? 1 : 0,
                    defaultConfig.features.experiments.economy ? 1 : 0,
                    defaultConfig.security.antiSpam ? 1 : 0,
                    defaultConfig.security.maxMentions,
                    defaultConfig.security.maxLines,
                    defaultConfig.security.blockedUsers.join(","),
                    defaultConfig.security.allowedServers.join(",")
                ]
            });

            this.configCache.set(serverId, {
                data: defaultConfig,
                timestamp: Date.now()
            });

            return defaultConfig;
        } catch (error) {
            mainLogger.error(`Error creating default config for ${serverId}:`, error);
            throw error;
        }
    }

    async updateServerConfig(serverId: string, config: IConfiguration): Promise<void> {
        this.checkInitialized();
        try {
            // Update server_configs table
            await this.client.execute({
                sql: `INSERT INTO server_configs (server_id, config) 
                      VALUES (?, ?) 
                      ON CONFLICT(server_id) DO UPDATE SET 
                      config = excluded.config,
                      updated_at = CURRENT_TIMESTAMP`,
                args: [serverId, JSON.stringify(config)]
            });

            // Update cache
            this.configCache.set(serverId, {
                data: config,
                timestamp: Date.now()
            });

            mainLogger.debug(`Updated configuration for server ${serverId}`);
        } catch (error) {
            mainLogger.error(`Error updating server config for ${serverId}:`, error);
            throw error;
        }
    }

    async getAutoModConfig(serverId?: string): Promise<AutoModConfig> {
        try {
            if (!serverId) {
                return this.getDefaultAutoModConfig();
            }

            // First, ensure server has a config
            await this.ensureServerConfig(serverId);

            const result = await this.client.execute({
                sql: 'SELECT config FROM server_configs WHERE server_id = ?',
                args: [serverId]
            });

            if (!result.rows[0]) {
                return this.getDefaultAutoModConfig();
            }

            const serverConfig = JSON.parse(result.rows[0].config as string);
            return {
                ...this.getDefaultAutoModConfig(),
                ...serverConfig.automod
            };
        } catch (error) {
            this.logger.error('Error getting automod config:', error);
            return this.getDefaultAutoModConfig();
        }
    }

    private getDefaultAutoModConfig(): AutoModConfig {
        return {
            enabled: false,
            filters: {
                spam: true,
                invites: true,
                links: true,
                mentions: true,
                caps: true
            },
            thresholds: {
                maxMentions: 5,
                maxCaps: 70,    // percentage
                maxLines: 10,
                messageInterval: 5000,  // 5 seconds
                messageBurst: 5        // messages per interval
            },
            actions: {
                warn: true,
                delete: true,
                timeout: 5     // 5 minutes
            },
            whitelist: {
                users: [],
                roles: [],
                channels: [],
                links: []
            }
        };
    }

    private async ensureServerConfig(serverId: string): Promise<void> {
        try {
            const result = await this.client.execute({
                sql: 'SELECT 1 FROM server_configs WHERE server_id = ?',
                args: [serverId]
            });

            if (!result.rows[0]) {
                // Create new server config with default values
                const defaultConfig = {
                    automod: this.getDefaultAutoModConfig(),
                    version: 1
                };

                await this.client.execute({
                    sql: 'INSERT INTO server_configs (server_id, config) VALUES (?, ?)',
                    args: [serverId, JSON.stringify(defaultConfig)]
                });

                this.logger.info(`Created new server config for: ${serverId}`);
            }
        } catch (error) {
            this.logger.error('Error ensuring server config:', error);
            throw error;
        }
    }

    async recordAutoModViolation(violation: AutoModViolation): Promise<void> {
        try {
            await this.client.execute({
                sql: `
                    INSERT INTO automod_violations (
                        user_id, channel_id, message_id, 
                        violation_type, details, timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `,
                args: [
                    violation.userId,
                    violation.channelId,
                    violation.messageId,
                    violation.type,
                    violation.details || '',
                    violation.timestamp
                ]
            });
        } catch (error) {
            this.logger.error('Error recording automod violation:', error);
            throw error;
        }
    }

    private async initializeAutoModTables(): Promise<void> {
        await this.client.execute(`
            CREATE TABLE IF NOT EXISTS automod_violations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                message_id TEXT NOT NULL,
                violation_type TEXT NOT NULL,
                details TEXT,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
}