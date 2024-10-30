import {z} from "zod";
import dotenv from "dotenv";

const configSchema = z.object({
    token: z.string(),
    prefix: z.string(),
    disabledPlugins: z.string().transform(s => s.split(',')).default(''),
})

export const getConfig = () => {
    dotenv.config();
    return configSchema.parse({
        token: process.env.TOKEN,
        prefix: process.env.PREFIX,
        disabledPlugins: process.env.DISABLED_PLUGINS
    })
}