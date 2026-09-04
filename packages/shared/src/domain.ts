/** Monetary values are always integer cents; never pass display dollars to domain code. */
export type MoneyCents = number

/** The MVP operates in a single simulated currency. */
export type Currency = 'CAD'

export type SettlementStatus = 'pending' | 'processing' | 'settled' | 'failed'

export type SplitMethod = 'equal' | 'custom'
