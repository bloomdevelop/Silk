import {
    createClient,
    type Client,
    type Transaction,
} from '@libsql/client';
import { Logger, mainLogger } from '../utils/Logger.js';
import type {
    AutoModConfig,
    IConfiguration,
    UserEconomy,
    AutoModViolation,
} from '../types.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PreparedStatements {
    getUserEconomy: string;
    updateUserEconomy: string;
    getServerConfig: string;
    updateServerConfig: string;
    recordViolation: string;
}

export class DatabaseService {
    private static instance: DatabaseService | undefined;
    private client!: Client;
    private isInitialized = false;
    private configCache: Map<
        string,
        {
            data: IConfiguration;
            timestamp: number;
            dirty: boolean; // Track if cache needs to be saved
        }
    >;
    private preparedStatements!: PreparedStatements;
    private batchOperations: Map<string, (() => Promise<void>)[]>;
    private batchTimeout?: NodeJS.Timeout;
    private cleanupInterval?: NodeJS.Timeout;
    private readonly BATCH_DELAY = 100; // ms
    private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 500; // ms
    private logger: Logger;

    private constructor() {
        this.configCache = new Map();
        this.batchOperations = new Map();
        this.logger = Logger.getInstance('Database');
        this.setupCleanupHandler();
    }

    static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    getDataDir(): string {
        const __dirname = dirname(
            fileURLToPath(import.meta.url),
        );
        return join(__dirname, '..', '..', 'data');
    }

    private async prepareStatements(): Promise<void> {
        this.preparedStatements = {
            getUserEconomy: 'SELECT * FROM economy WHERE user_id = ?',
            updateUserEconomy: `
                INSERT INTO economy (user_id, balance, bank, last_daily, last_work, work_streak, inventory, total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                balance = excluded.balance,
                bank = excluded.bank,
                last_daily = excluded.last_daily,
                last_work = excluded.last_work,
                work_streak = excluded.work_streak,
                inventory = excluded.inventory,
                total = excluded.total
            `,
            getServerConfig:
                'SELECT * FROM configurations WHERE server_id = ?',
            updateServerConfig: `
                INSERT INTO configurations (
                    server_id, prefix, welcome_channel, log_channel,
                    bot_name, bot_status, bot_cooldown, bot_owners,
                    commands_enabled, disabled_commands, dangerous_commands,
                    feature_welcome, feature_logging, feature_automod,
                    feature_exp_moderation, feature_exp_economy,
                    security_antispam, security_max_mentions,
                    security_max_lines, security_blocked_users,
                    security_allowed_servers, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(server_id) DO UPDATE SET
                prefix = excluded.prefix,
                welcome_channel = excluded.welcome_channel,
                log_channel = excluded.log_channel,
                bot_name = excluded.bot_name,
                bot_status = excluded.bot_status,
                bot_cooldown = excluded.bot_cooldown,
                bot_owners = excluded.bot_owners,
                commands_enabled = excluded.commands_enabled,
                disabled_commands = excluded.disabled_commands,
                dangerous_commands = excluded.dangerous_commands,
                feature_welcome = excluded.feature_welcome,
                feature_logging = excluded.feature_logging,
                feature_automod = excluded.feature_automod,
                feature_exp_moderation = excluded.feature_exp_moderation,
                feature_exp_economy = excluded.feature_exp_economy,
                security_antispam = excluded.security_antispam,
                security_max_mentions = excluded.security_max_mentions,
                security_max_lines = excluded.security_max_lines,
                security_blocked_users = excluded.security_blocked_users,
                security_allowed_servers = excluded.security_allowed_servers,
                updated_at = CURRENT_TIMESTAMP
            `,
            recordViolation: `
                INSERT INTO automod_violations (
                    type, user_id, channel_id, message_id, timestamp, details
                ) VALUES (?, ?, ?, ?, ?, ?)
            `,
        };
    }

