import axios from "axios";
import dayjs from "dayjs";
import { Message } from "revolt.js";

const trackmania: Command = {
    name: "trackmania",
    description: "Search tracks from ManiaExchange's API",
    args: true,
    use: "<tm2 or tm2020> <ID>",
    async execute(message: Message, args: string[]) {
        const game: string = args[0];
        const map: string = args[1];

        if (game === "tm2") {
            // The map constant can be a ID or a map name
            const { data } = await axios.get(
                `https://tm.mania.exchange/api/maps/get_map_info/id/${map}`
            );

            if (!data.TrackID) return message.reply("Map not found :(")

            return message.reply({
                embeds: [
                    {
                        title: "Trackmania 2 on ManiaExchange",
                        description: `# ${data.Name}\nMade by ${
                            data.Username
                        }\nTitlepack: ${
                            data.TitlePack
                        }\nEnvironment: ${
                            data.EnvironmentName
                        }\nLength (From MX): ${
                            data.LengthName
                        }\nLaps: ${data.Laps}\nWorld Record: ${dayjs(
                            data.ReplayWRTime
                        ).format("HH:mm:ss.SSS")} by ${
                            data.ReplayWRUsername
                        }\n[[Link]](https://tm.mania-exchange.com/maps/${
                            data.TrackID
                        })`,
                    },
                ],
            });
        } else if (game === "tm2020") {
            // The map constant can be a ID or a map name
            const { data } = await axios.get(
                `https://trackmania.exchange/api/maps/get_map_info/id/${map}`
            );

            if (!data.TrackID) return message.reply("Map not found :(")

            return message.reply({
                embeds: [
                    {
                        title: "Trackmania on ManiaExchange",
                        description: `# ${data.Name}\nMade by ${
                            data.Username
                        }\nTitlepack: ${
                            data.TitlePack
                        }\nEnvironment: ${
                            data.EnvironmentName
                        }\nLength (From MX): ${
                            data.LengthName
                        }\nLaps: ${data.Laps}\nWorld Record: ${dayjs(
                            data.ReplayWRTime
                        ).format("HH:mm:ss.SSS")} by ${
                            data.ReplayWRUsername
                        }\n[[Link]](https://tm.mania-exchange.com/maps/${
                            data.TrackID
                        })`,
                    },
                ],
            });
        }
    },
};

export = trackmania;
