import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mainLogger } from '../utils/Logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ChangelogEntry {
    version: string;
    date: string;
    changes: string[];
}

export class VersionManager {
    private static instance: VersionManager | null = null;
    private changelogPath: string;
    private packageJsonPath: string;

    private constructor() {
        this.changelogPath = join(__dirname, '../../changelog.json');
        this.packageJsonPath = join(__dirname, '../../package.json');
    }

    public static getInstance(): VersionManager {
        if (!VersionManager.instance) {
            VersionManager.instance = new VersionManager();
        }
        return VersionManager.instance;
    }

    private getPackageVersion(): string {
        try {
            const packageJson = JSON.parse(readFileSync(this.packageJsonPath, 'utf-8'));
            return packageJson.version;
        } catch (error) {
            mainLogger.error('Error reading package.json:', error);
            throw error;
        }
    }

    public getChangelog(): ChangelogEntry[] {
        try {
            return JSON.parse(readFileSync(this.changelogPath, 'utf-8'));
        } catch (error) {
            mainLogger.error('Error reading changelog.json:', error);
            return [];
        }
    }

    private saveChangelog(changelog: ChangelogEntry[]): void {
        try {
            writeFileSync(this.changelogPath, JSON.stringify(changelog, null, 4));
        } catch (error) {
            mainLogger.error('Error writing changelog.json:', error);
            throw error;
        }
    }

    private generateChanges(oldCode: string, newCode: string): string[] {
        const changes: string[] = [];
        
        // Enhanced change detection
        if (this.hasNewFeatures(oldCode, newCode)) {
            // Look for specific feature additions
            const newFeatures = this.detectNewFeatures(oldCode, newCode);
            changes.push(...newFeatures);
        }

        if (this.hasModifications(oldCode, newCode)) {
            // Look for specific modifications
            const modifications = this.detectModifications(oldCode, newCode);
            changes.push(...modifications);
        }

        if (this.hasBugFixes(oldCode, newCode)) {
            changes.push("Fixed various bugs and issues");
        }

        if (this.hasPerformanceImprovements(oldCode, newCode)) {
            changes.push("Improved performance");
        }

        return changes;
    }

    private detectNewFeatures(oldCode: string, newCode: string): string[] {
        const features: string[] = [];
        
        // Detect new classes
        const newClassPattern = /class\s+(\w+)/g;
        const oldClasses = [...oldCode.matchAll(newClassPattern)].map(m => m[1]);
        const newClasses = [...newCode.matchAll(newClassPattern)].map(m => m[1]);
        
        const addedClasses = newClasses.filter(cls => !oldClasses.includes(cls));
        addedClasses.forEach(cls => {
            features.push(`Added ${cls} system`);
        });

        // Detect new methods/functions
        const methodPattern = /(?:public|private|protected)?\s*(\w+)\s*\([^)]*\)\s*{/g;
        const oldMethods = [...oldCode.matchAll(methodPattern)].map(m => m[1]);
        const newMethods = [...newCode.matchAll(methodPattern)].map(m => m[1]);
        
        const addedMethods = newMethods.filter(method => !oldMethods.includes(method));
        if (addedMethods.length > 0) {
            features.push(`Added new functionality: ${addedMethods.join(', ')}`);
        }

        return features;
    }

    private detectModifications(oldCode: string, newCode: string): string[] {
        const modifications: string[] = [];
        
        // Detect modified functions
        const functionPattern = /function\s+(\w+)|(\w+)\s*\([^)]*\)\s*{/g;
        const oldFunctions = [...oldCode.matchAll(functionPattern)].map(m => m[1] || m[2]);
        const newFunctions = [...newCode.matchAll(functionPattern)].map(m => m[1] || m[2]);
        
        const modifiedFunctions = oldFunctions.filter(fn => 
            newFunctions.includes(fn) && 
            this.getFunctionBody(oldCode, fn) !== this.getFunctionBody(newCode, fn)
        );

        if (modifiedFunctions.length > 0) {
            modifications.push(`Improved ${modifiedFunctions.join(', ')} functionality`);
        }

        return modifications;
    }

