import { Client, Message } from "revolt.js";
import { ConfigService } from "./services/ConfigService";
import { CommandManager } from "./managers/CommandManager";
import { EventManager } from "./managers/EventManager";
import { mainLogger } from "./utils";
import { ILogObj, Logger as TsLogger } from "tslog";

export class Bot {
    readonly client: Client;
    private commandManager: CommandManager;
    private eventManager: EventManager;
    private config: ConfigService;
    private logger: TsLogger<ILogObj>;

    constructor() {
        this.client = new Client();
        this.config = new ConfigService();
        this.logger = mainLogger;
        this.commandManager = new CommandManager(this.client);
        this.eventManager = new EventManager(this.client);
    }

    async start() {
        try {
            await this.validateConfig();
            await this.commandManager.loadCommands();

            // Register custom events
            this.eventManager.registerEvent('messageCreate', this.handleMessage.bind(this));
            this.eventManager.registerEvent('serverCreate', this.handleServerJoin.bind(this));
            this.eventManager.registerEvent('serverDelete', this.handleServerLeave.bind(this));

            await this.client.loginBot(this.config.getToken());
            this.logger.info('Bot started successfully');
        } catch (error) {
            this.logger.error('Failed to start bot:', error);
            process.exit(1);
        }
    }

    private async validateConfig() {
        if (!this.config.isValid()) {
            throw new Error("Invalid configuration");
        }
    }

    private async handleMessage(message: Message) {
        // Handle message events with CommandManager
        if (message.content?.startsWith(this.config.getPrefix())) {
            await this.commandManager.executeCommand(message, this.config.getPrefix());
        }
    }

    private async handleServerJoin(server: any) {
        this.logger.info(`Joined new server: ${server.name}`);
    }

    private async handleServerLeave(server: any) {
        this.logger.info(`Left server: ${server.name}`);
    }
}