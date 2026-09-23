import { describe, expect, it } from 'vitest'

import { buildMemberAccountRows } from './groups.service.js'

describe('member ledger account setup', () => {
  it('creates the standard accounts for a new member', () => {
    expect(buildMemberAccountRows('group-1', 'member-1')).toEqual([
      {
        groupId: 'group-1',
        groupMemberId: 'member-1',
        type: 'member_wallet',
        normalBalance: 'debit',
        currency: 'CAD',
      },
      {
        groupId: 'group-1',
        groupMemberId: 'member-1',
        type: 'member_expense',
        normalBalance: 'debit',
        currency: 'CAD',
      },
      {
        groupId: 'group-1',
        groupMemberId: 'member-1',
        type: 'member_payable',
        normalBalance: 'credit',
        currency: 'CAD',
      },
      {
        groupId: 'group-1',
        groupMemberId: 'member-1',
        type: 'member_receivable',
        normalBalance: 'debit',
        currency: 'CAD',
      },
    ])
  })
})
