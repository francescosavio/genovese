import { describe, expect, test } from 'vitest'
import { revolutAdapter } from './revolut'

const HEADERS =
  'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance'

type Row = {
  type?: string
  product?: string
  started?: string
  completed?: string
  description?: string
  amount?: string
  fee?: string
  currency?: string
  state?: string
}

function row(r: Row = {}): string {
  return [
    r.type ?? 'Card Payment',
    r.product ?? 'Current',
    r.started ?? '2026-09-01 12:00:00',
    r.completed ?? '2026-09-02 09:00:00',
    r.description ?? 'Albert Heijn',
    r.amount ?? '-12.34',
    r.fee ?? '0.00',
    r.currency ?? 'EUR',
    r.state ?? 'COMPLETED',
    '100.00',
  ].join(',')
}

const csv = (...rows: string[]) => [HEADERS, ...rows].join('\n')

function parseOne(r: Row = {}) {
  const { transactions } = revolutAdapter.parse(csv(row(r)))
  const [tx] = transactions
  if (!tx) throw new Error('expected exactly one transaction')
  return tx
}

describe('detect', () => {
  test('accepts a real Revolut header', () => {
    expect(revolutAdapter.detect(HEADERS.split(','))).toBe(true)
  })

  test('accepts an export without the Fee column', () => {
    const headers = HEADERS.split(',').filter((h) => h !== 'Fee')
    expect(revolutAdapter.detect(headers)).toBe(true)
  })

  test('rejects another bank', () => {
    expect(revolutAdapter.detect(['Date', 'Name', 'Amount', 'IBAN'])).toBe(
      false,
    )
  })
})

describe('type mapping', () => {
  test.each([
    ['Card Payment', 'card_payment'],
    ['CARD_PAYMENT', 'card_payment'],
    ['Card Refund', 'card_payment'],
    ['Transfer', 'transfer'],
    ['Topup', 'topup'],
    ['TOPUP', 'topup'],
    ['Exchange', 'exchange'],
    ['Atm', 'atm'],
    ['Something Revolut Invents In 2027', 'other'],
  ])('%s becomes %s', (raw, expected) => {
    expect(parseOne({ type: raw }).type).toBe(expected)
  })
})

describe('exclusions', () => {
  test('a topup is money from my own bank, not income', () => {
    const tx = parseOne({ type: 'Topup', amount: '500.00' })
    expect(tx).toMatchObject({
      excluded: true,
      exclusionReason: 'internal_transfer',
    })
  })

  test('a non-EUR row is kept but excluded, with its amount intact', () => {
    const tx = parseOne({ currency: 'USD', amount: '-20.00' })
    expect(tx).toMatchObject({
      excluded: true,
      exclusionReason: 'non_eur',
      currency: 'USD',
      amountRaw: -20,
      amountEur: null,
    })
  })

  test('an ordinary card payment is not excluded', () => {
    expect(parseOne()).toMatchObject({ excluded: false, exclusionReason: null })
  })
})

describe('skipped rows', () => {
  test.each(['PENDING', 'REVERTED', 'DECLINED'])(
    '%s never becomes a transaction',
    (state) => {
      const { transactions, skipped } = revolutAdapter.parse(
        csv(row({ state })),
      )
      expect(transactions).toHaveLength(0)
      expect(skipped).toEqual([
        {
          reason: 'not_completed',
          detail: state,
          rawDescription: 'Albert Heijn',
        },
      ])
    },
  )

  test('a malformed date is reported, not silently dropped', () => {
    const { transactions, skipped } = revolutAdapter.parse(
      csv(row({ started: '01/09/2026' })),
    )
    expect(transactions).toHaveLength(0)
    expect(skipped[0]?.reason).toBe('unparsable')
  })
})

describe('fields', () => {
  test('date comes from Started Date, not Completed Date', () => {
    const tx = parseOne({
      started: '2026-08-31 17:49:18',
      completed: '2026-09-01 11:33:59',
    })
    expect(tx.date).toBe('2026-08-31')
  })

  test('the raw description is preserved for normalisation later', () => {
    const tx = parseOne({ description: 'CCV*ALBERTHEIJN 1234 AMSTERDAM NLD' })
    expect(tx.rawDescription).toBe('CCV*ALBERTHEIJN 1234 AMSTERDAM NLD')
    expect(tx.merchant).toBeNull()
  })

  test('a fresh transaction is uncategorized, which is not Other', () => {
    expect(parseOne()).toMatchObject({ category: null, subcategory: null })
  })
})

describe('identity', () => {
  test('two identical purchases on the same day stay two transactions', () => {
    const { transactions } = revolutAdapter.parse(
      csv(
        row({
          started: '2026-09-01 09:15:00',
          description: 'Bar Cadaq',
          amount: '-3.50',
        }),
        row({
          started: '2026-09-01 16:42:00',
          description: 'Bar Cadaq',
          amount: '-3.50',
        }),
      ),
    )
    expect(transactions).toHaveLength(2)
    expect(transactions[0]?.id).not.toBe(transactions[1]?.id)
  })

  test('re-importing the same statement produces the same ids', () => {
    const statement = csv(
      row(),
      row({ description: 'Amazon', amount: '-9.99' }),
    )
    const first = revolutAdapter.parse(statement).transactions.map((t) => t.id)
    const second = revolutAdapter.parse(statement).transactions.map((t) => t.id)
    expect(second).toEqual(first)
  })

  test('a different amount is a different transaction', () => {
    expect(parseOne({ amount: '-12.34' }).id).not.toBe(
      parseOne({ amount: '-12.35' }).id,
    )
  })
})
