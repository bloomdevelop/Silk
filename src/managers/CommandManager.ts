import { Client, Message } from "revolt.js"
import { ICommand } from "../types"
import { commandLogger } from "../utils"
import { Logger as TsLogger, ILogObj} from "tslog";
import fs from "node:fs/promises"
import path from "node:path"

export class CommandManager {
    readonly client: Client
    readonly commands: Map<string, ICommand>
    private logger: TsLogger<ILogObj>

    constructor(client: Client) {
        this.client = client
        this.commands = new Map()
        this.logger = commandLogger
    }

    async loadCommands() {
        this.logger.info("Loading commands...")
        const categories = await fs.readdir("./dist/commands")

        for (const category of categories) {
            const categoryPath = path.join("./dist/commands", category)
            const stats = await fs.stat(categoryPath)

            if (!stats.isDirectory()) continue

            this.logger.info(`Loading category: ${category}`)
            const files = await fs.readdir(`./dist/commands/${category}`)

            for (const file of files.filter(f => f.endsWith('.js'))) {
                const loadTime = Date.now()
                const commandPath = path.resolve(`./dist/commands/${category}/${file}`)
                const commandModule = require(commandPath)
                console.log("Loaded module:", commandModule) // Debug what we're getting

                if (!commandModule || !commandModule.name) {
                    this.logger.warn(`Invalid command module in ${file}`)
                    continue
                }

                this.commands.set(commandModule.name, commandModule)
                this.logger.info(`Loaded: ${commandModule.name} (${Date.now() - loadTime}ms)`)
            }
        }

        this.logger.info(`Successfully loaded ${this.commands.size} commands`)
    }

    async executeCommand(message: Message, prefix: string) {
        console.log("Raw message:", message.content)
        console.log("Prefix:", prefix)
        const args = message.content.slice(prefix.length).trim().split(/ +/)
        console.log("Parsed args:", args)
        const commandName = args.shift()?.toLowerCase()
        console.log("Command name:", commandName)

        if (!commandName) return

        const command = this.findCommand(commandName)

        if (!command) {
            this.logger.warn(`Command not found: ${commandName}`)
            return
        }

        try {
            this.logger.info(`Executing ${command.name}`)
            await command.execute(message, args, this.client)
        } catch (error) {
            this.logger.error(`Error executing ${command.name}:`, error)
            throw error
        }
    }

    private findCommand(name: string): ICommand | undefined {
        return [...this.commands.values()].find(cmd =>
            cmd.name === name || cmd.aliases?.includes(name)
        )
    }

    getCommands(): Map<string, ICommand> {
        return this.commands
    }
}