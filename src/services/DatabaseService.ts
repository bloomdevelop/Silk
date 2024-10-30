import { IConfiguration } from "../types"
import fs from "node:fs/promises"
import path from "node:path"
import { mainLogger } from "../utils/Logger"

export class DatabaseService {
    private static instance: DatabaseService
    private configCache: Map<string, IConfiguration>
    private readonly configPath: string

    private constructor() {
        this.configCache = new Map()
        this.configPath = path.join(process.cwd(), 'data', 'configs')
    }

    static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService()
        }
        return DatabaseService.instance
    }

    async getServerConfig(serverId: string): Promise<IConfiguration> {
        if (this.configCache.has(serverId)) {
            return this.configCache.get(serverId)!
        }

        const configFile = path.join(this.configPath, `${serverId}.json`)
        try {
            const data = await fs.readFile(configFile, 'utf-8')
            const config = JSON.parse(data) as IConfiguration
            this.configCache.set(serverId, config)
            return config
        } catch {
            return this.createDefaultConfig(serverId)
        }
    }

    async updateServerConfig(serverId: string, config: Partial<IConfiguration>): Promise<void> {
        const currentConfig = await this.getServerConfig(serverId)
        const newConfig = { ...currentConfig, ...config }

        await fs.mkdir(this.configPath, { recursive: true })
        await fs.writeFile(
            path.join(this.configPath, `${serverId}.json`),
            JSON.stringify(newConfig, null, 2)
        )

        this.configCache.set(serverId, newConfig)
        mainLogger.info(`Updated config for server: ${serverId}`)
    }

    private async createDefaultConfig(serverId: string): Promise<IConfiguration> {
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

        await this.updateServerConfig(serverId, defaultConfig)
        return defaultConfig
    }
}