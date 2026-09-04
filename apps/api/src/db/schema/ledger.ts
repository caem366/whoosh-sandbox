import {
  bigint,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { groupMembers, groups } from './groups.js'

export const ledgerAccountType = pgEnum('ledger_account_type', [
  'member_wallet',
  'merchant_clearing',
  'member_expense',
  'member_payable',
  'member_receivable',
  'system_funding',
])

export const ledgerNormalBalance = pgEnum('ledger_normal_balance', ['debit', 'credit'])
export const ledgerJournalStatus = pgEnum('ledger_journal_status', ['draft', 'posted', 'reversed'])
export const ledgerEntryDirection = pgEnum('ledger_entry_direction', ['debit', 'credit'])

export const ledgerAccounts = pgTable(
  'ledger_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'restrict' }),
    groupMemberId: uuid('group_member_id').references(() => groupMembers.id, {
      onDelete: 'restrict',
    }),
    type: ledgerAccountType('type').notNull(),
    normalBalance: ledgerNormalBalance('normal_balance').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('ledger_accounts_group_id_index').on(table.groupId)],
)

export const ledgerJournals = pgTable(
  'ledger_journals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'restrict' }),
    status: ledgerJournalStatus('status').notNull().default('draft'),
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    description: varchar('description', { length: 255 }).notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('ledger_journals_group_created_at_index').on(table.groupId, table.createdAt),
    uniqueIndex('ledger_journals_idempotency_key_unique').on(table.idempotencyKey),
  ],
)

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    journalId: uuid('journal_id')
      .notNull()
      .references(() => ledgerJournals.id, { onDelete: 'restrict' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: 'restrict' }),
    direction: ledgerEntryDirection('direction').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('ledger_entries_journal_id_index').on(table.journalId),
    index('ledger_entries_account_id_index').on(table.accountId),
  ],
)
