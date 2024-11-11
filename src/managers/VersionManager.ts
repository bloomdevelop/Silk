import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { mainLogger } from "../utils/Logger.js";
import { execSync } from "child_process";

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

    private constructor() {
        this.packageJsonPath = join(__dirname, "../../package.json");
        this.genAI = new GoogleGenerativeAI(
            process.env.GEMINI_API_KEY || "",
        );

        // Initialize with current version and git changes
        this.initializeChangelog();
    }

    private async initializeChangelog(): Promise<void> {
        const version = this.getPackageVersion();
        const changes = await this.getGitChanges();

        const initialEntry: ChangelogEntry = {
            version,
            date: new Date().toISOString().split("T")[0],
            changes: changes.length ? changes : ["Initial release"],
        };

        this.changelogData = [initialEntry];
    }

    private async getGitChanges(): Promise<string[]> {
        try {
            // Get latest commit message
            const latestCommit = execSync("git log -1 --pretty=%B")
                .toString()
                .trim();

            // Get changed files and their diffs
            const changedFiles = execSync(
                "git diff-tree --no-commit-id --name-only -r HEAD",
            )
                .toString()
                .trim()
                .split("\n");

            // Get complete diff for analysis
            const diff = execSync("git diff HEAD^!").toString();

            // Include changed files in the analysis
            const fullContext = `
                Commit Message: ${latestCommit}
                
                Changed Files:
                ${changedFiles.join("\n")}
                
                Changes:
                ${diff}
            `;

            return await this.generateChangesWithGemini(
                latestCommit,
                fullContext,
            );
        } catch (error) {
            mainLogger.error("Error getting git changes:", error);
            return ["Code updates and improvements"];
        }
    }
    public static getInstance(): VersionManager {
        if (!VersionManager.instance) {
            VersionManager.instance = new VersionManager();
        }
        return VersionManager.instance;
    }

    private getPackageVersion(): string {
        try {
            const packageJson = JSON.parse(
                readFileSync(this.packageJsonPath, "utf-8"),
            );
            return packageJson.version;
        } catch (error) {
            mainLogger.error("Error reading package.json:", error);
            throw error;
        }
    }

    public getChangelog(): ChangelogEntry[] {
        return this.changelogData;
    }

    private async generateChangesWithGemini(
        oldCode: string,
        newCode: string,
    ): Promise<string[]> {
        try {
            const model = this.genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
            });

            const prompt = `
            Analyze the following code changes and generate a clear, concise changelog.
            Focus on significant changes like new features, improvements, and fixes.
            Format each change as a bullet point.
            
            Old code:
            ${oldCode}
            
            New code:
            ${newCode}
            `;

            const result = await model.generateContent(prompt);
            const response = result.response;
            const changes = response
                .text()
                .split("\n")
                .filter(
                    (line) =>
                        line.trim().startsWith("•") ||
                        line.trim().startsWith("-"),
                )
                .map((line) => line.replace(/^[•-]\s*/, "").trim())
                .filter((line) => line.length > 0);

            return changes.length > 0
                ? changes
                : ["Various code improvements and optimizations"];
        } catch (error) {
            mainLogger.error(
                "Error generating changes with Gemini:",
                error,
            );
            return ["Code updates and improvements"];
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
                date: new Date().toISOString().split("T")[0],
                changes,
            };

            this.changelogData.unshift(newEntry);
            mainLogger.info(
                `Updated changelog for version ${version}`,
            );
            mainLogger.info("Changes detected:", changes);
        } catch (error) {
            mainLogger.error("Error updating changelog:", error);
            throw error;
        }
    }

    public getCurrentVersion(): string {
        return this.getPackageVersion();
    }
}
