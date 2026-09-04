import type {MoneyCents} from '@whoosh/shared'

export interface CreateSandboxTransactionInput {
  groupId: string
  payerMemberId: string
  merchant: string
  totalCents: MoneyCents

  // MVP supports equal splits only.
  splitMethod: 'equal'

  // The members sharing responsibility for the purchase.
  participantMemberIds: string[]

  // Prevents a retry from creating the same fake purchase twice.
  idempotencyKey?: string
}

export interface AllocationPlan {
  responsibleMemberId: string
  amountCents: MoneyCents
}

export interface SettlementPlan {
  debtorMemberId: string
  creditorMemberId: string
  amountCents: MoneyCents
}