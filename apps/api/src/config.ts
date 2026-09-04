import 'dotenv/config'

import { z } from 'zod'

const environmentSchema = z.object({
  CORS_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
})

export const environment = environmentSchema.parse(process.env)
