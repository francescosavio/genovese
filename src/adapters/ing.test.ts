import { describe, expect, test } from 'vitest'
import { adapterFor } from './index'
import { ingAdapter } from './ing'

const HEADERS =
  '"Date","Name / Description","Account","Counterparty","Code","Debit/credit","Amount (EUR)","Transaction type","Notifications"'

type Row = {
  date?: string
  description?: string
  counterparty?: string
  direction?: string
  amount?: string
  type?: string
  notifications?: string
}

const q = (value: string) => `"${value}"`

function row(r: Row = {}): string {
  return [
    r.date ?? '20260821',
    r.description ?? 'Albert Heijn',
    'NL77INGB0111635837',
    r.counterparty ?? 'NL04ADYB2017400157',
    'IW',
    r.direction ?? 'Debit',
    r.amount ?? '59,55',
    r.type ?? 'iDEAL | Wero',
    r.notifications ?? 'Reference: 7180314110778858',
  ]
    .map(q)
    .join(',')
}

const csv = (...rows: string[]) => [HEADERS, ...rows].join('\n')

function parseOne(r: Row = {}) {
  const [tx] = ingAdapter.parse(csv(row(r))).transactions
  if (!tx) throw new Error('expected exactly one transaction')
  return tx
}

describe('detect', () => {
  test('picks ING out of a quoted header row', () => {
    expect(adapterFor(csv(row()))?.id).toBe('ing')
  })

  test('does not mistake a Revolut export for ING', () => {
    const revolut =
      'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\n' +
      'Card Payment,Current,2026-09-01 12:00:00,2026-09-02 09:00:00,Albert Heijn,-12.34,0.00,EUR,COMPLETED,100.00'
    expect(adapterFor(revolut)?.id).toBe('revolut')
  })
})

// ING writes a positive number in every row and puts the direction in its own
// column. Miss that and the app sees no spending at all.
describe('direction', () => {
  test('a debit is money out', () => {
    expect(parseOne({ direction: 'Debit', amount: '59,55' }).amountRaw).toBe(
      -59.55,
    )
  })

  test('a credit is money in', () => {
    expect(parseOne({ direction: 'Credit', amount: '5,93' }).amountRaw).toBe(
      5.93,
    )
  })

  test('a row with no direction is reported, not guessed at', () => {
    const { transactions, skipped } = ingAdapter.parse(
      csv(row({ direction: '' })),
    )
    expect(transactions).toHaveLength(0)
    expect(skipped[0]?.reason).toBe('unparsable')
  })
})

describe('Dutch number format', () => {
  test.each([
    ['59,55', -59.55],
    ['1.358,00', -1358],
    ['4.140,36', -4140.36],
    ['3,55', -3.55],
  ])('%j parses to %s', (amount, expected) => {
    expect(parseOne({ amount }).amountRaw).toBe(expected)
  })
})

describe('dates', () => {
  test('YYYYMMDD becomes ISO', () => {
    expect(parseOne({ date: '20260831' }).date).toBe('2026-08-31')
  })

  test('an unparsable date is skipped rather than stored wrong', () => {
    const { transactions, skipped } = ingAdapter.parse(
      csv(row({ date: '31-08-2026' })),
    )
    expect(transactions).toHaveLength(0)
    expect(skipped[0]?.reason).toBe('unparsable')
  })
})

describe('type mapping', () => {
  test.each([
    ['iDEAL | Wero', 'card_payment'],
    ['Payment terminal', 'card_payment'],
    ['Transfer', 'transfer'],
    ['Online Banking', 'transfer'],
    ['SEPA direct debit', 'transfer'],
    ['Various', 'fee'],
    ['Something ING invents later', 'other'],
  ])('%j becomes %j', (type, expected) => {
    expect(parseOne({ type }).type).toBe(expected)
  })
})

// ING has no time of day, so date + amount + description is not unique.
describe('identity', () => {
  test('two identical same-day rows stay two transactions', () => {
    const { transactions } = ingAdapter.parse(
      csv(
        row({ notifications: 'Reference: AAA' }),
        row({ notifications: 'Reference: BBB' }),
      ),
    )
    expect(transactions).toHaveLength(2)
    expect(transactions[0]?.id).not.toBe(transactions[1]?.id)
  })

  test('re-importing the same statement produces the same ids', () => {
    const statement = csv(row(), row({ amount: '9,99' }))
    expect(ingAdapter.parse(statement).transactions.map((t) => t.id)).toEqual(
      ingAdapter.parse(statement).transactions.map((t) => t.id),
    )
  })
})

describe('nothing is classified by guesswork', () => {
  test.each([
    ['MX3D B.V.', 'Credit', '4.140,36'],
    ['Albert Heijn', 'Credit', '5,93'],
    ['Francesco Savio', 'Debit', '500,00'],
  ])('%j %j %j arrives uncategorised', (description, direction, amount) => {
    expect(parseOne({ description, direction, amount }).category).toBeNull()
  })
})
