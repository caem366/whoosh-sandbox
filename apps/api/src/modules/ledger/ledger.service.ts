import { assertIntegerCents, assertPositiveCents } from '@whoosh/shared'

import type { CreateJournalInput, LedgerEntryInput } from './ledger.types.js'

import { and, eq, inArray } from 'drizzle-orm'

import { db } from '../../db/client.js'
import {
  events,
  ledgerAccounts,
  ledgerEntries,
  ledgerJournals,
} from '../../db/schema/index.js'

export type DatabaseTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0]

export async function postJournalInTransaction(
  transaction: DatabaseTransaction,
  input: CreateJournalInput,
) {
  const validatedJournal = createJournal(input)
  const accountIds = validatedJournal.entries.map((entry) => entry.accountId)

  if (validatedJournal.idempotencyKey) {
    const [existingJournal] = await transaction
      .select()
      .from(ledgerJournals)
      .where(eq(ledgerJournals.idempotencyKey, validatedJournal.idempotencyKey))
      .limit(1)

    if (existingJournal) {
      return existingJournal
    }
  }

  const accounts = await transaction
    .select({
      id: ledgerAccounts.id,
      currency: ledgerAccounts.currency,
    })
    .from(ledgerAccounts)
    .where(
      and(
        eq(ledgerAccounts.groupId, validatedJournal.groupId),
        inArray(ledgerAccounts.id, accountIds),
      ),
    )

  if (accounts.length !== new Set(accountIds).size) {
    throw new TypeError('Every ledger entry must use an existing account')
  }

  const [draftJournal] = await transaction
    .insert(ledgerJournals)
    .values({
      groupId: validatedJournal.groupId,
      description: validatedJournal.description,
      idempotencyKey: validatedJournal.idempotencyKey,
      status: 'draft',
    })
    .returning()

  if (!draftJournal) {
    throw new Error('Could not create ledger journal')
  }

  await transaction.insert(ledgerEntries).values(
    validatedJournal.entries.map((entry) => ({
      journalId: draftJournal.id,
      accountId: entry.accountId,
      direction: entry.direction,
      amountCents: entry.amountCents,
      currency: entry.currency,
    })),
  )


  const [postedJournal] = await transaction
    .update(ledgerJournals)
    .set({
      status: 'posted',
      postedAt: new Date(),
    })
    .where(eq(ledgerJournals.id, draftJournal.id))
    .returning()

  if (!postedJournal) {
    throw new Error('Could not post ledger journal')
  }

  await transaction.insert(events).values({
    groupId: validatedJournal.groupId,
    journalId: postedJournal.id,
    aggregateType: 'ledger_journal',
    aggregateId: postedJournal.id,
    eventType: 'ledger.journal.posted',
    idempotencyKey: validatedJournal.idempotencyKey,
    payload: {
      description: validatedJournal.description,
      entryCount: validatedJournal.entries.length,
    },
  })

  return postedJournal
}

function getTotal(entries: LedgerEntryInput[], direction: 'debit' | 'credit'): number {
  return entries
    .filter((entry) => entry.direction === direction)
    .reduce((total, entry) => {
      assertPositiveCents(entry.amountCents, 'entry.amountCents')

      const nextTotal = total + entry.amountCents
      assertIntegerCents(nextTotal, 'journal total')

      return nextTotal
    }, 0)
}

export function assertJournalBalanced(entries: LedgerEntryInput[]): void {
  if (entries.length < 2) {
    throw new TypeError('A journal needs at least two entries')
  }

  const debitTotal = getTotal(entries, 'debit')
  const creditTotal = getTotal(entries, 'credit')

  if (debitTotal !== creditTotal) {
    throw new TypeError(
      `Journal is unbalanced: debits=${debitTotal}, credits=${creditTotal}`,
    )
  }
}

export function createJournal(input: CreateJournalInput): CreateJournalInput {
  if (input.description.trim().length === 0) {
    throw new TypeError('Journal description is required')
  }

  assertJournalBalanced(input.entries)

  return input
}

export async function postJournal(input: CreateJournalInput) {
  return db.transaction((transaction) =>
    postJournalInTransaction(transaction, input),
  )
}



