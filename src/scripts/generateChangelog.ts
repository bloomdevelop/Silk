import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { VersionManager } from '../managers/VersionManager.js';
import { mainLogger } from '../utils/Logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function generateChangelog() {
    try {
        const versionManager = VersionManager.getInstance();
        
        // Read the current state of the codebase
        const srcPath = join(__dirname, '../../src');
        const oldCodePath = join(__dirname, '../../.changelog-temp/old-code.txt');
        
        let oldCode = '';
        try {
            oldCode = readFileSync(oldCodePath, 'utf-8');
        } catch (error) {
            mainLogger.warn('No previous code snapshot found. Creating first changelog entry.');
        }

        // Get current code state (you might want to adjust the pattern based on your needs)
        const newCode = readFileSync(srcPath + '/managers/VersionManager.ts', 'utf-8');
        
        // Update the changelog
        await versionManager.updateChangelog(oldCode, newCode);
        
        mainLogger.info('Changelog generated successfully!');
    } catch (error) {
        mainLogger.error('Error generating changelog:', error);
        process.exit(1);
    }
}

// Run the function directly instead of checking for main module
generateChangelog().catch(error => {
    mainLogger.error('Failed to generate changelog:', error);
    process.exit(1);
}); 