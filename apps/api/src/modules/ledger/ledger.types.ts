import type { Currency, MoneyCents } from '@whoosh/shared'

export type LedgerEntryDirection = 'debit' | 'credit'

export interface LedgerEntryInput {
  accountId: string
  direction: LedgerEntryDirection
  amountCents: MoneyCents
  currency: Currency
}

export interface CreateJournalInput {
  groupId: string
  description: string
  entries: LedgerEntryInput[]
}

export interface CreateJournalInput {
  groupId: string
  description: string
  idempotencyKey?: string
  entries: LedgerEntryInput[]
}