    private async processBatch(
        key?: string,
        operations?: (() => Promise<void>)[],
        retryCount = 0,
    ): Promise<void> {
        if (!this.isInitialized) {
            this.logger.debug(
                'Database not initialized, skipping batch processing',
            );
            return;
        }

        // If no specific operations provided, process all batches
        if (!key || !operations) {
            if (this.batchOperations.size === 0) return;

            const allOperations = new Map(this.batchOperations);
            this.batchOperations.clear();

            for (const [batchKey, ops] of allOperations) {
                await this.processBatch(batchKey, ops);
            }
            return;
        }

        // Process specific batch
        try {
            const transaction = await this.beginTransaction();
            try {
                for (const operation of operations) {
                    await operation();
                }
                await this.commitTransaction(transaction);
                this.batchOperations.delete(key);
                this.logger.debug(
                    `Processed batch of ${operations.length} operations for ${key}`,
                );
            } catch (error) {
                await this.rollbackTransaction(transaction);
                throw error;
            }
        } catch (error) {
            const errorMsg = String(error);
            const isLockError =
                errorMsg.includes('SQLITE_BUSY') ||
                errorMsg.includes('database is locked');

            if (
                isLockError &&
                retryCount < this.MAX_RETRIES
            ) {
                this.logger.debug(
                    `Database locked, retrying batch for ${key} (attempt ${retryCount + 1}/${this.MAX_RETRIES})`,
                );
                // Wait before retrying
                await new Promise((resolve) =>
                    setTimeout(resolve, this.RETRY_DELAY),
                );
                // Retry the batch
                return this.processBatch(key, operations, retryCount + 1);
            }

            this.logger.error(
                `Error processing batch for ${key}:`,
                error,
            );
            // Clear the failed batch to prevent retry
            this.batchOperations.delete(key);
        }
    }

    private scheduleBatch(
        key: string,
        operation: () => Promise<void>,
    ): void {
        if (!this.batchOperations.has(key)) {
            this.batchOperations.set(key, []);
        }
        const operations = this.batchOperations.get(key);
        if (operations) {
            operations.push(operation);
        }

        // Clear existing timeout
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        // Schedule new batch processing
        this.batchTimeout = setTimeout(
            () => this.processBatch(),
            this.BATCH_DELAY,
        );
    }

    private async cleanup(): Promise<void> {
        try {
            this.checkInitialized();
            const now = Date.now();

            // Process any pending batches first
            await this.processBatch();

            // Cleanup config cache and flush dirty entries
            const dirtyConfigs: Promise<void>[] = [];
            for (const [
                serverId,
                cache,
            ] of this.configCache.entries()) {
                if (now - cache.timestamp > this.CACHE_TTL) {
                    if (cache.dirty) {
                        dirtyConfigs.push(
                            this.updateServerConfig(
                                serverId,
                                cache.data,
                            ),
                        );
                    }
                    this.configCache.delete(serverId);
                }
            }

            // Wait for all dirty configs to be saved
            if (dirtyConfigs.length > 0) {
                await Promise.all(dirtyConfigs);
                this.logger.debug(
                    `Flushed ${dirtyConfigs.length} dirty configurations`,
                );
            }

            this.logger.debug('Database cleanup completed');
        } catch (error) {
            this.logger.error(
                'Error during database cleanup:',
                error,
            );
        }
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
                const __dirname = dirname(
                    fileURLToPath(import.meta.url),
                );
                const dbPath = join(
                    __dirname,
                    '..',
                    '..',
                    'data',
                    'silk.db',
                );

                // Create data directory if it doesn't exist
                const dataDir = join(__dirname, '..', '..', 'data');
                try {
                    await import('node:fs/promises').then((fs) =>
                        fs.mkdir(dataDir, { recursive: true }),
                    );
                    mainLogger.info(
                        `Created data directory at: ${dataDir}`,
                    );
                } catch (mkdirError) {
                    mainLogger.error(
                        'Failed to create data directory:',
                        mkdirError,
                    );
                    throw mkdirError;
                }

                mainLogger.info(
                    `Using local SQLite database at: ${dbPath}`,
                );
                this.client = createClient({
                    url: `file:${dbPath}`,
                });
            } else {
                // Use Turso database if URL is provided
                mainLogger.info('Using Turso database');
                this.client = createClient({
                    url: dbUrl,
                    authToken,
                });
            }

