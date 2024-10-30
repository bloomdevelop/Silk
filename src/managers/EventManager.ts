import { Client, Message } from "revolt.js"
import { Logger } from "../utils"
import { ILogObj, Logger as TsLogger } from "tslog";

type EventHandler = (...args: any[]) => Promise<void> | void

export class EventManager {
    private client: Client
    private logger: TsLogger<ILogObj>
    readonly events: Map<string, EventHandler>

    constructor(client: Client) {
        this.client = client
        this.logger = Logger.getInstance().createLogger("Event Manager");
        this.events = new Map()
        this.registerDefaultEvents()
    }

    private registerDefaultEvents() {
        this.registerEvent('ready', this.handleReady.bind(this))
        this.registerEvent('messageCreate', this.handleMessage.bind(this))
        this.registerEvent('error', this.handleError.bind(this))
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
        // Basic message handling logic
        this.logger.debug(`Message received: ${message.content}`)
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