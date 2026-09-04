import { describe, expect, it } from 'vitest'
import {
  assertIntegerCents,
  assertPositiveCents,
  formatCents,
  splitEvenly,
} from './money.js'

describe('money utilities', () => {
  it('splits $200 equally between four members', () => {
    expect(splitEvenly(20_000, 4)).toEqual([5_000, 5_000, 5_000, 5_000])
  })

  it('assigns leftover cents deterministically', () => {
    const allocations = splitEvenly(10_001, 4)

    expect(allocations).toEqual([2_501, 2_500, 2_500, 2_500])
    expect(allocations.reduce((total, amount) => total + amount, 0)).toBe(10_001)
  })

  it('formats integer cents for display', () => {
    expect(formatCents(20_000)).toBe('$200.00')
  })

  it('rejects decimal cents', () => {
    expect(() => assertIntegerCents(10.5)).toThrow()
  })

  it('rejects zero as a positive payment amount', () => {
    expect(() => assertPositiveCents(0)).toThrow()
  })

  it('rejects negative payment amounts', () => {
    expect(() => assertPositiveCents(-1)).toThrow()
  })
})