            // Test the connection
            await this.client.execute('SELECT 1');
            mainLogger.info('Database connection established');

            // Configure SQLite for better concurrency
            if (!dbUrl) {
                // Enable WAL mode and set busy timeout for local SQLite
                await this.client.execute('PRAGMA journal_mode = WAL');
                await this.client.execute('PRAGMA busy_timeout = 5000');
                await this.client.execute('PRAGMA synchronous = NORMAL');
                mainLogger.debug('SQLite WAL mode enabled');
            }

            // Prepare statements
            await this.prepareStatements();

            // Setup tables
            await this.setupTables();
            this.setupCleanupInterval();
            await this.initializeAutoModTables();
            this.isInitialized = true;
            mainLogger.info(
                'Database service initialized successfully',
            );
        } catch (error) {
            this.isInitialized = false;
            mainLogger.error(
                'Failed to initialize database service:',
                error,
            );
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

            // Create economy table for user economy data
            await this.client.execute(`
                CREATE TABLE IF NOT EXISTS economy (
                    user_id TEXT PRIMARY KEY,
                    balance INTEGER DEFAULT 0,
                    bank INTEGER DEFAULT 0,
                    last_daily INTEGER,
                    last_work INTEGER,
                    work_streak INTEGER DEFAULT 0,
                    inventory TEXT DEFAULT '[]',
                    total INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Migrate existing configurations to server_configs if needed
            await this.migrateConfigurations();

            mainLogger.debug('Database tables setup completed');
        } catch (error) {
            mainLogger.error(
                'Error setting up database tables:',
                error,
            );
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
    
            if (!result?.rows?.length) {
                return;
            }

            for (const row of result.rows) {
                const serverId = row.server_id as string;

                // Create default AutoMod config
                const defaultConfig = {
                    automod: this.getDefaultAutoModConfig(),
                    version: 1, // Add version for future migrations
                };

                // Insert into server_configs
                await this.client.execute({
                    sql: `
                        INSERT INTO server_configs (server_id, config)
                        VALUES (?, ?)
                    `,
                    args: [serverId, JSON.stringify(defaultConfig)],
                });

                mainLogger.info(
                    `Migrated configuration for server: ${serverId}`,
                );
            }

            if (result.rows.length > 0) {
                mainLogger.info(
                    `Successfully migrated ${result.rows.length} server configurations`,
                );
            }
        } catch (error) {
            mainLogger.error(
                'Error during configuration migration:',
                error,
            );
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

    public async commitTransaction(
        transaction: Transaction,
    ): Promise<void> {
        this.checkInitialized();
        await transaction.commit();
    }

    public async rollbackTransaction(
        transaction: Transaction,
    ): Promise<void> {
        this.checkInitialized();
        await transaction.rollback();
    }

    public async getUserEconomy(
        userId: string,
    ): Promise<UserEconomy> {
        this.checkInitialized();
        try {
            const result = await this.client.execute({
                sql: this.preparedStatements.getUserEconomy,
                args: [userId],
            });

            if (!result?.rows?.[0]) {
                 // Create default economy for new user
                 const defaultEconomy: UserEconomy = {
                    user_id: userId,
                    balance: 0,
                    bank: 0,
                    lastDaily: null,
                    lastWork: null,
                    workStreak: 0,
                    inventory: [],
                    total: 0,
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
                        null,
                    ],
                });

                return defaultEconomy;
            }

            const row = result.rows[0];
            if (!row) {
                throw new Error('Failed to retrieve user economy data');
            }

            return {
                user_id: row.user_id as string,
                balance: Number(row.balance),
                bank: Number(row.bank),
                lastDaily: row.last_daily
                    ? new Date(String(row.last_daily))
                    : null,
                lastWork: row.last_work
                    ? new Date(String(row.last_work))
                    : null,
                workStreak: Number(row.work_streak || 0),
                inventory: ((row.inventory as string) || '')
                    .split(',')
                    .filter(Boolean),
                total: Number(row.balance) + Number(row.bank),
            };
        } catch (error) {
            mainLogger.error(
                `Error getting user economy for ${userId}:`,
                error,
            );
            throw error;
        }
    }

    public async updateUserEconomy(
        userId: string,
        economy: UserEconomy,
    ): Promise<void> {
        this.checkInitialized();

        const operation = async () => {
            await this.client.execute({
                sql: this.preparedStatements.updateUserEconomy,
                args: [
                    userId,
                    economy.balance,
                    economy.bank,
                    economy.lastDaily,
                    economy.lastWork,
                    economy.workStreak,
                    JSON.stringify(economy.inventory),
                    economy.total,
                ],
            });
        };

        // Schedule the update as part of a batch
        this.scheduleBatch(`economy:${userId}`, operation);
    }

    public async getLeaderboard(
        page = 1,
        perPage = 10,
    ): Promise<UserEconomy[]> {
        this.checkInitialized();
        try {
            const offset = (page - 1) * perPage;
            const result = await this.client.execute({
                sql: `SELECT * FROM economy 
                      ORDER BY (balance + bank) DESC 
                      LIMIT ? OFFSET ?`,
                args: [perPage, offset],
            });

            return (result.rows ?? []).map((row) => ({
                user_id: row.user_id as string,
                balance: Number(row.balance),
                bank: Number(row.bank),
                lastDaily: row.last_daily
                    ? new Date(String(row.last_daily))
                    : null,
                lastWork: row.last_work
                    ? new Date(String(row.last_work))
                    : null,
                workStreak: Number(row.work_streak || 0),
                inventory: ((row.inventory as string) || '')
                    .split(',')
                    .filter(Boolean),
                total: Number(row.balance) + Number(row.bank),
            }));
        } catch (error) {
            mainLogger.error('Error getting leaderboard:', error);
            throw error;
        }
    }

    public async getServerConfig(
        serverId: string,
    ): Promise<IConfiguration> {
        this.checkInitialized();
        try {
            // Check cache first
            const cached = this.configCache.get(serverId);
            if (
                cached &&
                Date.now() - cached.timestamp < this.CACHE_TTL
            ) {
                return cached.data;
            }

            // First check server_configs table
            const serverConfigResult = await this.client.execute({
                sql: this.preparedStatements.getServerConfig,
                args: [serverId],
            });

            if (serverConfigResult?.rows?.[0]) {
                // Server has a config in server_configs
                let config: Record<string, unknown>;
                try {
                    const configStr = serverConfigResult.rows[0]
                        .config as string;
                    config = configStr
                        ? (JSON.parse(configStr) as Record<
                              string,
                              unknown
                          >)
                        : {};
                } catch (parseError) {
                    this.logger.error(
                        `Error parsing config for server ${serverId}:`,
                        parseError,
                    );
                    config = {};
                }

                // Ensure all required properties exist with default values
                const typedConfig = config as Record<string, unknown>;
                const bot = (typedConfig.bot ?? {}) as Record<
                    string,
                    unknown
                >;
                const commands = (typedConfig.commands ??
                    {}) as Record<string, unknown>;
                const features = (typedConfig.features ??
                    {}) as Record<string, unknown>;
                const featuresExp = (features.experiments ??
                    {}) as Record<string, unknown>;
                const security = (typedConfig.security ??
                    {}) as Record<string, unknown>;
                const automod = (typedConfig.automod ?? {}) as Record<
                    string,
                    unknown
                >;
                const automodFilters = (automod.filters ??
                    {}) as Record<string, unknown>;
                const automodThresholds = (automod.thresholds ??
                    {}) as Record<string, unknown>;
                const automodActions = (automod.actions ??
                    {}) as Record<string, unknown>;
                const automodWhitelist = (automod.whitelist ??
                    {}) as Record<string, unknown>;

                const validatedConfig: IConfiguration = {
                    prefix:
                        (typedConfig.prefix as unknown as
                            | string
                            | undefined) ?? 's?',
                    welcomeChannel:
                        (typedConfig.welcomeChannel as unknown as
                            | string
                            | null
                            | undefined) ?? null,
                    logChannel:
                        (typedConfig.logChannel as unknown as
                            | string
                            | null
                            | undefined) ?? null,
                    bot: {
                        name:
                            (bot.name as string | undefined) ??
                            'Silk',
                        status:
                            (bot.status as string | undefined) ??
                            'online',
                        prefix:
                            (bot.prefix as string | undefined) ??
                            's?',
                        defaultCooldown:
                            (bot.defaultCooldown as
                                | number
                                | undefined) ?? 3000,
                        owners: Array.isArray(bot.owners)
                            ? (bot.owners as string[])
                            : [],
                    },
                    commands: {
                        enabled:
                            (commands.enabled as
                                | boolean
                                | undefined) ?? true,
                        disabled: Array.isArray(commands.disabled)
                            ? (commands.disabled as string[])
                            : [],
                        dangerous: Array.isArray(commands.dangerous)
                            ? (commands.dangerous as string[])
                            : [],
                    },
                    features: {
                        welcome:
                            (features.welcome as
                                | boolean
                                | undefined) ?? false,
                        logging:
                            (features.logging as
                                | boolean
                                | undefined) ?? false,
                        automod:
                            (features.automod as
                                | boolean
                                | undefined) ?? true,
                        experiments: {
                            moderation:
                                (featuresExp.moderation as
                                    | boolean
                                    | undefined) ?? false,
                            economy:
                                (featuresExp.economy as
                                    | boolean
                                    | undefined) ?? false,
                        },
                    },
                    security: {
                        antiSpam:
                            (security.antiSpam as
                                | boolean
                                | undefined) ?? true,
                        maxMentions:
                            (security.maxMentions as
                                | number
                                | undefined) ?? 5,
                        maxLines:
                            (security.maxLines as
                                | number
                                | undefined) ?? 10,
                        blockedUsers: Array.isArray(
                            security.blockedUsers,
                        )
                            ? (security.blockedUsers as string[])
                            : [],
                        allowedServers: Array.isArray(
                            security.allowedServers,
                        )
                            ? (security.allowedServers as string[])
                            : [],
                    },
                    automod: {
                        enabled:
                            (automod.enabled as
                                | boolean
                                | undefined) ?? false,
                        filters: {
                            spam:
                                (automodFilters.spam as
                                    | boolean
                                    | undefined) ?? true,
                            invites:
                                (automodFilters.invites as
                                    | boolean
                                    | undefined) ?? true,
                            links:
                                (automodFilters.links as
                                    | boolean
                                    | undefined) ?? true,
                            mentions:
                                (automodFilters.mentions as
                                    | boolean
                                    | undefined) ?? true,
                            caps:
                                (automodFilters.caps as
                                    | boolean
                                    | undefined) ?? true,
                        },
                        thresholds: {
                            maxMentions:
                                (automodThresholds.maxMentions as
                                    | number
                                    | undefined) ?? 5,
                            maxCaps:
                                (automodThresholds.maxCaps as
                                    | number
                                    | undefined) ?? 70,
                            messageBurst:
                                (automodThresholds.messageBurst as
                                    | number
                                    | undefined) ?? 5,
                        },
                        actions: {
                            warn:
                                (automodActions.warn as
                                    | boolean
                                    | undefined) ?? true,
                            delete:
                                (automodActions.delete as
                                    | boolean
                                    | undefined) ?? true,
                            timeout:
                                (automodActions.timeout as
                                    | number
                                    | undefined) ?? 5,
                        },
                        whitelist: {
                            users: Array.isArray(
                                automodWhitelist.users,
                            )
                                ? (automodWhitelist.users as string[])
                                : [],
                            roles: Array.isArray(
                                automodWhitelist.roles,
                            )
                                ? (automodWhitelist.roles as string[])
                                : [],
                            channels: Array.isArray(
                                automodWhitelist.channels,
                            )
                                ? (automodWhitelist.channels as string[])
                                : [],
                            links: Array.isArray(
                                automodWhitelist.links,
                            )
                                ? (automodWhitelist.links as string[])
                                : [],
                        },
                    },
                };

                // Cache the validated config
                this.configCache.set(serverId, {
                    data: validatedConfig,
                    timestamp: Date.now(),
                    dirty: false,
                });

                return validatedConfig;
            }

            // If no configuration exists, create a new one
            return await this.createDefaultConfig(serverId);
        } catch (error) {
            mainLogger.error(
                `Error getting server config for ${serverId}:`,
                error,
            );
            throw error;
        }
    }

    public async createDefaultConfig(
        serverId: string,
    ): Promise<IConfiguration> {
        this.checkInitialized();
        const defaultConfig: IConfiguration = {
            prefix: 's?',
            welcomeChannel: null,
            logChannel: null,
            bot: {
                name: 'Silk',
                status: 'online',
                prefix: 's?',
                defaultCooldown: 3000,
                owners: [],
            },
            commands: {
                enabled: true,
                disabled: [],
                dangerous: [],
            },
            features: {
                welcome: false,
                logging: false,
                automod: true,
                experiments: {
                    moderation: false,
                    economy: false,
                },
            },
            security: {
                antiSpam: true,
                maxMentions: 5,
                maxLines: 10,
                blockedUsers: [],
                allowedServers: [],
            },
            automod: {
                enabled: true,
                filters: {
                    spam: true,
                    invites: true,
                    links: true,
                    mentions: true,
                    caps: true,
                },
                thresholds: {
                    maxMentions: 5,
                    maxCaps: 70,
                    messageBurst: 5,
                },
                actions: {
                    warn: true,
                    delete: true,
                    timeout: 5,
                },
                whitelist: {
                    users: [],
                    roles: [],
                    channels: [],
                    links: [],
                },
            },
        };

        try {
            await this.client.execute({
                sql: this.preparedStatements.updateServerConfig,
                args: [
                    serverId,
                    defaultConfig.prefix,
                    defaultConfig.welcomeChannel,
                    defaultConfig.logChannel,
                    defaultConfig.bot.name,
                    defaultConfig.bot.status,
                    defaultConfig.bot.defaultCooldown,
                    JSON.stringify(defaultConfig.bot.owners),
                    defaultConfig.commands.enabled ? 1 : 0,
                    JSON.stringify(defaultConfig.commands.disabled),
                    JSON.stringify(defaultConfig.commands.dangerous),
                    defaultConfig.features.welcome ? 1 : 0,
                    defaultConfig.features.logging ? 1 : 0,
                    defaultConfig.features.automod ? 1 : 0,
                    defaultConfig.features.experiments.moderation
                        ? 1
                        : 0,
                    defaultConfig.features.experiments.economy
                        ? 1
                        : 0,
                    defaultConfig.security.antiSpam ? 1 : 0,
                    defaultConfig.security.maxMentions,
                    defaultConfig.security.maxLines,
                    JSON.stringify(
                        defaultConfig.security.blockedUsers,
                    ),
                    JSON.stringify(
                        defaultConfig.security.allowedServers,
                    ),
                ],
            });

            // Cache the default config
            this.configCache.set(serverId, {
                data: defaultConfig,
                timestamp: Date.now(),
                dirty: false,
            });

            return defaultConfig;
        } catch (error) {
            this.logger.error(
                `Error creating default config for ${serverId}:`,
                error,
            );
            throw error;
        }
    }

    public async updateServerConfig(
        serverId: string,
        config: IConfiguration,
    ): Promise<void> {
        this.checkInitialized();

        // Update cache
        this.configCache.set(serverId, {
            data: config,
            timestamp: Date.now(),
            dirty: true,
        });

        const operation = async () => {
            await this.client.execute({
                sql: this.preparedStatements.updateServerConfig,
                args: [
                    serverId,
                    config.prefix,
                    config.welcomeChannel,
                    config.logChannel,
                    config.bot.name,
                    config.bot.status,
                    config.bot.defaultCooldown,
                    JSON.stringify(config.bot.owners),
                    config.commands.enabled ? 1 : 0,
                    JSON.stringify(config.commands.disabled),
                    JSON.stringify(config.commands.dangerous),
                    config.features.welcome ? 1 : 0,
                    config.features.logging ? 1 : 0,
                    config.features.automod ? 1 : 0,
                    config.features.experiments.moderation ? 1 : 0,
                    config.features.experiments.economy ? 1 : 0,
                    config.security.antiSpam ? 1 : 0,
                    config.security.maxMentions,
                    config.security.maxLines,
                    JSON.stringify(config.security.blockedUsers),
                    JSON.stringify(config.security.allowedServers),
                ],
            });

            // Update cache status after successful save
            const cache = this.configCache.get(serverId);
            if (cache) {
                cache.dirty = false;
            }
        };

        // Schedule the update as part of a batch
        this.scheduleBatch(`config:${serverId}`, operation);
    }

    public async getAutoModConfig(
        serverId?: string,
    ): Promise<AutoModConfig> {
        try {
            if (!serverId) {
                return this.getDefaultAutoModConfig();
            }

            // First, ensure server has a config
            await this.ensureServerConfig(serverId);

            const result = await this.client.execute({
                sql: 'SELECT config FROM server_configs WHERE server_id = ?',
                args: [serverId],
            });

            if (!result?.rows?.[0]) {
                return this.getDefaultAutoModConfig();
            }

            const serverConfig = JSON.parse(
                (result.rows[0].config) as string,
            );
            return {
                ...this.getDefaultAutoModConfig(),
                ...serverConfig.automod,
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
                caps: true,
            },
            thresholds: {
                maxMentions: 5,
                maxCaps: 70, // percentage
                maxLines: 10,
                messageInterval: 5000, // 5 seconds
                messageBurst: 5, // messages per interval
            },
            actions: {
                warn: true,
                delete: true,
                timeout: 5, // 5 minutes
            },
            whitelist: {
                users: [],
                roles: [],
                channels: [],
                links: [],
            },
        };
    }

    private async ensureServerConfig(
        serverId: string,
    ): Promise<void> {
        try {
            const result = await this.client.execute({
                sql: 'SELECT 1 FROM server_configs WHERE server_id = ?',
                args: [serverId],
            });

            if (!result?.rows?.[0]) {
                // Create new server config with default values
                const defaultConfig = {
                    automod: this.getDefaultAutoModConfig(),
                    version: 1,
                };

                await this.client.execute({
                    sql: 'INSERT INTO server_configs (server_id, config) VALUES (?, ?)',
                    args: [serverId, JSON.stringify(defaultConfig)],
                });

                this.logger.info(
                    `Created new server config for: ${serverId}`,
                );
            }
        } catch (error) {
            this.logger.error('Error ensuring server config:', error);
            throw error;
        }
    }

    public async recordAutoModViolation(
        violation: AutoModViolation,
    ): Promise<void> {
        this.checkInitialized();

        if (
            !violation.type ||
            !violation.userId ||
            !violation.channelId ||
            !violation.messageId
        ) {
            throw new Error('Invalid violation data');
        }

        const operation = async () => {
            await this.client.execute({
                sql: this.preparedStatements.recordViolation,
                args: [
                    violation.type,
                    violation.userId,
                    violation.channelId,
                    violation.messageId,
                    violation.timestamp || Date.now(),
                    violation.details || '',
                ],
            });
        };

        // Schedule the violation record as part of a batch
        this.scheduleBatch(
            `violation:${violation.userId}`,
            operation,
        );
    }

    private async initializeAutoModTables(): Promise<void> {
        await this.client.execute(`
            CREATE TABLE IF NOT EXISTS automod_violations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                user_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                message_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    private setupCleanupInterval(): void {
        this.cleanupInterval = setInterval(
            () => this.cleanup(),
            this.CLEANUP_INTERVAL,
        );
    }

    private setupCleanupHandler(): void {
        const cleanup = async () => {
            try {
                await this.destroy();
                this.logger.debug(
                    'DatabaseService cleaned up successfully',
                );
            } catch (error) {
                this.logger.error(
                    'Error during DatabaseService cleanup:',
                    error,
                );
            }
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('exit', cleanup);
        process.on('uncaughtException', async (error) => {
            this.logger.error(
                'Uncaught exception in DatabaseService:',
                error,
            );
            await cleanup();
        });
        process.on('unhandledRejection', async (reason) => {
            this.logger.error(
                'Unhandled rejection in DatabaseService:',
                reason,
            );
            await cleanup();
        });
    }

    public async destroy(): Promise<void> {
        try {
            // Skip cleanup if not initialized
            if (!this.isInitialized) {
                this.logger.debug(
                    'Database service not initialized, skipping cleanup',
                );
                return;
            }

            // Process any remaining batch operations
            for (const [
                key,
                operations,
            ] of this.batchOperations.entries()) {
                try {
                    this.logger.debug(
                        `Processing remaining batch operations for ${key}`,
                    );
                    await this.processBatch(key, operations);
                } catch (error) {
                    this.logger.error(
                        `Error processing batch for ${key}:`,
                        error,
                    );
                }
            }

            // Clear all intervals and timeouts
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = undefined;
            }
            if (this.batchTimeout) {
                clearTimeout(this.batchTimeout);
                this.batchTimeout = undefined;
            }

            // Flush cache to database
            await this.flushCache();

            // Close database connection
            if (this.client) {
                await this.client.close();
            }

            // Clear all maps and state
            this.configCache.clear();
            this.batchOperations.clear();
            this.isInitialized = false;

            // Reset the singleton instance
            DatabaseService.instance = undefined;

            this.logger.info(
                'Database service destroyed successfully',
            );
        } catch (error) {
            this.logger.error(
                'Error during database service cleanup:',
                error,
            );
            throw error;
        }
    }

    private async flushCache(): Promise<void> {
        try {
            this.logger.debug('Flushing database cache...');
            const promises: Promise<void>[] = [];

            // Save all cached configurations
            for (const [serverId, cache] of this.configCache) {
                try {
                    promises.push(
                        this.updateServerConfig(serverId, cache.data),
                    );
                } catch (error) {
                    this.logger.error(
                        `Error flushing config for server ${serverId}:`,
                        error,
                    );
                }
            }

            // Wait for all updates to complete
            await Promise.allSettled(promises);
            this.logger.info(
                `Successfully flushed ${promises.length} cached configurations`,
            );
        } catch (error) {
            this.logger.error('Error during cache flush:', error);
            throw error;
        }
    }

    public async executeQuery(
        sql: string,
        args: (string | number | boolean | null)[] = [],
    ): Promise<unknown> {
        this.checkInitialized();
        return await this.client.execute({
            sql,
            args,
        });
    }

    public async executeWrite(
        sql: string,
        args: (string | number | boolean | null)[] = [],
    ): Promise<void> {
        this.checkInitialized();
        await this.client.execute({
            sql,
            args,
        });
    }
}
