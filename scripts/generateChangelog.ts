import { execSync } from 'child_process';
import { VersionManager } from '../src/managers/VersionManager.js';

async function main() {
    // Get staged files diff
    const diff = execSync('git diff --cached').toString();
    
    // Get the previous version of the files
    const oldCode = execSync('git show HEAD:./src').toString();
    
    // Get the current version
    const newCode = execSync('git show ./src').toString();
    
    // Generate changelog
    const versionManager = VersionManager.getInstance();
    await versionManager.updateChangelog(oldCode, newCode);
    
    // Add the changelog to the commit
    execSync('git add CHANGELOG.md');
}

main().catch(console.error); 