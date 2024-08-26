import puppeteer from "puppeteer"
import { ulid } from "ulid"

class PuppeteerPage {
	/**
	 * Create a new PuppeteerPage class
	 *
	 * @constructor
	 * @param {string} tabOwner - User who owns this tab
	 * @param {import("puppeteer").Page} page - Puppeteer Page
	 */
	constructor(tabOwner, page) {
		this.owner = tabOwner
		this._page = page

		// Default to a 1920x1080 viewport
		// idk if this is efficient

		this._page.setViewport({ width: 1920, height: 1080 })
	}       

	async findElementFromText(text) {
		// TODO
	}

	async navigateTo(location) {
		await this._page.goto(location)
	}

	/**
	 * Takes a screenshot of the current viewport, returns the screenshot in JPEG format
	 * @returns {Promise<Blob>}
	 */
	async takeScreenshot() {
		const screenshot = await this._page.screenshot({
			quality: 50,
			type: "jpeg"
		})


		const image = new Blob([screenshot], {
			type: "image/jpeg",
		})

		return image
	}
}

class PuppeteerInstance {
	/**
	 * ID of the server that this instance belongs to.
	 * @private
	 * @type {string}
	 */
	owner

	/**
	 * @private
	 * @type {import("puppeteer"}.Browser}
	 */
	browser

	/** @type {PuppeteerPage[]}*/
	tabs

	constructor(id, browser) {
		this.owner = id
		this.browser = browser
		this.tabs = []
	}


	getTab(uid) {
		return this.tabs.find(tab => tab.owner === uid)
	}


	closeTab(id) {
		this.tabs = this.tabs.filter(tab => tab.id !== id)
	}

	async newTab(owner) {
		if (this.tabs.find(tab => tab.owner === owner)) throw new Error("User can only have one tab open at a time.")

		const page = new PuppeteerPage(owner, await this.browser.newPage())
		this.tabs.push(page)

		return page
	}
	
	get tabs() {
		return Object.freeze(this.tabs)
	}	
}

class PuppeteerController {
	/**
	 * @private
	 * @type {PuppeteerInstance[]}
	 */
	_instances = [];

	constructor() {
		this._instances = []
	}

	/**
	 * @param {string} owner - Server ID
	 * @returns {Promise<PuppeteerInstance>}
	 */
	async createInstance(
		owner
	) {
		if (!owner) throw new Error("Missing owner parameter!")
		const browser = await puppeteer.launch()
		const instance = new PuppeteerInstance(owner, browser)
		this._instances.push(instance)
		return instance
	}

	/**
	 * @param {string} id
	 */
	destroyInstance(id) {
		this._instances = this._instances.filter(i => i.id !== id)

	}

	/**
	 * @param {string} id
	 * @returns [NavigatorInstance]
	 **/
	getInstance(id) {
		return this._instances.find(i => i.owner === id)
	}
}


export { PuppeteerController }