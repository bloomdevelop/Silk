import type { ICommand } from "../../types.js";
import { Logger } from "../../utils/Logger.js";
import type { Message } from "stoat.js";

interface WeatherResponse {
    location: {
        name: string;
        region: string;
        country: string;
    };
    current: {
        temp_c: number;
        condition: {
            text: string;
            code: number;
        };
        wind_kph: number;
        humidity: number;
        feelslike_c: number;
        precip_mm: number;
        uv: number;
    };
}

const weather: ICommand = {
    name: "weather",
    description: "Get the current weather for a location",
    usage: "weather <city name>",
    category: "Utility",
    aliases: ["forecast"],
    logger: Logger.getInstance("weather"),
    flags: {
        disabled: process.env.WEATHERAPI_KEY === ""
    },
    rateLimit: {
        usages: 5,
        duration: 60000, // 1 minute
        users: new Map()
    },

    async execute(msg: Message, args: string[]): Promise<void> {
        if (!args.length) {
            await msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Please provide a city name!\nUsage: `weather <city name>`",
                    colour: "#ff0000"
                }]
            });
            return;
        }

        const city = args.join(" ");
        const apiKey = process.env.WEATHERAPI_KEY;

        if (!apiKey) {
            this.logger?.error("WeatherAPI key not found in environment variables");
            await msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Weather service is not properly configured",
                    colour: "#ff0000"
                }]
            });
            return;
        }

        const loadingMsg = await msg.reply({
            embeds: [{
                title: "🌤️ Fetching Weather",
                description: `Getting weather information for ${city}...`,
                colour: "#ffff00"
            }]
        });

        if (!loadingMsg) {
            await msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Failed to send loading message",
                    colour: "#ff0000"
                }]
            });
            return;
        }

        try {
            const response = await fetch(
                `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}&aqi=no`
            );

            if (!response.ok) {
                if (response.status === 400) {
                    await loadingMsg.edit({
                        embeds: [{
                            title: "Error",
                            description: "City not found! Please check the spelling and try again.",
                            colour: "#ff0000"
                        }]
                    });
                    return;
                }
                throw new Error(`API responded with status: ${response.status}`);
            }

            const data = await response.json() as WeatherResponse;
            const weatherEmoji = getWeatherEmoji(data.current.condition.code);
            const location = [data.location.name, data.location.region, data.location.country]
                .filter(Boolean)
                .join(", ");

            await loadingMsg.edit({
                embeds: [{
                    title: `${weatherEmoji} Weather in ${location}`,
                    description: [
                        `**Condition:** ${data.current.condition.text}`,
                        `**Temperature:** ${data.current.temp_c}°C`,
                        `**Feels Like:** ${data.current.feelslike_c}°C`,
                        `**Humidity:** ${data.current.humidity}%`,
                        `**Wind Speed:** ${Math.round(data.current.wind_kph * 0.277778)} m/s`,
                        data.current.precip_mm > 0 ? `**Precipitation:** ${data.current.precip_mm}mm` : null,
                        `**UV Index:** ${data.current.uv}`
                    ].filter(Boolean).join("\n"),
                    colour: getWeatherColor(data.current.condition.code)
                }]
            });

        } catch (error) {
            this.logger?.error("Error fetching weather:", error);
            await loadingMsg.edit({
                embeds: [{
                    title: "Error",
                    description: "Failed to fetch weather information. Please try again later.",
                    colour: "#ff0000"
                }]
            });
        }
    }
};

// Helper function to get weather emoji based on condition code
function getWeatherEmoji(code: number): string {
    // WeatherAPI condition codes: https://www.weatherapi.com/docs/weather_conditions.json
    if (code === 1000) return '☀️'; // Clear
    if (code === 1003) return '🌤️'; // Partly cloudy
    if (code >= 1006 && code <= 1009) return '☁️'; // Cloudy
    if (code >= 1030 && code <= 1039) return '🌫️'; // Mist, fog, etc
    if (code >= 1063 && code <= 1087) return '🌧️'; // Rain, thunder
    if (code >= 1114 && code <= 1117) return '🌨️'; // Snow
    if (code >= 1135 && code <= 1147) return '🌫️'; // Fog
    if (code >= 1150 && code <= 1201) return '🌧️'; // Light/heavy rain
    if (code >= 1204 && code <= 1237) return '🌨️'; // Sleet/snow
    if (code >= 1240 && code <= 1246) return '🌧️'; // Rain showers
    if (code >= 1249 && code <= 1264) return '🌨️'; // Sleet/snow showers
    if (code >= 1273 && code <= 1282) return '⛈️'; // Thunder
    return '🌡️';
}

// Helper function to get weather color
function getWeatherColor(code: number): string {
    // Sunny/Clear
    if (code === 1000) return '#ffdb4a';
    
    // Cloudy conditions
    if (code >= 1003 && code <= 1009) return '#8c9eff';
    
    // Rain conditions
    if ((code >= 1063 && code <= 1087) || 
        (code >= 1150 && code <= 1201) ||
        (code >= 1240 && code <= 1246)) return '#64b5f6';
    
    // Snow conditions
    if ((code >= 1114 && code <= 1117) ||
        (code >= 1204 && code <= 1237) ||
        (code >= 1249 && code <= 1264)) return '#e1f5fe';
    
    // Fog/Mist conditions
    if ((code >= 1030 && code <= 1039) ||
        (code >= 1135 && code <= 1147)) return '#b0bec5';
    
    // Thunder conditions
    if (code >= 1273 && code <= 1282) return '#5c6bc0';
    
    return '#00ff00'; // Default color
}

export default weather; 