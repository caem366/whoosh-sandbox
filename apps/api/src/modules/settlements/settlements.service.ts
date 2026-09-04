import { and, eq } from 'drizzle-orm'

import { assertIntegerCents } from '@whoosh/shared'

import { db } from '../../db/client.js'
import {
  events,
  ledgerAccounts,
  ledgerEntries,
  ledgerJournals,
  settlements,
} from '../../db/schema/index.js'

import {
  postJournalInTransaction,
  type DatabaseTransaction,
} from '../ledger/ledger.service.js'
import type { ProcessSettlementInput } from './settlements.types.js'

async function getPostedBalanceInTransaction(
  transaction: DatabaseTransaction,
  accountId: string,
): Promise<number> {
  const entries = await transaction
    .select({
      direction: ledgerEntries.direction,
      amountCents: ledgerEntries.amountCents,
    })
    .from(ledgerEntries)
    .innerJoin(
      ledgerJournals,
      eq(ledgerEntries.journalId, ledgerJournals.id),
    )
    .where(
      and(
        eq(ledgerEntries.accountId, accountId),
        eq(ledgerJournals.status, 'posted'),
      ),
    )

  return entries.reduce((balance, entry) => {
    const change =
      entry.direction === 'debit'
        ? entry.amountCents
        : -entry.amountCents

    const nextBalance = balance + change
    assertIntegerCents(nextBalance, 'account balance')

    return nextBalance
  }, 0)
}

export async function processSettlement(input: ProcessSettlementInput) {
  const simulation = input.simulation ?? 'success'

  return db.transaction(async (transaction) => {
    const [foundSettlement] = await transaction
  .select()
  .from(settlements)
  .where(eq(settlements.id, input.settlementId))
  .limit(1)

if (!foundSettlement) {
  throw new TypeError('Settlement not found')
}

const settlement = foundSettlement

    if (settlement.status !== 'pending' && settlement.status !== 'failed') {
      throw new TypeError(
        `Settlement cannot be processed from ${settlement.status}`,
      )
    }

    async function markFailed(failureReason: string) {
      const [failedSettlement] = await transaction
        .update(settlements)
        .set({
          status: 'failed' as const,
          attemptCount: settlement.attemptCount + 1,
          failureReason,
          updatedAt: new Date(),
        })
        .where(eq(settlements.id, settlement.id))
        .returning()

      if (!failedSettlement) {
        throw new Error('Could not mark settlement as failed')
      }

      await transaction.insert(events).values({
        groupId: settlement.groupId,
        aggregateType: 'settlement',
        aggregateId: settlement.id,
        eventType: 'settlement.failed',
        idempotencyKey: input.idempotencyKey,
        payload: {
          amountCents: settlement.amountCents,
          reason: failureReason,
          simulation,
        },
      })

      return {
        settlement: failedSettlement,
        journal: null,
        idempotent: false,
      }
    }

    if (simulation === 'forced_failure') {
      return markFailed('Sandbox forced settlement failure')
    }

    if (simulation === 'insufficient_funds') {
      return markFailed('Sandbox simulated insufficient funds')
    }

    await transaction
      .update(settlements)
      .set({
        status: 'processing' as const,
        updatedAt: new Date(),
      })
      .where(eq(settlements.id, settlement.id))

    const accounts = await transaction
      .select()
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.groupId, settlement.groupId))

    function findMemberAccount(
      memberId: string,
      type: 'member_wallet' | 'member_payable' | 'member_receivable',
    ) {
      const account = accounts.find(
        (candidate) =>
          candidate.groupMemberId === memberId &&
          candidate.type === type,
      )

      if (!account) {
        throw new TypeError(`Missing ${type} account for member ${memberId}`)
      }

      return account
    }

    const debtorWallet = findMemberAccount(
      settlement.debtorMemberId,
      'member_wallet',
    )

    const debtorPayable = findMemberAccount(
      settlement.debtorMemberId,
      'member_payable',
    )

    const creditorWallet = findMemberAccount(
      settlement.creditorMemberId,
      'member_wallet',
    )

    const creditorReceivable = findMemberAccount(
      settlement.creditorMemberId,
      'member_receivable',
    )

    const debtorAvailableCents = await getPostedBalanceInTransaction(
      transaction,
      debtorWallet.id,
    )

    if (debtorAvailableCents < settlement.amountCents) {
      return markFailed(
        `Insufficient simulated funds: available=${debtorAvailableCents}, required=${settlement.amountCents}`,
      )
    }

    const journal = await postJournalInTransaction(transaction, {
      groupId: settlement.groupId,
      description: `Settlement payment: ${settlement.id}`,
      idempotencyKey: input.idempotencyKey
        ? `${input.idempotencyKey}:journal`
        : undefined,
      entries: [
        {
          accountId: creditorWallet.id,
          direction: 'debit',
          amountCents: settlement.amountCents,
          currency: 'CAD',
        },
        {
          accountId: debtorWallet.id,
          direction: 'credit',
          amountCents: settlement.amountCents,
          currency: 'CAD',
        },
        {
          accountId: debtorPayable.id,
          direction: 'debit',
          amountCents: settlement.amountCents,
          currency: 'CAD',
        },
        {
          accountId: creditorReceivable.id,
          direction: 'credit',
          amountCents: settlement.amountCents,
          currency: 'CAD',
        },
      ],
    })

    const [settledSettlement] = await transaction
      .update(settlements)
      .set({
        status: 'settled' as const,
        attemptCount: settlement.attemptCount + 1,
        failureReason: null,
        settledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(settlements.id, settlement.id))
      .returning()

    if (!settledSettlement) {
      throw new Error('Could not update settlement')
    }

    await transaction.insert(events).values({
      groupId: settlement.groupId,
      journalId: journal.id,
      aggregateType: 'settlement',
      aggregateId: settlement.id,
      eventType: 'settlement.settled',
      idempotencyKey: input.idempotencyKey,
      payload: {
        amountCents: settlement.amountCents,
        debtorMemberId: settlement.debtorMemberId,
        creditorMemberId: settlement.creditorMemberId,
      },
    })

    return {
      settlement: settledSettlement,
      journal,
      idempotent: false,
    }
  })
}