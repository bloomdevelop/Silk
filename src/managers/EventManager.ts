import { Client, Message } from "revolt.js"
import { Logger } from "../utils/Logger.js"
import { ILogObj, Logger as TsLogger } from "tslog";

type EventHandler = (...args: any[]) => Promise<void> | void

export class EventManager {
    private client: Client
    private logger: TsLogger<ILogObj>
    readonly events: Map<string, EventHandler>

    constructor(client: Client) {
        this.client = client
        this.logger = Logger.getInstance().createLogger("EventManager");
        this.events = new Map()
        this.registerDefaultEvents()
    }

    private registerDefaultEvents() {
        this.registerEvent('ready', this.handleReady.bind(this))
        this.registerEvent('messageCreate', this.handleMessage.bind(this))
        this.registerEvent('error', this.handleError.bind(this))
        this.registerEvent('channelCreate', this.handleChannelCreate.bind(this))
        this.registerEvent('channelDelete', this.handleChannelDelete.bind(this))
    }

    registerEvent(eventName: string, handler: EventHandler) {
        this.events.set(eventName, handler)
        // @ts-expect-error - It requires to have keyof Events but it wasn't exported.
        this.client.on(eventName, handler)
        this.logger.info(`Registered event: ${eventName}`)
    }

    private async handleReady() {
        this.logger.info('Client ready!')
    }

    private async handleMessage(message: Message) {
        try {
            // Ensure channel exists and is accessible
            if (!message.channel) {
                this.logger.warn('Message received without valid channel')
                return
            }

            // Log message details with channel information
            this.logger.debug(
                `Message received in channel #${message.channel.name} (${message.channel.id}) ` +
                `from ${message.author?.displayName} (@${message.author?.username}#${message.author?.discriminator}): ${message.content}`
            )
        } catch (error) {
            this.logger.error('Error handling message:', error)
        }
    }

    private async handleChannelCreate(channel: any) {
        try {
            this.logger.info(`New channel created: #${channel.name} (${channel.id})`)
            // You could add additional channel setup logic here if needed
        } catch (error) {
            this.logger.error('Error handling channel creation:', error)
        }
    }

    private async handleChannelDelete(channel: any) {
        try {
            this.logger.info(`Channel deleted: #${channel.name} (${channel.id})`)
            // Cleanup any channel-specific resources if needed
        } catch (error) {
            this.logger.error('Error handling channel deletion:', error)
        }
    }

    private handleError(error: Error) {
        this.logger.error('Client error:', error)
    }

    // Method to clean up event listeners
    cleanup() {
        for (const [event, handler] of this.events) {
            // @ts-expect-error - It requires to have keyof Events but it wasn't exported.
            this.client.removeListener(event, handler)
        }
        this.events.clear()
        this.logger.info('Event handlers cleaned up')
    }
}