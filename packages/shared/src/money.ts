import type { MoneyCents } from './domain.js'

export function assertIntegerCents(
  value: number,
  fieldName = 'amount_cents',
): asserts value is MoneyCents {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${fieldName} must be a safe integer number of cents`)
  }
}

export function assertPositiveCents(
  value: number,
  fieldName = 'amount_cents',
): asserts value is MoneyCents {
  assertIntegerCents(value, fieldName)

  if (value <= 0) {
    throw new TypeError(`${fieldName} must be greater than zero`)
  }
}

export function addCents(...amounts: MoneyCents[]): MoneyCents {
  const result = amounts.reduce((total, amount) => {
    assertIntegerCents(amount)
    return total + amount
  }, 0)

  assertIntegerCents(result, 'result')
  return result
}

export function subtractCents(a: MoneyCents, b: MoneyCents): MoneyCents {
  assertIntegerCents(a, 'a')
  assertIntegerCents(b, 'b')

  const result = a - b
  assertIntegerCents(result, 'result')
  return result
}

export function splitEvenly(total: MoneyCents, parts: number): MoneyCents[] {
  assertPositiveCents(total, 'total')

  if (!Number.isSafeInteger(parts) || parts <= 0) {
    throw new TypeError('parts must be a positive safe integer')
  }

  const baseAmount = Math.floor(total / parts)
  const remainder = total % parts
  const result = Array<MoneyCents>(parts).fill(baseAmount)

  for (let i = 0; i < remainder; i+= 1) {
    result[i]! += 1
  }

  return result
}

export function formatCents(value: MoneyCents, currency = 'CAD'): string {
  assertIntegerCents(value)

  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(value / 100)
}