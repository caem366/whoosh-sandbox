import { Router } from 'express'
import { z } from 'zod'

import { processSettlement } from './settlements.service.js'

const settlementParamsSchema = z.object({
  settlementId: z.string().uuid(),
})

const processSettlementBodySchema = z.object({
  simulation: z
    .enum(['success', 'forced_failure', 'insufficient_funds'])
    .default('success'),
})

export const settlementsRouter = Router()

settlementsRouter.post('/:settlementId/process', async (request, response, next) => {
  try {
    const { settlementId } = settlementParamsSchema.parse(request.params)
    const { simulation } = processSettlementBodySchema.parse(request.body ?? {})

    const result = await processSettlement({
      settlementId,
      simulation,
      idempotencyKey: request.header('Idempotency-Key') ?? undefined,
    })

    response.status(200).json(result)
  } catch (error) {
    next(error)
  }
})
