import { ICommand } from "../../types.js";
import os from "node:os";
import { version as nodeVersion } from "node:process";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";

const formatUptime = (uptime: number): string => {
    const days = Math.floor(uptime / (24 * 60 * 60));
    const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((uptime % (60 * 60)) / 60);
    const seconds = Math.floor(uptime % 60);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

const formatMemory = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
};

const about: ICommand = {
    name: "about",
    description: "Displays information about the bot and its host environment",
    usage: "about",
    category: "Info",
    aliases: ["info", "botinfo", "stats"],
    
    async execute(message) {
        try {
            // Get package.json for version info
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const packagePath = path.join(__dirname, "../../../package.json");
            const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));

            // System information
            const systemInfo = {
                os: `${os.type()} ${os.release()} (${os.arch()})`,
                cpu: os.cpus()[0].model,
                cores: os.cpus().length,
                memory: {
                    total: formatMemory(os.totalmem()),
                    free: formatMemory(os.freemem()),
                    used: formatMemory(os.totalmem() - os.freemem())
                },
                uptime: formatUptime(os.uptime())
            };

            // Process information
            const processInfo = {
                nodeVersion: nodeVersion,
                uptime: formatUptime(process.uptime()),
                memory: formatMemory(process.memoryUsage().heapUsed)
            };

            // Format dependencies
            const dependencies = Object.entries(packageJson.dependencies || {})
                .map(([name, version]) => `**${name}**: ${version}`)
                .join('\n');

            const devDependencies = Object.entries(packageJson.devDependencies || {})
                .map(([name, version]) => `**${name}**: ${version}`)
                .join('\n');

            return message.reply({
                embeds: [{
                    title: "🤖 Bot Information",
                    description: [
                        "# System Information",
                        `**OS**: ${systemInfo.os}`,
                        `**CPU**: ${systemInfo.cpu}`,
                        `**Cores**: ${systemInfo.cores}`,
                        `**Memory**:`,
                        `• Total: ${systemInfo.memory.total}`,
                        `• Used: ${systemInfo.memory.used}`,
                        `• Free: ${systemInfo.memory.free}`,
                        `**System Uptime**: ${systemInfo.uptime}`,
                        "",
                        "# Bot Information",
                        `**Version**: ${packageJson.version}`,
                        `**Node.js**: ${processInfo.nodeVersion}`,
                        `**Uptime**: ${processInfo.uptime}`,
                        `**Memory Usage**: ${processInfo.memory}`,
                        `**Source**: [GitHub](${packageJson.repository?.url || "N/A"})`,
                        "",
                        "# Dependencies",
                        dependencies,
                        "",
                        "# Dev Dependencies",
                        devDependencies,
                        "",
                        "# Environment",
                        `**Platform**: ${process.platform}`,
                        `**Architecture**: ${process.arch}`,
                        `**PID**: ${process.pid}`,
                    ].join("\n"),
                    colour: "#00ff00"
                }]
            });
        } catch (error) {
            return message.reply({
                embeds: [{
                    title: "Error",
                    description: "Failed to fetch bot information",
                    colour: "#ff0000"
                }]
            });
        }
    }
};

export default about; 