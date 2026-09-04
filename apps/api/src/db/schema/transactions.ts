import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { groupMembers, groups } from './groups.js'

export const transactionStatus = pgEnum('transaction_status', [
  'posted',
  'failed',
  'partially_refunded',
  'refunded',
])

export const transactionSplitMethod = pgEnum('transaction_split_method', [
  'equal',
  'custom',
])

export const settlementStatus = pgEnum('settlement_status', [
  'pending',
  'processing',
  'settled',
  'failed',
  'cancelled',
])

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'restrict' }),

    payerMemberId: uuid('payer_member_id')
      .notNull()
      .references(() => groupMembers.id, { onDelete: 'restrict' }),

    merchant: varchar('merchant', { length: 160 }).notNull(),
    totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('CAD'),

    splitMethod: transactionSplitMethod('split_method').notNull(),
    status: transactionStatus('status').notNull().default('posted'),

    idempotencyKey: varchar('idempotency_key', { length: 255 }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('transactions_group_created_at_index').on(
      table.groupId,
      table.createdAt,
    ),
    uniqueIndex('transactions_idempotency_key_unique').on(
      table.idempotencyKey,
    ),
  ],
)

export const allocations = pgTable(
  'allocations',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'restrict' }),

    responsibleMemberId: uuid('responsible_member_id')
      .notNull()
      .references(() => groupMembers.id, { onDelete: 'restrict' }),

    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('allocations_transaction_id_index').on(table.transactionId),
    uniqueIndex('allocations_transaction_member_unique').on(
      table.transactionId,
      table.responsibleMemberId,
    ),
  ],
)

export const settlements = pgTable(
  'settlements',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'restrict' }),

    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'restrict' }),

    debtorMemberId: uuid('debtor_member_id')
      .notNull()
      .references(() => groupMembers.id, { onDelete: 'restrict' }),

    creditorMemberId: uuid('creditor_member_id')
      .notNull()
      .references(() => groupMembers.id, { onDelete: 'restrict' }),

    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('CAD'),

    status: settlementStatus('status').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    failureReason: text('failure_reason'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    settledAt: timestamp('settled_at', { withTimezone: true }),
  },
  (table) => [
    index('settlements_group_status_index').on(table.groupId, table.status),
    index('settlements_debtor_status_index').on(
      table.debtorMemberId,
      table.status,
    ),
    uniqueIndex('settlements_transaction_debtor_creditor_unique').on(
      table.transactionId,
      table.debtorMemberId,
      table.creditorMemberId,
    ),
  ],
)