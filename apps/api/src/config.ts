import { config } from 'dotenv'

import { z } from 'zod'

// `neon link` writes local connection details to .env.local. Existing .env
// files and platform-provided environment variables remain supported.
config({ path: '.env.local' })
config()

const environmentSchema = z.object({
  CORS_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
})

export const environment = environmentSchema.parse(process.env)
