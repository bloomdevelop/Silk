import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { mainLogger } from '../utils/Logger.js';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ChangelogEntry {
    version: string;
    date: string;
    changes: string[];
}

export class VersionManager {
    private static instance: VersionManager | null = null;
    readonly packageJsonPath: string;
    private genAI: GoogleGenerativeAI;
    private changelogData: ChangelogEntry[] = [];
    private initialized = false;

    private constructor() {
        this.packageJsonPath = join(__dirname, '../../package.json');
        this.genAI = new GoogleGenerativeAI(
            process.env.GEMINI_API_KEY || '',
        );
    }

    private async initializeChangelog(): Promise<void> {
        if (this.initialized) return;

        const version = this.getPackageVersion();
        const changes = await this.getGitChanges();

        const initialEntry: ChangelogEntry = {
            version,
            date: new Date().toISOString().split('T')[0],
            changes: changes.length ? changes : ['Initial release'],
        };

        this.changelogData = [initialEntry];
        this.initialized = true;
    }

    public static async getInstance(): Promise<VersionManager> {
        if (!VersionManager.instance) {
            VersionManager.instance = new VersionManager();
            await VersionManager.instance.initializeChangelog();
        }
        return VersionManager.instance;
    }

    private async getGitChanges(): Promise<string[]> {
        try {
            // Get the latest commit message
            const latestCommit = execSync('git log -1 --pretty=%B')
                .toString()
                .trim();
            mainLogger.debug('Latest commit:', latestCommit);

            // Check for version bump pattern
            const versionBumpMatch = latestCommit.match(
                /chore: bump version (\d+\.\d+\.\d+)/,
            );

            if (versionBumpMatch) {
                const version = versionBumpMatch[1];
                mainLogger.debug(
                    `Detected version bump to ${version}`,
                );

                // Find the previous version bump commit
                const lastVersionBumpCommand =
                    "git log --grep='chore: bump version' -2 --format=%H";
                const commits = execSync(lastVersionBumpCommand)
                    .toString()
                    .trim()
                    .split('\n');

                let commitMessages: string[] = [];
                if (commits.length > 1) {
                    // Get changes between the previous version bump and this one
                    commitMessages = execSync(
                        `git log --pretty=format:"%s" ${commits[1]}..${commits[0]}^`,
                    )
                        .toString()
                        .trim()
                        .split('\n');
                } else {
                    // Get all commits up to this version bump
                    commitMessages = execSync(
                        'git log --pretty=format:"%s" HEAD^',
                    )
                        .toString()
                        .trim()
                        .split('\n');
                }

                // Filter out version bump commits and empty messages
                commitMessages = commitMessages
                    .filter(
                        (msg) =>
                            !msg.includes('chore: bump version') &&
                            msg.trim().length > 0,
                    )
                    .slice(0, 10); // Limit to 10 most recent commits

                mainLogger.debug(
                    'Filtered commit messages:',
                    commitMessages,
                );

                // Get changed files and diff
                const changedFiles = execSync(
                    commits.length > 1
                        ? `git diff --name-only ${commits[1]} ${commits[0]}^`
                        : 'git diff --name-only HEAD^',
                )
                    .toString()
                    .trim()
                    .split('\n');

                const diff = execSync(
                    commits.length > 1
                        ? `git diff ${commits[1]} ${commits[0]}^`
                        : 'git diff HEAD^',
                ).toString();

                const fullContext = `
                    Version: ${version}
                    
                    Commit Messages:
                    ${commitMessages.join('\n')}
                    
                    Changed Files:
                    ${changedFiles.join('\n')}
                    
                    Changes:
                    ${diff}
                `;

                mainLogger.debug(
                    'Sending to Gemini for version bump analysis',
                );
                const changes = await this.generateChangesWithGemini(
                    commitMessages.join('\n'),
                    fullContext,
                );

                // Limit to 6 most significant changes
                return changes.slice(0, 6);
            }
            // Regular commit handling (unchanged)
            mainLogger.debug('Regular commit detected');
            const changedFiles = execSync(
                'git diff-tree --no-commit-id --name-only -r HEAD',
            )
                .toString()
                .trim()
                .split('\n');

            const diff = execSync('git diff HEAD^!').toString();

            const fullContext = `
                    Commit Message: ${latestCommit}
                    
                    Changed Files:
                    ${changedFiles.join('\n')}
                    
                    Changes:
                    ${diff}
                `;

            const changes = await this.generateChangesWithGemini(
                latestCommit,
                fullContext,
            );

            return changes.slice(0, 6); // Limit regular changes to 6 as well
        } catch (error) {
            mainLogger.error('Error getting git changes:', error);
            return ['Code updates and improvements'];
        }
    }

