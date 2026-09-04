import { Router } from 'express'
import { z } from 'zod'

import {
  addGroupMember,
  createGroup,
  fundMemberWallet,
  getGroupDetail,
} from './groups.service.js'

const groupIdSchema = z.object({
  groupId: z.string().uuid(),
})

const addGroupMemberSchema = z.object({
  groupId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(120),
})

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(160),
  creatorName: z.string().trim().min(1).max(120),
})

const fundWalletSchema = z.object({
  groupId: z.string().uuid(),
  memberId: z.string().uuid(),
  amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
})

export const groupsRouter = Router()

groupsRouter.post('/', async (request, response, next) => {
  try {
    const input = createGroupSchema.parse(request.body)
    const result = await createGroup(input)

    response.status(201).json(result)
  } catch (error) {
    next(error)
  }
})

groupsRouter.post('/:groupId/members', async (request, response, next) => {
  try {
    const input = addGroupMemberSchema.parse({
      groupId: request.params.groupId,
      ...request.body,
    })

    const result = await addGroupMember(input)

    response.status(201).json(result)
  } catch (error) {
    next(error)
  }
})

groupsRouter.post(
  '/:groupId/members/:memberId/fund-wallet',
  async (request, response, next) => {
    try {
      const input = fundWalletSchema.parse({
        groupId: request.params.groupId,
        memberId: request.params.memberId,
        ...request.body,
      })

      const result = await fundMemberWallet({
        ...input,
        idempotencyKey: request.header('Idempotency-Key') ?? undefined,
      })

      response.status(201).json(result)
    } catch (error) {
      next(error)
    }
  },
)

groupsRouter.get('/:groupId', async (request, response, next) => {
  try {
    const { groupId } = groupIdSchema.parse(request.params)
    const result = await getGroupDetail(groupId)

    response.status(200).json(result)
  } catch (error) {
    next(error)
  }
})
