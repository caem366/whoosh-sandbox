import { and, eq, inArray } from 'drizzle-orm'

import {
  assertIntegerCents,
  assertPositiveCents,
  splitEvenly,
} from '@whoosh/shared'

import { db } from '../../db/client.js'
import {
  allocations as allocationRecords,
  groupMembers,
  groups,
  events,
  ledgerAccounts,
  ledgerEntries,
  ledgerJournals,
  settlements,
  transactions as merchantTransactions,
} from '../../db/schema/index.js'

import {
  postJournalInTransaction,
  type DatabaseTransaction,
} from '../ledger/ledger.service.js'

import type {
  AllocationPlan,
  CreateSandboxTransactionInput,
} from './transactions.types.js'

export function buildEqualAllocationPlan(
  totalCents: number,
  participantMemberIds: string[],
): AllocationPlan[] {
  assertPositiveCents(totalCents, 'totalCents')

  if (participantMemberIds.length === 0) {
    throw new TypeError('At least one participant is required')
  }

  const uniqueMemberIds = new Set(participantMemberIds)

  if (uniqueMemberIds.size !== participantMemberIds.length) {
    throw new TypeError('A participant can only appear once')
  }

  const amounts = splitEvenly(totalCents, participantMemberIds.length)

  return participantMemberIds.map((memberId, index) => ({
    responsibleMemberId: memberId,
    amountCents: amounts[index]!,
  }))
}

export async function getPostedWalletBalance(
  accountId: string,
): Promise<number> {
  const entries = await db
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
    assertIntegerCents(nextBalance, 'wallet balance')

    return nextBalance
  }, 0)
}

export async function validateSandboxTransaction(
  input: CreateSandboxTransactionInput,
): Promise<{
  payerWalletAccountId: string
  allocations: AllocationPlan[]
}> {
  if (input.merchant.trim().length === 0) {
    throw new TypeError('Merchant name is required')
  }

  const allocations = buildEqualAllocationPlan(
    input.totalCents,
    input.participantMemberIds,
  )

  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.id, input.groupId))
    .limit(1)

  if (!group) {
    throw new TypeError('Group not found')
  }

  const memberIdsToValidate = [
    ...new Set([input.payerMemberId, ...input.participantMemberIds]),
  ]

  const members = await db
    .select({
      id: groupMembers.id,
    })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, input.groupId),
        eq(groupMembers.status, 'active'),
        inArray(groupMembers.id, memberIdsToValidate),
      ),
    )

  if (members.length !== memberIdsToValidate.length) {
    throw new TypeError(
      'Payer and every participant must be active group members',
    )
  }

  const [payerWallet] = await db
    .select({
      id: ledgerAccounts.id,
    })
    .from(ledgerAccounts)
    .where(
      and(
        eq(ledgerAccounts.groupId, input.groupId),
        eq(ledgerAccounts.groupMemberId, input.payerMemberId),
        eq(ledgerAccounts.type, 'member_wallet'),
      ),
    )
    .limit(1)

  if (!payerWallet) {
    throw new TypeError('Payer wallet account not found')
  }

  const availableCents = await getPostedWalletBalance(payerWallet.id)

  if (availableCents < input.totalCents) {
    throw new TypeError(
      `Insufficient simulated funds: available=${availableCents}, required=${input.totalCents}`,
    )
  }

  return {
    payerWalletAccountId: payerWallet.id,
    allocations,
  }
}

export async function createTransactionRecordsInTransaction(
  transaction: DatabaseTransaction,
  input: CreateSandboxTransactionInput,
  allocationPlan: AllocationPlan[],
) {
  const [merchantTransaction] = await transaction
    .insert(merchantTransactions)
    .values({
      groupId: input.groupId,
      payerMemberId: input.payerMemberId,
      merchant: input.merchant.trim(),
      totalCents: input.totalCents,
      currency: 'CAD',
      splitMethod: 'equal',
      status: 'posted',
      idempotencyKey: input.idempotencyKey,
    })
    .returning()

  if (!merchantTransaction) {
    throw new Error('Could not create transaction')
  }

  const allocationRows = await transaction
    .insert(allocationRecords)
    .values(
      allocationPlan.map((allocation) => ({
        transactionId: merchantTransaction.id,
        responsibleMemberId: allocation.responsibleMemberId,
        amountCents: allocation.amountCents,
      })),
    )
    .returning()

  const settlementPlan = allocationPlan
    .filter(
      (allocation) =>
        allocation.responsibleMemberId !== input.payerMemberId,
    )
    .map((allocation) => ({
      debtorMemberId: allocation.responsibleMemberId,
      creditorMemberId: input.payerMemberId,
      amountCents: allocation.amountCents,
    }))

  const settlementRows =
    settlementPlan.length === 0
      ? []
      : await transaction
          .insert(settlements)
          .values(
            settlementPlan.map((settlement) => ({
              groupId: input.groupId,
              transactionId: merchantTransaction.id,
              debtorMemberId: settlement.debtorMemberId,
              creditorMemberId: settlement.creditorMemberId,
              amountCents: settlement.amountCents,
              currency: 'CAD',
              status: 'pending' as const,
            })),
          )
          .returning()

  return {
    transaction: merchantTransaction,
    allocations: allocationRows,
    settlements: settlementRows,
    settlementPlan,
  }
}