    private getPackageVersion(): string {
        try {
            const packageJson = JSON.parse(
                readFileSync(this.packageJsonPath, 'utf-8'),
            );
            return packageJson.version;
        } catch (error) {
            mainLogger.error('Error reading package.json:', error);
            throw error;
        }
    }

    public async getChangelog(): Promise<ChangelogEntry[]> {
        if (!this.initialized) {
            await this.initializeChangelog();
        }
        return this.changelogData;
    }

    private async generateChangesWithGemini(
        commitMessages: string,
        fullContext: string,
    ): Promise<string[]> {
        try {
            mainLogger.debug('Generating changelog with Gemini');
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-1.5-pro',
            });

            const prompt = `
            Generate a changelog from these git commits. Format your response as a simple list.
            Each change must start with a hyphen (-) and be on a new line. Also try to be concise and accurate.
            
            Focus on:
            - New features
            - Bug fixes
            - Improvements
            - Breaking changes

            Example format:
            - Added new feature X
            - Fixed bug with Y
            - Removed feature Z
            - Improved performance of W
            
            Commit Messages:
            ${commitMessages}
            
            Additional Context:
            ${fullContext}
            `;

            mainLogger.debug('Sending prompt to Gemini');
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            mainLogger.debug('Raw Gemini response:', text);

            // First, split into lines and process each line
            const changes = text
                .split('\n')
                .map((line) => {
                    // Convert any bullet point style to a hyphen
                    const processedLine = line.replace(/^[•*]\s*/, '- ');
                    return processedLine.trim();
                })
                .filter((line) => line.startsWith('-')) // Keep only bullet points
                .map((line) => {
                    // Clean up the line
                    return line
                        .replace(/^-\s*/, '') // Remove the bullet point
                        .replace(/^["']|["']$/g, '') // Remove quotes
                        .replace(/\*\*/g, '') // Remove bold markers
                        .trim();
                })
                .filter((line) => {
                    return (
                        line.length > 0 &&
                        !line.toLowerCase().includes('changelog:') &&
                        !line.match(/^v\d+\.\d+\.\d+/) && // Filter version headers
                        !line.match(/^[A-Z]+:$/)
                    ); // Filter section headers
                });

            mainLogger.debug('Processed changes array:', changes);

            if (changes.length === 0) {
                mainLogger.warn(
                    'No changes extracted from Gemini response, using default message',
                );
                return [
                    'Various code improvements and optimizations',
                ];
            }

            // Limit to 6 most significant changes
            return changes.slice(0, 6);
        } catch (error) {
            mainLogger.error(
                'Error generating changes with Gemini:',
                error,
            );
            return ['Code updates and improvements'];
        }
    }

    public async updateChangelog(): Promise<void> {
        try {
            const version = this.getPackageVersion();

            if (
                this.changelogData.some(
                    (entry) => entry.version === version,
                )
            ) {
                mainLogger.warn(
                    `Changelog entry for version ${version} already exists`,
                );
                return;
            }

            const changes = await this.getGitChanges();

            const newEntry: ChangelogEntry = {
                version,
                date: new Date().toISOString().split('T')[0],
                changes,
            };

            this.changelogData.unshift(newEntry);
            mainLogger.info(
                `Updated changelog for version ${version}`,
            );
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
