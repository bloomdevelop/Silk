import { execSync } from 'child_process';
import { VersionManager } from '../src/managers/VersionManager.js';
import { mainLogger } from '../src/utils/Logger.js';

async function main() {
    try {
        // Get staged files diff
        const stagedFiles = execSync('git diff --cached --name-only').toString().split('\n');
        const srcFiles = stagedFiles.filter(file => file.startsWith('src/') && file.endsWith('.ts'));

        if (srcFiles.length === 0) {
            mainLogger.info('No source files changed');
            return;
        }

        // Get the previous version of the files
        const oldCode = srcFiles.map(file => {
            try {
                return execSync(`git show HEAD:${file}`).toString();
            } catch {
                return ''; // New file
            }
        }).join('\n');

        // Get the current version
        const newCode = srcFiles.map(file => {
            try {
                return execSync(`git show :${file}`).toString();
            } catch (error) {
                mainLogger.error(`Error reading current version of ${file}:`, error);
                return '';
            }
        }).join('\n');

        // Generate changelog
        const versionManager = VersionManager.getInstance();
        await versionManager.updateChangelog(oldCode, newCode);

        // Add the changelog to the commit if it was modified
        const changelogStatus = execSync('git status --porcelain changelog.json').toString();
        if (changelogStatus) {
            execSync('git add changelog.json');
            mainLogger.info('Added updated changelog to commit');
        }

    } catch (error) {
        mainLogger.error('Error generating changelog:', error);
        process.exit(1);
    }
}

// Add this to ensure the script runs after compilation
if (require.main === module) {
    main();
} 