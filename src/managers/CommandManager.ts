import { Client, Message } from "revolt.js"
import { ICommand } from "../types.js"
import { commandLogger } from "../utils/Logger.js"
import { Logger as TsLogger, ILogObj} from "tslog";
import fs from "node:fs/promises"
import path from "node:path"
import { RateLimitManager } from "./RateLimitManager.js";

export class CommandManager {
    readonly client: Client
    readonly commands: Map<string, ICommand>
    private logger: TsLogger<ILogObj>
    private rateLimitManager: RateLimitManager;

    constructor(client: Client) {
        this.client = client
        this.commands = new Map()
        this.logger = commandLogger
        this.rateLimitManager = RateLimitManager.getInstance();
    }

    async loadCommands() {
        this.logger.info("Loading commands...");
        const commandsPath = path.join(process.cwd(), 'dist', 'commands')
        const categories = await fs.readdir(commandsPath);

        for (const category of categories) {
            const categoryPath = path.join(commandsPath, category);
            const stats = await fs.stat(categoryPath);

            if (!stats.isDirectory())
                continue;

            this.logger.info(`Loading category: ${category}`);
            const files = await fs.readdir(categoryPath);

            for (const file of files.filter(f => f.endsWith('.js'))) {
                const loadTime = Date.now();
                const commandPath = path.resolve(categoryPath, file);
                const { default: commandModule } = await import(commandPath);

                if (!commandModule || !commandModule.name) {
                    this.logger.warn(`Invalid command module in ${file}`);
                    continue;
                }
                this.commands.set(commandModule.name, commandModule);
                this.logger.info(`Loaded: ${commandModule.name} (${Date.now() - loadTime}ms)`);
            }
        }

        this.logger.info(`Successfully loaded ${this.commands.size} commands`);
    }

    async executeCommand(message: Message, prefix: string) {
        if (!message.content) return

        // Use a more efficient string splitting approach
        const content = message.content.slice(prefix.length).trim()
        if (!content) return

        // Split args only once and store in const
        const [commandName, ...args] = content.split(/ +/g)

        if (!commandName) return

        const command = this.findCommand(commandName.toLowerCase())

        if (!command) {
            this.logger.warn(`Command not found: ${commandName}`)
            await message.reply({
                embeds: [{
                    title: "Command Not Found",
                    description: [
                        `The command \`${commandName}\` does not exist.`,
                        `Use \`${prefix}help\` to see all available commands.`
                    ].join('\n'),
                    colour: "#ff0000"
                }]
            })
            return
        }

        // Check rate limit
        if (command.rateLimit) {
            const userId = message.author?.id;
            if (!userId) return;

            if (this.rateLimitManager.isRateLimited(userId, command.rateLimit)) {
                const remainingTime = Math.ceil(
                    this.rateLimitManager.getRemainingTime(userId, command.rateLimit) / 1000
                );
                
                return message.reply({
                    embeds: [{
                        title: "Rate Limited",
                        description: [
                            "You are being rate limited!",
                            `Please wait ${remainingTime} seconds before using this command again.`,
                            "",
                            `**Limit**: ${command.rateLimit.usages} uses per ${command.rateLimit.duration / 1000}s`
                        ].join("\n"),
                        colour: "#ff0000"
                    }]
                });
            }
        }

        try {
            this.logger.info(`Executing ${command.name} with ${args.length} ([${args}]) arguments`)
            // Pass the pre-split args array
            await command.execute(message, args, this.client)
        } catch (error) {
            this.logger.error(`Error executing ${command.name}:`, error)
            throw error
        }
    }

    // Optimize command lookup
    private findCommand(name: string): ICommand | undefined {
        const command = this.commands.get(name)
        if (command) return command

        // Only search aliases if direct lookup fails
        return [...this.commands.values()].find(cmd => cmd.aliases?.includes(name))
    }

    getCommands(): Map<string, ICommand> {
        return this.commands
    }
}