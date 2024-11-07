import { mainLogger } from "./Logger.js";

interface RetryOptions {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
}

export class RateLimitHandler {
    private static async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private static getRetryDelay(attempt: number, baseDelay: number, maxDelay: number): number {
        // Exponential backoff with jitter
        const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
        return Math.floor(exponentialDelay + jitter);
    }

    public static async executeWithRetry<T>(
        operation: () => Promise<T>,
        options: RetryOptions = {}
    ): Promise<T> {
        const {
            maxRetries = 3,
            baseDelay = 1000,
            maxDelay = 10000
        } = options;

        let lastError: Error | null = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = error;

                // Check if it's a rate limit error (429)
                if (error?.response?.status === 429) {
                    // Get retry-after from headers (Revolt.js specific)
                    const retryAfter = error?.response?.headers?.['retry-after'] || 
                                     error?.response?.headers?.['Retry-After'] ||
                                     this.getRetryDelay(attempt, baseDelay, maxDelay);

                    const waitTime = typeof retryAfter === 'string' 
                        ? parseInt(retryAfter) * 1000 
                        : retryAfter;

                    mainLogger.warn(
                        `Rate limited (429). Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`
                    );

                    await this.delay(waitTime);
                    continue;
                }

                // If it's a 403 error, don't retry
                if (error?.response?.status === 403) {
                    mainLogger.error('Permission denied (403):', error?.message || error);
                    throw error;
                }

                // For other errors, retry with exponential backoff
                const waitTime = this.getRetryDelay(attempt, baseDelay, maxDelay);
                mainLogger.warn(
                    `Operation failed, retrying in ${waitTime}ms (${attempt + 1}/${maxRetries})`
                );
                await this.delay(waitTime);
            }
        }

        // If we've exhausted all retries
        throw lastError || new Error('Operation failed after max retries');
    }
} 