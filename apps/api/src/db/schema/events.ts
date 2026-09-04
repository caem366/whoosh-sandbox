import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

import { groups } from './groups.js'
import { ledgerJournals } from './ledger.js'
import { users } from './users.js'

export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'restrict' }),
    journalId: uuid('journal_id').references(() => ledgerJournals.id, { onDelete: 'restrict' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
    aggregateType: varchar('aggregate_type', { length: 80 }).notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: varchar('event_type', { length: 120 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    payload: jsonb('payload').notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('events_group_occurred_at_index').on(table.groupId, table.occurredAt),
    index('events_aggregate_index').on(table.aggregateType, table.aggregateId),
    uniqueIndex('events_idempotency_key_unique').on(table.idempotencyKey),
  ],
)
