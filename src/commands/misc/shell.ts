import { ICommand } from "../../types.js";
import { spawnSync, SpawnSyncOptions } from "node:child_process";
import { commandLogger } from "../../utils/Logger.js";

const MAX_OUTPUT_LENGTH = 1900; // Maximum length for message content
const TIMEOUT = 30000; // 30 second timeout

const sanitizeOutput = (output: string): string => {
    if (!output) return "";
    
    return output
        .replace(/`/g, '\\`')     // Escape backticks
        .replace(/\\/g, '\\\\')   // Escape backslashes
        .replace(/\*/g, '\\*')    // Escape asterisks
        .replace(/_/g, '\\_')     // Escape underscores
        .replace(/~/g, '\\~')     // Escape tildes
        .replace(/@/g, '@\u200b') // Break mentions
        .substring(0, MAX_OUTPUT_LENGTH);
};

const formatOutput = (stdout: string, stderr: string, error?: Error): string => {
    const parts: string[] = [];
    
    if (stdout?.trim()) {
        parts.push("**Output:**", "```ansi", sanitizeOutput(stdout), "```");
    }
    
    if (stderr?.trim()) {
        parts.push("**Error:**", "```ansi", sanitizeOutput(stderr), "```");
    }
    
    if (error) {
        parts.push("**System Error:**", "```", sanitizeOutput(error.message), "```");
    }
    
    return parts.join("\n") || "No output";
};

const shell: ICommand = {
    name: "shell",
    description: "Executes shell commands based on the host OS.\n\n**⚠️ WARNING:** This command can execute arbitrary system commands and should only be used by bot owners. Use with extreme caution.",
    usage: "shell <command>",
    category: "System",
    aliases: ["sh", "bash", "cmd"],
    flags: {
        ownerOnly: true,
        dangerous: true
    },

    async execute(msg, args) {
        if (!args?.length) {
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Please provide a command to run",
                    colour: "#ff0000"
                }]
            });
        }

        const command = args.join(" ");
        commandLogger.info(`Executing shell command: ${command}`);

        try {
            // Configure spawn options
            const options: SpawnSyncOptions = {
                shell: true,
                timeout: TIMEOUT,
                encoding: 'utf8',
                maxBuffer: 1024 * 1024 * 2, // 2MB buffer
                windowsHide: true
            };

            // Execute command
            const result = spawnSync(command, options);

            // Handle different types of results
            if (result.error) {
                throw result.error;
            }

            const stdout = result.stdout?.toString() || "";
            const stderr = result.stderr?.toString() || "";
            const exitCode = result.status;

            // Format the output
            const formattedOutput = formatOutput(stdout, stderr);
            const statusColor = exitCode === 0 ? "#00ff00" : "#ff0000";
            const statusText = exitCode === 0 ? "Success" : "Failed";

            return msg.reply({
                embeds: [{
                    title: `Shell Command ${statusText}`,
                    description: [
                        `**Command:** \`${sanitizeOutput(command)}\``,
                        `**Exit Code:** ${exitCode}`,
                        "",
                        formattedOutput
                    ].join("\n"),
                    colour: statusColor
                }]
            });

        } catch (error) {
            commandLogger.error("Shell command error:", error);

            return msg.reply({
                embeds: [{
                    title: "Shell Command Error",
                    description: [
                        `**Command:** \`${sanitizeOutput(command)}\``,
                        "",
                        "**Error:**",
                        "```",
                        sanitizeOutput(error instanceof Error ? error.message : "Unknown error occurred"),
                        "```"
                    ].join("\n"),
                    colour: "#ff0000"
                }]
            });
        }
    }
};

export default shell;
