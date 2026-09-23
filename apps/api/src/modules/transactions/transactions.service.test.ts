import { describe, expect, it } from 'vitest'

import {
  buildEqualAllocationPlan,
  buildSettlementPlan,
} from './transactions.service.js'

describe('transaction allocation planner', () => {
  it('splits $200 equally across four members', () => {
    expect(
      buildEqualAllocationPlan(20_000, [
        'caelan',
        'maya',
        'sarah',
        'jessica',
      ]),
    ).toEqual([
      { responsibleMemberId: 'caelan', amountCents: 5_000 },
      { responsibleMemberId: 'maya', amountCents: 5_000 },
      { responsibleMemberId: 'sarah', amountCents: 5_000 },
      { responsibleMemberId: 'jessica', amountCents: 5_000 },
    ])
  })

  it('assigns leftover cents predictably', () => {
    expect(
      buildEqualAllocationPlan(10_001, ['caelan', 'maya', 'sarah', 'jessica']),
    ).toEqual([
      { responsibleMemberId: 'caelan', amountCents: 2_501 },
      { responsibleMemberId: 'maya', amountCents: 2_500 },
      { responsibleMemberId: 'sarah', amountCents: 2_500 },
      { responsibleMemberId: 'jessica', amountCents: 2_500 },
    ])
  })

  it('rejects duplicate participants', () => {
    expect(() =>
      buildEqualAllocationPlan(20_000, ['caelan', 'maya', 'maya']),
    ).toThrow('A participant can only appear once')
  })
})

describe('transaction settlement planner', () => {
  it('creates obligations for participants other than the payer', () => {
    expect(
      buildSettlementPlan('caelan', [
        { responsibleMemberId: 'caelan', amountCents: 5_000 },
        { responsibleMemberId: 'maya', amountCents: 5_000 },
        { responsibleMemberId: 'sarah', amountCents: 5_000 },
      ]),
    ).toEqual([
      {
        debtorMemberId: 'maya',
        creditorMemberId: 'caelan',
        amountCents: 5_000,
      },
      {
        debtorMemberId: 'sarah',
        creditorMemberId: 'caelan',
        amountCents: 5_000,
      },
    ])
  })
})
