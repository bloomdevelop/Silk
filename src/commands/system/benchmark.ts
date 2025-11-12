import type { Client, Message } from 'stoat.js';
import type { ICommand } from '../../types.js';
import { BoxFormatter } from '../../utils/BoxFormatter.js';
import { formatDuration } from '../../utils/TimeUtils.js';
import { DatabaseService } from '../../services/DatabaseService.js';
import { CommandManager } from '../../managers/CommandManager.js';

async function runBenchmark(
    name: string,
    iterations: number,
    fn: () => Promise<void>,
): Promise<{
    name: string;
    avg: number;
    min: number;
    max: number;
    total: number;
}> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await fn();
        const time = Date.now() - start;
        times.push(time);
    }

    return {
        name,
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        total: times.reduce((a, b) => a + b, 0),
    };
}

const command: ICommand = {
    name: 'benchmark',
    description:
        'Run performance benchmarks on various bot operations',
    aliases: ['bench', 'perf'],
    category: 'System',
    usage: 'benchmark <iterations>',
    args: {
        required: false,
        minimum: 1,
        maximum: 50,
    },
    async execute(message: Message, args: string[], client: Client) {
        const iterations = Number.parseInt(args[0]) || 5;
        if (iterations < 1 || iterations > 50) {
            return message.reply(
                'Please specify a number of iterations between 1 and 50.',
            );
        }

        const initialReply = await message.reply(
            'Running benchmarks...',
        );
        const results: Array<{
            name: string;
            avg: number;
            min: number;
            max: number;
            total: number;
        }> = [];

        // Benchmark command loading
        const cmdMgr = CommandManager.getInstance(client);
        results.push(
            await runBenchmark(
                'Command Loading',
                iterations,
                async () => {
                    await cmdMgr.loadCommands();
                },
            ),
        );

        // Benchmark database operations
        const db = DatabaseService.getInstance();
        results.push(
            await runBenchmark('DB Write', iterations, async () => {
                await db.executeWrite(
                    'INSERT INTO benchmark_test (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
                    [
                        'test_key',
                        JSON.stringify({ timestamp: Date.now() }),
                    ],
                );
            }),
        );

        results.push(
            await runBenchmark('DB Read', iterations, async () => {
                await db.executeQuery(
                    'SELECT value FROM benchmark_test WHERE key = ?',
                    ['test_key'],
                );
            }),
        );

        // Benchmark message operations
        results.push(
            await runBenchmark(
                'Message Send',
                iterations,
                async () => {
                    await message.channel?.sendMessage(
                        'Benchmark test message',
                    );
                },
            ),
        );

        // Format results
        const summaryData = {
            Iterations: iterations.toString(),
            ...results.reduce(
                (acc, result) => {
                    acc[result.name] =
                        `avg: ${formatDuration(result.avg)} | min: ${formatDuration(result.min)} | max: ${formatDuration(result.max)}`;
                    return acc;
                },
                {} as Record<string, string>,
            ),
            'Total Time': formatDuration(
                results.reduce(
                    (acc, result) => acc + result.total,
                    0,
                ),
            ),
        };

        // Display results
        const resultBox = BoxFormatter.format(
            'Benchmark Results',
            summaryData,
            60,
        );

        if (initialReply) {
            await initialReply.edit({
                content: `\`\`\`\n${resultBox}\n\`\`\``,
            });
        }

        // Cleanup test data
        await db.executeWrite(
            'DELETE FROM benchmark_test WHERE key = ?',
            ['test_key'],
        );
    },
};

export default command;
