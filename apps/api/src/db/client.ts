import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { environment } from '../config.js'

export const pool = new Pool({ connectionString: environment.DATABASE_URL })

export const db = drizzle({ client: pool })
