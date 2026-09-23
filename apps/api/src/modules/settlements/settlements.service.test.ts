import { describe, expect, it } from 'vitest'

import { getSimulationFailureReason } from './settlements.service.js'

describe('settlement simulation failures', () => {
  it('returns a failure reason only for failed simulations', () => {
    expect(getSimulationFailureReason('success')).toBeUndefined()
    expect(getSimulationFailureReason('forced_failure')).toBe(
      'Sandbox forced settlement failure',
    )
    expect(getSimulationFailureReason('insufficient_funds')).toBe(
      'Sandbox simulated insufficient funds',
    )
  })
})
