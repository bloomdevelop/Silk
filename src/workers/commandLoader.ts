import { parentPort } from 'node:worker_threads';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ICommand } from '../types.js';

interface LoadResult {
    commandFiles: string[];
    failed: number;
    time: number;
    category: string;
}

async function loadCommandsFromDirectory(
    distPath: string,
    category: string,
): Promise<LoadResult> {
    const startTime = Date.now();
    const commandFiles: string[] = [];
    let failed = 0;

    try {
        let jsFiles: string[] = [];
        try {
            const allFiles = await readdir(distPath);
            jsFiles = allFiles.filter((file: string) =>
                file.endsWith('.js'),
            );
        } catch (readdirError) {
            console.error(
                `[Worker] Error reading directory: ${String(readdirError)}`,
            );
            throw readdirError;
        }

        // Validate each file can be imported
        const loadPromises = jsFiles.map(async (file) => {
            try {
                const filePath = join(distPath, file);
                const commandModule = await import(filePath);
                const command: ICommand = commandModule.default;

                if (!command.name) {
                    throw new Error(
                        `Command in ${file} has no name property`,
                    );
                }

                commandFiles.push(filePath);
                return { success: true };
            } catch (error) {
                return {
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : String(error),
                    file,
                };
            }
        });

        const loadResults = await Promise.all(loadPromises);

        // Count and log failures
        for (const r of loadResults.filter((r) => !r.success)) {
            failed++;
            console.error(
                `Failed to load command from ${r.file}: ${r.error}`,
            );
        }
    } catch (error) {
        console.error('Error loading commands:', error);
        failed++;
    }

    return {
        commandFiles,
        failed,
        time: Date.now() - startTime,
        category,
    };
}

// Handle messages from main thread
if (parentPort) {
    const port = parentPort;
    port.on('message', async (message) => {
        try {
            const result = await loadCommandsFromDirectory(
                message.categoryPath,
                message.category,
            );
            port.postMessage(result);
        } catch (error) {
            port.postMessage({
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
                commandFiles: [],
                failed: 1,
                time: 0,
                category: '',
            });
        }
    });
}
