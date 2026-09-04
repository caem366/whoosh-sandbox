import { and, eq } from 'drizzle-orm'
import {db} from '../../db/client.js'

import { assertIntegerCents } from '@whoosh/shared'

import { postJournal } from '../ledger/ledger.service.js'

import {
  groupMembers,
  groups,
  ledgerAccounts,
  ledgerEntries,
  ledgerJournals,
  settlements,
  transactions,
  users,
} from '../../db/schema/index.js'

export interface CreateGroupInput {
    name: string
    creatorName: string
}

export async function createGroup(input: CreateGroupInput) {
const name = input.name.trim()
const creatorName = input.creatorName.trim()

if (name.length === 0) {
    throw new TypeError('Group name is required')
}

if (creatorName.length === 0) {
    throw new TypeError('Creator name is required')
}

return db.transaction(async (transaction) => {
    const [creator] = await transaction
        .insert(users)
        .values({ displayName: creatorName })
        .returning()

    if (!creator){
         throw new Error('Could not create user')
    }

    const [group] = await transaction
        .insert(groups)
        .values({ 
        name,
        currency: 'CAD',
        createdByUserId: creator.id,
        })
        .returning()
    
     if (!group) {
      throw new Error('Could not create group')
    }

    const [member] = await transaction
      .insert(groupMembers)
      .values({
        groupId: group.id,
        userId: creator.id,
        status: 'active',
      })
      .returning()


    if (!member) {
        throw new Error('Could not create group member') 
    }

   const memberAccounts = await transaction
  .insert(ledgerAccounts)
  .values([
    {
      groupId: group.id,
      groupMemberId: member.id,
      type: 'member_wallet',
      normalBalance: 'debit',
      currency: 'CAD',
    },
    {
      groupId: group.id,
      groupMemberId: member.id,
      type: 'member_expense',
      normalBalance: 'debit',
      currency: 'CAD',
    },
    {
      groupId: group.id,
      groupMemberId: member.id,
      type: 'member_payable',
      normalBalance: 'credit',
      currency: 'CAD',
    },
    {
      groupId: group.id,
      groupMemberId: member.id,
      type: 'member_receivable',
      normalBalance: 'debit',
      currency: 'CAD',
    },
  ])
  .returning()

const [fundingAccount] = await transaction
  .insert(ledgerAccounts)
  .values({
    groupId: group.id,
    type: 'system_funding',
    normalBalance: 'credit',
    currency: 'CAD',
  })
  .returning()

if (!fundingAccount) {
  throw new Error('Could not create system funding account')
}

return {
  group,
  creator,
  member,
  memberAccounts,
  fundingAccount,
}
})
}

export interface AddGroupMemberInput {
  groupId: string
  displayName: string
}

export async function addGroupMember(input: AddGroupMemberInput) {
  const displayName = input.displayName.trim()

  if (displayName.length === 0) {
    throw new TypeError('Member name is required')
  }

  return db.transaction(async (transaction) => {
    const [group] = await transaction
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.id, input.groupId))
      .limit(1)

    if (!group) {
      throw new TypeError('Group not found')
    }

    const [user] = await transaction
      .insert(users)
      .values({ displayName })
      .returning()

    if (!user) {
      throw new Error('Could not create user')
    }

    const [member] = await transaction
      .insert(groupMembers)
      .values({
        groupId: group.id,
        userId: user.id,
        status: 'active',
      })
      .returning()

    if (!member) {
      throw new Error('Could not create group member')
    }

    const accounts = await transaction
      .insert(ledgerAccounts)
      .values([
        {
          groupId: group.id,
          groupMemberId: member.id,
          type: 'member_wallet',
          normalBalance: 'debit',
          currency: 'CAD',
        },
        {
          groupId: group.id,
          groupMemberId: member.id,
          type: 'member_expense',
          normalBalance: 'debit',
          currency: 'CAD',
        },
        {
          groupId: group.id,
          groupMemberId: member.id,
          type: 'member_payable',
          normalBalance: 'credit',
          currency: 'CAD',
        },
        {
          groupId: group.id,
          groupMemberId: member.id,
          type: 'member_receivable',
          normalBalance: 'debit',
          currency: 'CAD',
        },
      ])
      .returning()

    return { user, member, accounts }
  })
}