    private getFunctionBody(code: string, functionName: string): string {
        const regex = new RegExp(`${functionName}\\s*\\([^)]*\\)\\s*{([^}]*)}`, 'g');
        const match = regex.exec(code);
        return match ? match[1] : '';
    }

    private hasBugFixes(oldCode: string, newCode: string): boolean {
        // Look for common bug fix indicators
        const bugFixPatterns = [
            /fix(ed)?/i,
            /bug/i,
            /issue/i,
            /error/i,
            /crash/i
        ];
        
        const diff = this.getDiff(oldCode, newCode);
        return bugFixPatterns.some(pattern => pattern.test(diff));
    }

    private hasPerformanceImprovements(oldCode: string, newCode: string): boolean {
        // Look for performance-related changes
        const perfPatterns = [
            /performance/i,
            /optimize(d)?/i,
            /improv(ed?|ement)/i,
            /faster/i,
            /speed/i
        ];
        
        const diff = this.getDiff(oldCode, newCode);
        return perfPatterns.some(pattern => pattern.test(diff));
    }

    private getDiff(oldCode: string, newCode: string): string {
        // Simple diff implementation
        const oldLines = oldCode.split('\n');
        const newLines = newCode.split('\n');
        const diffLines = newLines.filter(line => !oldLines.includes(line));
        return diffLines.join('\n');
    }

    private hasNewFeatures(oldCode: string, newCode: string): boolean {
        // Check for new class/function definitions
        const newClassPattern = /class\s+(\w+)/g;
        const oldClasses = [...oldCode.matchAll(newClassPattern)].map(m => m[1]);
        const newClasses = [...newCode.matchAll(newClassPattern)].map(m => m[1]);
        
        // Check for new methods
        const methodPattern = /(?:public|private|protected)?\s*(\w+)\s*\([^)]*\)\s*{/g;
        const oldMethods = [...oldCode.matchAll(methodPattern)].map(m => m[1]);
        const newMethods = [...newCode.matchAll(methodPattern)].map(m => m[1]);
        
        return newClasses.some(cls => !oldClasses.includes(cls)) ||
               newMethods.some(method => !oldMethods.includes(method));
    }

    private hasModifications(oldCode: string, newCode: string): boolean {
        // Check for modified functions/methods
        const functionPattern = /function\s+(\w+)|(\w+)\s*\([^)]*\)\s*{/g;
        const oldFunctions = [...oldCode.matchAll(functionPattern)].map(m => m[1] || m[2]);
        const newFunctions = [...newCode.matchAll(functionPattern)].map(m => m[1] || m[2]);
        
        // Check if any existing functions have been modified
        return oldFunctions.some(fn => 
            newFunctions.includes(fn) && 
            this.getFunctionBody(oldCode, fn) !== this.getFunctionBody(newCode, fn)
        );
    }

    public async updateChangelog(oldCode: string, newCode: string): Promise<void> {
        try {
            const version = this.getPackageVersion();
            const changelog = this.getChangelog();
            
            // Check if version already exists
            if (changelog.some(entry => entry.version === version)) {
                mainLogger.warn(`Changelog entry for version ${version} already exists`);
                return;
            }

            const changes = this.generateChanges(oldCode, newCode);
            if (changes.length === 0) {
                mainLogger.info('No significant changes detected');
                return;
            }

            // Add any additional common changes
            changes.push("Various code improvements and optimizations");

            const newEntry: ChangelogEntry = {
                version,
                date: new Date().toISOString().split('T')[0],
                changes: changes.filter(change => change.trim() !== '')
            };

            changelog.unshift(newEntry);
            this.saveChangelog(changelog);
            mainLogger.info(`Updated changelog for version ${version}`);
            mainLogger.info('Changes detected:', changes);

        } catch (error) {
            mainLogger.error('Error updating changelog:', error);
            throw error;
        }
    }

    public getCurrentVersion(): string {
        return this.getPackageVersion();
    }
} 