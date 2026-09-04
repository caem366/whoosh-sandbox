import { Router } from 'express'
import { z } from 'zod'

import { createSandboxTransaction } from './transactions.service.js'

const createSandboxTransactionSchema = z.object({
  groupId: z.string().uuid(),
  payerMemberId: z.string().uuid(),
  merchant: z.string().trim().min(1).max(160),
  totalCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  splitMethod: z.literal('equal'),
  participantMemberIds: z.array(z.string().uuid()).min(1),
})

export const sandboxRouter = Router()

sandboxRouter.post('/transactions', async (request, response, next) => {
  try {
    const input = createSandboxTransactionSchema.parse(request.body)

    const result = await createSandboxTransaction({
      ...input,
      idempotencyKey: request.header('Idempotency-Key') ?? undefined,
    })

    response.status(201).json(result)
  } catch (error) {
    next(error)
  }
})