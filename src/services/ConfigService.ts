import { z } from 'zod'
import { config } from 'dotenv'
import path from 'node:path'

const ConfigSchema = z.object({
  TOKEN: z.string(),
  PREFIX: z.string().default('!'),
  DISABLED_PLUGINS: z.string().optional()
})

export class ConfigService {
  private config: z.infer<typeof ConfigSchema>

  constructor() {
    // Load .env file with absolute path
    config({
      path: path.resolve(process.cwd(), '.env'),
      debug: true // This will show us the .env loading process
    })

    console.log('Environment check:', {
      TOKEN: process.env.TOKEN ? 'Present' : 'Missing',
      PREFIX: process.env.PREFIX,
      CWD: process.cwd()
    })

    this.config = ConfigSchema.parse(process.env)
  }

  getToken(): string {
    return this.config.TOKEN
  }

  getPrefix(): string {
    return this.config.PREFIX
  }

  isValid(): boolean {
    return Boolean(this.config.TOKEN)
  }
}