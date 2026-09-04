import cors from 'cors'
import express from 'express'

import { pool } from './db/client.js'
import { environment } from './config.js'
import { groupsRouter } from './modules/groups/groups.routes.js'

import { sandboxRouter } from './modules/transactions/transactions.routes.js'

import { settlementsRouter } from './modules/settlements/settlements.routes.js'


const app = express()

app.use(cors({ origin: environment.CORS_ORIGIN }))
app.use(express.json())
app.use('/api/groups', groupsRouter)
app.use('/api/sandbox', sandboxRouter)
app.use('/api/settlements', settlementsRouter)

app.get('/health', async (_request, response) => {
  await pool.query('SELECT 1')
  response.status(200).json({ status: 'ok' })
})

app.get('/api/health', (_request, response) => {
  response.status(200).json({ service: 'whoosh-api', status: 'ok' })
})

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = error instanceof Error ? error.message : 'Unexpected server error'

    response.status(400).json({ error: message })
  },
)

app.listen(environment.PORT, () => {
  console.info(`WHOOSH API listening on port ${environment.PORT}`)
})