export async function createSandboxTransaction(
  input: CreateSandboxTransactionInput,
) {
  const validated = await validateSandboxTransaction(input)

  return db.transaction(async (transaction) => {
    if (input.idempotencyKey) {
      const [existingTransaction] = await transaction
        .select()
        .from(merchantTransactions)
        .where(
          eq(
            merchantTransactions.idempotencyKey,
            input.idempotencyKey,
          ),
        )
        .limit(1)

      if (existingTransaction) {
        const existingAllocations = await transaction
          .select()
          .from(allocationRecords)
          .where(eq(allocationRecords.transactionId, existingTransaction.id))

        const existingSettlements = await transaction
          .select()
          .from(settlements)
          .where(eq(settlements.transactionId, existingTransaction.id))

        return {
          transaction: existingTransaction,
          allocations: existingAllocations,
          settlements: existingSettlements,
          idempotent: true,
        }
      }
    }

    const accounts = await transaction
      .select()
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.groupId, input.groupId))

    let merchantClearingAccount = accounts.find(
      (account) =>
        account.type === 'merchant_clearing' &&
        account.groupMemberId === null,
    )

    if (!merchantClearingAccount) {
      const [createdAccount] = await transaction
        .insert(ledgerAccounts)
        .values({
          groupId: input.groupId,
          type: 'merchant_clearing',
          normalBalance: 'debit',
          currency: 'CAD',
        })
        .returning()

      if (!createdAccount) {
        throw new Error('Could not create merchant clearing account')
      }

      merchantClearingAccount = createdAccount
    }

    function findMemberAccount(
      memberId: string,
      type:
        | 'member_wallet'
        | 'member_expense'
        | 'member_payable'
        | 'member_receivable',
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

    const payerWallet = findMemberAccount(
      input.payerMemberId,
      'member_wallet',
    )

    const payerReceivable = findMemberAccount(
      input.payerMemberId,
      'member_receivable',
    )

    const result = await createTransactionRecordsInTransaction(
      transaction,
      input,
      validated.allocations,
    )

    const journalKey = (suffix: string) =>
      input.idempotencyKey
        ? `${input.idempotencyKey}:${suffix}`
        : undefined

    await postJournalInTransaction(transaction, {
      groupId: input.groupId,
      description: `Merchant payment: ${input.merchant.trim()}`,
      idempotencyKey: journalKey('payment'),
      entries: [
        {
          accountId: merchantClearingAccount.id,
          direction: 'debit',
          amountCents: input.totalCents,
          currency: 'CAD',
        },
        {
          accountId: payerWallet.id,
          direction: 'credit',
          amountCents: input.totalCents,
          currency: 'CAD',
        },
      ],
    })

    await postJournalInTransaction(transaction, {
      groupId: input.groupId,
      description: `Expense allocations: ${input.merchant.trim()}`,
      idempotencyKey: journalKey('allocations'),
      entries: [
        ...validated.allocations.map((allocation) => ({
          accountId: findMemberAccount(
            allocation.responsibleMemberId,
            'member_expense',
          ).id,
          direction: 'debit' as const,
          amountCents: allocation.amountCents,
          currency: 'CAD' as const,
        })),
        {
          accountId: merchantClearingAccount.id,
          direction: 'credit',
          amountCents: input.totalCents,
          currency: 'CAD',
        },
      ],
    })

    if (result.settlementPlan.length > 0) {
      const recoverableCents = result.settlementPlan.reduce(
        (total, settlement) => total + settlement.amountCents,
        0,
      )

      await postJournalInTransaction(transaction, {
        groupId: input.groupId,
        description: `Settlement obligations: ${input.merchant.trim()}`,
        idempotencyKey: journalKey('settlements'),
        entries: [
          {
            accountId: payerReceivable.id,
            direction: 'debit',
            amountCents: recoverableCents,
            currency: 'CAD',
          },
          ...result.settlementPlan.map((settlement) => ({
            accountId: findMemberAccount(
              settlement.debtorMemberId,
              'member_payable',
            ).id,
            direction: 'credit' as const,
            amountCents: settlement.amountCents,
            currency: 'CAD' as const,
          })),
        ],
      })
    }

    await transaction.insert(events).values({
      groupId: input.groupId,
      aggregateType: 'transaction',
      aggregateId: result.transaction.id,
      eventType: 'sandbox.transaction.posted',
      idempotencyKey: journalKey('transaction'),
      payload: {
        merchant: result.transaction.merchant,
        totalCents: result.transaction.totalCents,
        allocationCount: result.allocations.length,
        settlementCount: result.settlements.length,
      },
    })

    return {
      ...result,
      idempotent: false,
    }
  })
}