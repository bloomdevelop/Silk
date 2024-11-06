import { Logger } from "./Logger.js";

export enum CircuitState {
    CLOSED = 'CLOSED',     // Normal operation
    OPEN = 'OPEN',        // Failing, rejecting requests
    HALF_OPEN = 'HALF_OPEN' // Testing if service is back
}

export class CircuitBreaker {
    private failures: number = 0;
    private lastFailure: number = 0;
    private state: CircuitState = CircuitState.CLOSED;
    private successfulTestCalls: number = 0;
    private logger: Logger;
    private resetTimeout: NodeJS.Timeout | null = null;

    constructor(
        private readonly name: string,
        private readonly threshold: number = 5,
        private readonly resetTimeoutMs: number = 60000,
        private readonly testCalls: number = 3
    ) {
        this.logger = Logger.getInstance(`CircuitBreaker: ${name}`);
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.isOpen()) {
            if (this.shouldAttemptReset()) {
                this.state = CircuitState.HALF_OPEN;
                this.logger.debug(`Circuit ${this.name} entering half-open state`);
            } else {
                this.logger.debug(`Circuit ${this.name} is open, rejecting request`);
                throw new Error(`Circuit breaker ${this.name} is open`);
            }
        }

        try {
            const result = await fn();
            this.handleSuccess();
            return result;
        } catch (error) {
            this.handleFailure(error);
            throw error;
        }
    }

    private isOpen(): boolean {
        return this.state === CircuitState.OPEN;
    }

    private shouldAttemptReset(): boolean {
        return Date.now() - this.lastFailure >= this.resetTimeoutMs;
    }

    private handleSuccess(): void {
        if (this.state === CircuitState.HALF_OPEN) {
            this.successfulTestCalls++;
            if (this.successfulTestCalls >= this.testCalls) {
                this.reset();
                this.logger.info(`Circuit ${this.name} closed after successful test calls`);
            }
        }
    }

    private handleFailure(error: unknown): void {
        this.failures++;
        this.lastFailure = Date.now();
        this.successfulTestCalls = 0;

        if (this.failures >= this.threshold) {
            this.state = CircuitState.OPEN;
            this.logger.warn(`Circuit ${this.name} opened after ${this.failures} failures`, error);
            this.scheduleReset();
        }
    }

    private reset(): void {
        this.failures = 0;
        this.lastFailure = 0;
        this.state = CircuitState.CLOSED;
        this.successfulTestCalls = 0;
    }

    getState(): CircuitState {
        return this.state;
    }

    getFailures(): number {
        return this.failures;
    }

    getLastFailure(): number {
        return this.lastFailure;
    }

    private scheduleReset(): void {
        this.destroy();
        
        this.resetTimeout = setTimeout(() => {
            if (this.state === CircuitState.OPEN) {
                this.state = CircuitState.HALF_OPEN;
                this.logger.debug(`Circuit ${this.name} entering half-open state`);
            }
            this.resetTimeout = null;
        }, this.resetTimeoutMs);
    }

    public destroy(): void {
        if (this.resetTimeout) {
            clearTimeout(this.resetTimeout);
            this.resetTimeout = null;
        }
        this.reset();
    }
}