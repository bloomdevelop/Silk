import { performance } from "perf_hooks";

export function formatDuration(ms: number): string {
    // Handle microseconds (less than 1ms)
    if (ms < 1) {
        return `${(ms * 1000).toFixed(0)}µs`;
    }
    
    // Handle milliseconds
    if (ms < 1000) {
        return `${ms.toFixed(0)}ms`;
    }
    
    // Handle seconds with ms
    if (ms < 60000) {
        const seconds = Math.floor(ms / 1000);
        const milliseconds = Math.floor(ms % 1000);
        return milliseconds > 0 ? `${seconds}s ${milliseconds}ms` : `${seconds}s`;
    }
    
    // Handle minutes
    if (ms < 3600000) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
    
    // Handle hours
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function measureTime(): () => number {
    const start = performance.now();
    return () => performance.now() - start;
} 