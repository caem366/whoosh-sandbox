import { timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { pgTable } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
