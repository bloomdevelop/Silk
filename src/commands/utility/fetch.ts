import { ICommand } from "../../types.js";
import { commandLogger } from "../../utils/Logger.js";

const isValidUrl = (urlString: string): boolean => {
    try {
        new URL(urlString);
        return true;
    } catch {
        return false;
    }
};

const formatJson = (data: any): string => {
    try {
        return JSON.stringify(data, null, 2);
    } catch (err) {
        return String(data);
    }
};

const fetch: ICommand = {
    name: "fetch",
    description: "Fetches data from a URL and returns the response in JSON format",
    usage: "fetch <url> [useHttps]",
    aliases: ["curl", "wget", "http"],
    category: "Utility",
    async execute(message, args) {
        if (!args?.length) {
            return message.reply({
                embeds: [{
                    title: "Error",
                    description: "Please provide a URL to fetch",
                    colour: "#ff0000"
                }]
            });
        }

        let url = args[0];
        const useHttps = args[1]?.toLowerCase() === "false" ? false : true;

        // Add protocol if not specified
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `${useHttps ? 'https' : 'http'}://${url}`;
        }

        if (!isValidUrl(url)) {
            return message.reply({
                embeds: [{
                    title: "Error",
                    description: "Please provide a valid URL",
                    colour: "#ff0000"
                }]
            });
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await global.fetch(url, {
                headers: {
                    'User-Agent': 'RevoltBot/1.0',
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeout); // Clear timeout if request completes

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const formattedJson = formatJson(data);

            // Truncate response if too long
            const maxLength = 1900; // Discord-like limit for safety
            const truncatedJson = formattedJson.length > maxLength 
                ? formattedJson.slice(0, maxLength) + "\n... (truncated)"
                : formattedJson;

            return message.reply({
                embeds: [{
                    title: "Fetch Results",
                    description: [
                        `**URL**: ${url}`,
                        `**Protocol**: ${useHttps ? 'HTTPS' : 'HTTP'}`,
                        `**Status**: ${response.status} ${response.statusText}`,
                        "**Response**:",
                        "```json",
                        truncatedJson,
                        "```"
                    ].join("\n"),
                    colour: "#00ff00"
                }]
            });

        } catch (error) {
            commandLogger.error("Fetch command error:", error);
            
            const errorMessage = error instanceof Error 
                ? error.message 
                : "An unknown error occurred";

            return message.reply({
                embeds: [{
                    title: "Error",
                    description: [
                        "Failed to fetch data from the URL",
                        "```",
                        errorMessage,
                        "```"
                    ].join("\n"),
                    colour: "#ff0000"
                }]
            });
        }
    }
};

export default fetch;
