export class CircuitBreaker {
    private failures: number = 0;
    private lastFailure: number = 0;
    private readonly threshold: number = 5;
    private readonly resetTimeout: number = 60000;

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.isOpen()) {
            throw new Error('Circuit breaker is open');
        }

        try {
            const result = await fn();
            this.reset();
            return result;
        } catch (error) {
            this.recordFailure();
            throw error;
        }
    }

    private isOpen(): boolean {
        if (this.failures >= this.threshold) {
            const now = Date.now();
            if (now - this.lastFailure >= this.resetTimeout) {
                this.reset();
                return false;
            }
            return true;
        }
        return false;
    }

    private recordFailure(): void {
        this.failures++;
        this.lastFailure = Date.now();
    }

    private reset(): void {
        this.failures = 0;
        this.lastFailure = 0;
    }
}