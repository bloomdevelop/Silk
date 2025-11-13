import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { mainLogger } from '../utils/Logger.js';
import type { ICommand, Category } from '../types.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

interface CachedCommandMetadata {
    name: string;
    description: string;
    category: Category;
    usage: string;
    aliases?: string[];
    args?: {
        required: boolean;
        minimum?: number;
        maximum?: number;
    };
    permissions?: {
        user?: string[];
        bot?: string[];
    };
    flags?: {
        wip?: boolean;
        disabled?: boolean;
        ownerOnly?: boolean;
        dangerous?: boolean;
        hidden?: boolean;
    };
}

interface CacheIndex {
    version: string;
    timestamp: number;
    commands: Record<string, CachedCommandMetadata>;
}

export class CommandCacheService {
    private static instance: CommandCacheService;
    private logger = mainLogger;
    private cacheDir: string;
    private cacheIndexPath: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private msgpack: any;
    private readonly CACHE_VERSION = '1.0.0';

    private constructor(dataDir: string) {
        this.cacheDir = join(dataDir, 'command_cache');
        this.cacheIndexPath = join(this.cacheDir, 'index.bin');
    }

    private async initMsgpack(): Promise<void> {
        if (!this.msgpack) {
            // @ts-ignore - msgpack5 has no type definitions
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
            this.msgpack = (await import('msgpack5')).default();
        }
    }

    static getInstance(dataDir: string): CommandCacheService {
        if (!CommandCacheService.instance) {
            CommandCacheService.instance = new CommandCacheService(
                dataDir,
            );
        }
        return CommandCacheService.instance;
    }

    async initialize(): Promise<void> {
        try {
            await this.initMsgpack();
            if (!existsSync(this.cacheDir)) {
                await mkdir(this.cacheDir, { recursive: true });
                this.logger.debug(
                    `Created command cache directory at ${this.cacheDir}`,
                );
            }
        } catch (error) {
            this.logger.error(
                'Error initializing command cache:',
                error,
            );
        }
    }

    private extractMetadata(
        command: ICommand,
    ): CachedCommandMetadata {
        return {
            name: command.name,
            description: command.description,
            category: command.category,
            usage: command.usage,
            aliases: command.aliases,
            args: command.args,
            permissions: command.permissions,
            flags: command.flags,
        };
    }

    async saveCache(
        commands: ICommand[],
    ): Promise<void> {
        try {
            await this.initMsgpack();
            const metadata: Record<string, CachedCommandMetadata> =
                {};

            for (const cmd of commands) {
                metadata[cmd.name] = this.extractMetadata(cmd);
            }

            const cacheIndex: CacheIndex = {
                version: this.CACHE_VERSION,
                timestamp: Date.now(),
                commands: metadata,
            };

            const msgpackBuffer = this.msgpack.encode(cacheIndex);
            const compressedBuffer = await gzipAsync(msgpackBuffer);
            await writeFile(this.cacheIndexPath, compressedBuffer);

            this.logger.debug(
                `Saved cache for ${commands.length} commands (${compressedBuffer.length} bytes, msgpack: ${msgpackBuffer.length} bytes)`,
            );
        } catch (error) {
            this.logger.error('Error saving command cache:', error);
        }
    }

    async loadCache(): Promise<ICommand[] | null> {
        try {
            await this.initMsgpack();
            if (!existsSync(this.cacheIndexPath)) {
                return null;
            }

            const compressedBuffer = await readFile(
                this.cacheIndexPath,
            );
            const decompressedBuffer = await gunzipAsync(
                compressedBuffer,
            );
            const cacheIndex: CacheIndex =
                this.msgpack.decode(decompressedBuffer) as CacheIndex;

            // Validate version
            if (cacheIndex.version !== this.CACHE_VERSION) {
                this.logger.debug(
                    `Cache version mismatch. Expected ${this.CACHE_VERSION}, got ${cacheIndex.version}. Invalidating cache.`,
                );
                return null;
            }

            // Return commands without execute function (will be loaded separately)
            const cachedCommands: ICommand[] = Object.values(
                cacheIndex.commands,
            ).map((metadata) => ({
                ...metadata,
                execute: async () => {
                    // Placeholder
                },
            } as ICommand));

            this.logger.debug(
                `Loaded cache for ${cachedCommands.length} commands`,
            );
            return cachedCommands;
        } catch (error) {
            this.logger.debug(
                'Error loading command cache:',
                error,
            );
            return null;
        }
    }

    async clearCache(): Promise<void> {
        try {
            await this.initMsgpack();
            const emptyCache: CacheIndex = {
                version: this.CACHE_VERSION,
                timestamp: Date.now(),
                commands: {},
            };

            const msgpackBuffer = this.msgpack.encode(emptyCache);
            const compressedBuffer = await gzipAsync(msgpackBuffer);
            await writeFile(this.cacheIndexPath, compressedBuffer);
            this.logger.debug('Cleared command cache');
        } catch (error) {
            this.logger.error('Error clearing command cache:', error);
        }
    }
}
