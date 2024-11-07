import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { mainLogger } from '../utils/Logger.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class VersionManager {
    private static instance: VersionManager;
    private changelogPath: string;
    private currentVersion: string;
    private genAI: GoogleGenerativeAI;

    private constructor() {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        this.changelogPath = path.join(__dirname, '../../CHANGELOG.md');
        this.currentVersion = process.env.npm_package_version || '0.0.0';
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    }

    static getInstance(): VersionManager {
        if (!this.instance) {
            this.instance = new VersionManager();
        }
        return this.instance;
    }

    async generateChangelogFromDiff(oldCode: string, newCode: string): Promise<string> {
        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

            const prompt = `
            Analyze these code changes and generate a changelog entry in the following format:
            ### Added
            - New features or additions
            
            ### Changed
            - Changes in existing functionality
            
            ### Fixed
            - Bug fixes
            
            ### Security
            - Security-related changes
            
            Old code:
            ${oldCode}
            
            New code:
            ${newCode}
            
            Please be specific but concise. Focus on user-facing changes.`;

            const result = await model.generateContent(prompt);
            const changelog = result.response.text();
            
            mainLogger.info('Generated changelog using Gemini');
            return changelog;

        } catch (error) {
            mainLogger.error('Failed to generate changelog with Gemini:', error);
            throw error;
        }
    }

    async updateChangelog(oldCode: string, newCode: string): Promise<void> {
        try {
            const today = new Date().toISOString().split('T')[0];
            const generatedChanges = await this.generateChangelogFromDiff(oldCode, newCode);

            let changelog = '';
            try {
                changelog = await fs.readFile(this.changelogPath, 'utf-8');
            } catch {
                changelog = '# Changelog\n\n';
            }

            const versionEntry = `## [${this.currentVersion}] - ${today}\n${generatedChanges}\n`;

            const updatedChangelog = changelog.replace(
                '# Changelog\n\n',
                `# Changelog\n\n${versionEntry}`
            );

            await fs.writeFile(this.changelogPath, updatedChangelog, 'utf-8');
            mainLogger.info(`Changelog updated for version ${this.currentVersion}`);

        } catch (error) {
            mainLogger.error('Failed to update changelog:', error);
            throw error;
        }
    }
} 