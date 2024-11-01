import { Client, Message, Server } from "revolt.js";
import { ConfigService } from "./services/ConfigService.js";
import { CommandManager } from "./managers/CommandManager.js";
import { EventManager } from "./managers/EventManager.js";
import { mainLogger } from "./utils/Logger.js";
import { ILogObj, Logger as TsLogger } from "tslog";
import { DatabaseService } from "./services/DatabaseService.js";

export class Bot {
    readonly client: Client;
    private commandManager: CommandManager;
    private eventManager: EventManager;
    private config: ConfigService;
    private logger: TsLogger<ILogObj>;
    private database: DatabaseService;

    constructor() {
        this.client = new Client();
        this.config = new ConfigService();
        this.logger = mainLogger;
        this.database = DatabaseService.getInstance();
        this.commandManager = new CommandManager(this.client);
        this.eventManager = new EventManager(this.client);
    }

    async start() {
        try {
            await this.validateConfig();
            await this.commandManager.loadCommands();

            // Register all events
            this.eventManager.registerEvent('messageCreate', this.handleMessage.bind(this));
            this.eventManager.registerEvent('serverCreate', this.handleServerJoin.bind(this));
            this.eventManager.registerEvent('serverDelete', this.handleServerLeave.bind(this));
            this.eventManager.registerEvent('channelCreate', this.handleChannelCreate.bind(this));
            this.eventManager.registerEvent('channelDelete', this.handleChannelDelete.bind(this));
            this.eventManager.registerEvent('reconnect', this.handleReconnect.bind(this));

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
        if (!message.content || !message.channel) return;

        try {
            const serverConfig = await this.database.getServerConfig(message.server?.id);
            const prefix = serverConfig.bot.prefix;

            if (message.content.startsWith(prefix)) {
                await this.commandManager.executeCommand(message, prefix);
            }
        } catch (error) {
            this.logger.error('Error handling message:', error);
        }
    }

    private async handleReconnect() {
        this.logger.info('Client has been reconnected!');
    }

    private async handleServerJoin(server: Server) {
        this.logger.info(`Joined new server: ${server.name}`);
        await this.database.createDefaultConfig(server.id);
    }

    private async handleServerLeave(server: Server) {
        this.logger.info(`Left server: ${server.name}`);
    }

    private async handleChannelCreate(channel: any) {
        this.logger.info(`New channel available: #${channel.name}`);
        // You could add channel-specific initialization here
    }

    private async handleChannelDelete(channel: any) {
        this.logger.info(`Channel removed: #${channel.name}`);
        // You could add channel cleanup logic here
    }
}