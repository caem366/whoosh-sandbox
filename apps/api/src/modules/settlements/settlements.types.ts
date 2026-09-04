export type SettlementSimulation =
  | 'success'
  | 'forced_failure'
  | 'insufficient_funds'

export interface ProcessSettlementInput {
  settlementId: string
  simulation?: SettlementSimulation
  idempotencyKey?: string
}

