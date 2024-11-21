import { EventEmitter } from 'events';
import { Logger } from './Logger.js';
import { ulid } from 'ulid';

interface Task<T> {
    id: string;
    execute: () => Promise<T>;
    priority?: number;
    timeout?: number;
    retries?: number;
}

interface TaskResult<T> {
    id: string;
    result?: T;
    error?: Error;
    startTime: number;
    endTime: number;
    retries: number;
    success: boolean;
}

interface TaskQueueOptions {
    concurrency?: number;
    defaultTimeout?: number;
    maxRetries?: number;
}

interface TaskOptions<T> {
    execute: () => Promise<T>;
    timeout?: number;
    retries?: number;
    priority?: number;
}

export class TaskQueue extends EventEmitter {
    private queue: Task<any>[] = [];
    private running: boolean = false;
    private activeTasks: Map<string, Task<any>> = new Map();
    private taskResults: Map<string, TaskResult<any>> = new Map();
    private logger: Logger;
    private concurrency: number;
    private defaultTimeout: number;
    private maxRetries: number;

    constructor(options: TaskQueueOptions = {}) {
        super();
        this.logger = Logger.getInstance('TaskQueue');
        this.concurrency = options.concurrency || 1;
        this.defaultTimeout = options.defaultTimeout || 30000;
        this.maxRetries = options.maxRetries || 3;
    }

    /**
     * Add a task to the queue
     * @param task The task to add
     * @returns The task ID
     */
    public async addTask<T>(taskOptions: TaskOptions<T>): Promise<string> {
        const task: Task<T> = {
            id: ulid() /* Use ulid instead of uuid */,
            execute: taskOptions.execute,
            timeout: taskOptions.timeout || this.defaultTimeout,
            retries: taskOptions.retries || this.maxRetries,
            priority: taskOptions.priority || 0
        };

        this.queue.push(task);
        this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        if (!this.running) {
            this.running = true;
            this.processNextTasks();
        }

        return task.id;
    }

    /**
     * Get the result of a task
     * @param taskId The ID of the task
     * @returns The task result, or undefined if the task has not completed
     */
    public getTaskResult<T>(taskId: string): TaskResult<T> | undefined {
        return this.taskResults.get(taskId) as TaskResult<T>;
    }

    /**
     * Start processing the queue
     */
    public start(): void {
        if (this.running) return;
        
        this.running = true;
        this.logger.info('Task queue started');
        this.processNextTasks();
    }

    /**
     * Stop processing the queue
     */
    public stop(): void {
        this.running = false;
        this.logger.info('Task queue stopped');
        this.emit('stopped');
    }

    /**
     * Clear all pending tasks
     */
    public clear(): void {
        const pendingTasks = this.queue.length;
        this.queue = [];
        this.logger.info(`Cleared ${pendingTasks} pending tasks from queue`);
        this.emit('cleared', pendingTasks);
    }

    /**
     * Clear the result of a task
     * @param taskId The ID of the task
     */
    public clearTaskResult(taskId: string): void {
        this.taskResults.delete(taskId);
    }

    /**
     * Clear all task results
     */
    public clearAllTaskResults(): void {
        this.taskResults.clear();
    }

    public destroy(): void {
        this.stop();
        this.clear();
    }

    /**
     * Get the current queue status
     */
    public getStatus(): {
        queueLength: number;
        activeTasks: number;
        isRunning: boolean;
    } {
        return {
            queueLength: this.queue.length,
            activeTasks: this.activeTasks.size,
            isRunning: this.running
        };
    }

    private async processNextTasks(): Promise<void> {
        while (this.queue.length > 0 && this.activeTasks.size < this.concurrency) {
            const task = this.queue.shift();
            if (task) {
                this.activeTasks.set(task.id, task);
                this.executeTask(task).catch(error => {
                    this.logger.error(`Task ${task.id} failed with error:`, error);
                });
            }
        }

        if (this.queue.length === 0 && this.activeTasks.size === 0) {
            this.running = false;
        }
    }

    private async executeTask<T>(task: Task<T>): Promise<void> {
        const startTime = Date.now();
        let retries = 0;
        let error: Error | undefined;

        while (retries <= task.retries!) {
            try {
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error(`Task ${task.id} timed out after ${task.timeout}ms`)), task.timeout);
                });

                const result = await Promise.race([
                    task.execute(),
                    timeoutPromise
                ]);

                const taskResult: TaskResult<T> = {
                    id: task.id,
                    result: result as T,
                    startTime,
                    endTime: Date.now(),
                    retries,
                    success: true
                };

                this.taskResults.set(task.id, taskResult);
                this.emit('taskCompleted', taskResult);
                this.logger.debug(`Task ${task.id} completed successfully after ${retries} retries`);
                break;
            } catch (err) {
                error = err as Error;
                retries++;
                
                if (retries <= task.retries!) {
                    this.logger.warn(`Task ${task.id} failed, attempt ${retries}/${task.retries}:`, error);
                    await new Promise(resolve => setTimeout(resolve, Math.min(1000 * retries, 5000)));
                }
            }
        }

        if (error && retries > task.retries!) {
            const taskResult: TaskResult<T> = {
                id: task.id,
                result: undefined as unknown as T,
                error,
                startTime,
                endTime: Date.now(),
                retries: retries - 1,
                success: false
            };
            this.taskResults.set(task.id, taskResult);
            this.emit('taskFailed', taskResult);
            this.logger.error(`Task ${task.id} failed after ${retries - 1} retries:`, error);
        }

        this.activeTasks.delete(task.id);
        this.processNextTasks();
    }
}
