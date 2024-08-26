export class AutumnService {
	/**
	 * Upload a Blob or a buffer to autumn
	 * @param {string} tag - Bucket name
	 * @param {Blob} file - File or File Contents as buffer
	 * @return {Promise<string>}
	 **/
	static async uploadFile(tag, file) {
		const formData = new FormData();

		console.log(file)

		formData.append("file", file, "puppeteerScreenshot.jpeg")

		const response = await fetch("https://autumn.revolt.chat/" + tag, {
			method: "POST",
			body: formData
		})

		const json = await response.json()

		console.log(json)

		return json.id
	}
}