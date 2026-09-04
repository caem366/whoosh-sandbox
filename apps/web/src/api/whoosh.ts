export type AccountType =
  | 'member_wallet'
  | 'member_expense'
  | 'member_payable'
  | 'member_receivable'

export type SettlementStatus =
  | 'pending'
  | 'processing'
  | 'settled'
  | 'failed'
  | 'cancelled'

export interface GroupAccount {
  id: string
  type: AccountType
  normalBalance: 'debit' | 'credit'
  balanceCents: number
}

export interface GroupMember {
  memberId: string
  userId: string
  displayName: string
  status: 'active' | 'archived'
  joinedAt: string
  walletBalanceCents: number
  accounts: GroupAccount[]
}

export interface GroupSettlement {
  id: string
  transactionId: string
  debtorMemberId: string
  creditorMemberId: string
  merchant: string
  transactionCreatedAt: string
  amountCents: number
  currency: string
  status: SettlementStatus
  attemptCount: number
  failureReason: string | null
  createdAt: string
  settledAt: string | null
}

export interface GroupDetail {
  group: {
    id: string
    name: string
    currency: string
    createdAt: string
  }
  members: GroupMember[]
  settlements: GroupSettlement[]
}

export interface CreateSandboxTransactionRequest {
  groupId: string
  payerMemberId: string
  merchant: string
  totalCents: number
  splitMethod: 'equal'
  participantMemberIds: string[]
}

export interface SandboxTransactionResponse {
  transaction: {
    id: string
    merchant: string
    totalCents: number
    payerMemberId: string
    status: string
  }
  allocations: Array<{ responsibleMemberId: string; amountCents: number }>
  settlements: GroupSettlement[]
  settlementPlan?: Array<{
    debtorMemberId: string
    creditorMemberId: string
    amountCents: number
  }>
  idempotent: boolean
}

export type SettlementSimulation =
  | 'success'
  | 'forced_failure'
  | 'insufficient_funds'

export type WhooshApiError = Error & { status: number; payload: unknown }

export function isWhooshApiError(error: unknown): error is WhooshApiError {
  return error instanceof Error && 'status' in error && 'payload' in error
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, options)
  const text = await response.text()
  const payload: unknown = text.length > 0 ? JSON.parse(text) : null

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String(payload.error)
        : 'WHOOSH API request failed'

    const error = new Error(message) as WhooshApiError
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload as T
}

export function getGroup(groupId: string): Promise<GroupDetail> {
  return request<GroupDetail>(`/api/groups/${groupId}`)
}

export function createSandboxTransaction(
  input: CreateSandboxTransactionRequest,
  idempotencyKey: string,
): Promise<SandboxTransactionResponse> {
  return request<SandboxTransactionResponse>('/api/sandbox/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(input),
  })
}

export function processSettlement(
  settlementId: string,
  simulation: SettlementSimulation,
  idempotencyKey: string,
): Promise<unknown> {
  return request<unknown>(`/api/settlements/${settlementId}/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ simulation }),
  })
}