export interface FundMemberWalletInput {
  groupId: string
  memberId: string
  amountCents: number
  idempotencyKey?: string
}

export async function fundMemberWallet(input: FundMemberWalletInput) {
  const [member] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.id, input.memberId),
        eq(groupMembers.groupId, input.groupId),
      ),
    )
    .limit(1)

  if (!member) {
    throw new TypeError('Member not found in this group')
  }

  const accounts = await db
    .select({
      id: ledgerAccounts.id,
      groupMemberId: ledgerAccounts.groupMemberId,
      type: ledgerAccounts.type,
      currency: ledgerAccounts.currency,
    })
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.groupId, input.groupId))

  const walletAccount = accounts.find(
    (account) =>
      account.groupMemberId === member.id && account.type === 'member_wallet',
  )

  const fundingAccount = accounts.find(
    (account) => account.type === 'system_funding',
  )

  if (!walletAccount) {
    throw new TypeError('Member wallet account not found')
  }

  if (!fundingAccount) {
    throw new TypeError('System funding account not found')
  }

  return postJournal({
    groupId: input.groupId,
    description: `Fund simulated wallet for member ${member.id}`,
    idempotencyKey: input.idempotencyKey,
    entries: [
      {
        accountId: walletAccount.id,
        direction: 'debit',
        amountCents: input.amountCents,
        currency: 'CAD',
      },
      {
        accountId: fundingAccount.id,
        direction: 'credit',
        amountCents: input.amountCents,
        currency: 'CAD',
      },
    ],
  })
}

export async function getGroupDetail(groupId: string) {
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)

  if (!group) {
    throw new TypeError('Group not found')
  }

  const members = await db
    .select({
      memberId: groupMembers.id,
      userId: users.id,
      displayName: users.displayName,
      status: groupMembers.status,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))

  const accounts = await db
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.groupId, groupId))

  const entries = await db
    .select({
      accountId: ledgerEntries.accountId,
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
        eq(ledgerJournals.groupId, groupId),
        eq(ledgerJournals.status, 'posted'),
      ),
    )

  const groupSettlements = await db
    .select({
      id: settlements.id,
      transactionId: settlements.transactionId,
      debtorMemberId: settlements.debtorMemberId,
      creditorMemberId: settlements.creditorMemberId,
      merchant: transactions.merchant,
      transactionCreatedAt: transactions.createdAt,
      amountCents: settlements.amountCents,
      currency: settlements.currency,
      status: settlements.status,
      attemptCount: settlements.attemptCount,
      failureReason: settlements.failureReason,
      createdAt: settlements.createdAt,
      settledAt: settlements.settledAt,
    })
    .from(settlements)
    .innerJoin(transactions, eq(settlements.transactionId, transactions.id))
    .where(eq(settlements.groupId, groupId))

  const balanceByAccountId = new Map<string, number>()

  for (const entry of entries) {
    const currentBalance = balanceByAccountId.get(entry.accountId) ?? 0

    const change =
      entry.direction === 'debit'
        ? entry.amountCents
        : -entry.amountCents

    const nextBalance = currentBalance + change
    assertIntegerCents(nextBalance, 'derived account balance')

    balanceByAccountId.set(entry.accountId, nextBalance)
  }

  return {
    group,
    members: members.map((member) => {
      const memberAccounts = accounts
        .filter((account) => account.groupMemberId === member.memberId)
        .map((account) => {
  const rawBalanceCents = balanceByAccountId.get(account.id) ?? 0

  return {
    id: account.id,
    type: account.type,
    normalBalance: account.normalBalance,
    balanceCents:
      account.normalBalance === 'credit'
        ? -rawBalanceCents
        : rawBalanceCents,
  }
})

      const wallet = memberAccounts.find(
        (account) => account.type === 'member_wallet',
      )

      return {
        ...member,
        walletBalanceCents: wallet?.balanceCents ?? 0,
        accounts: memberAccounts,
      }
    }),
    settlements: groupSettlements,
  }
}
