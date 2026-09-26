import { describe, expect, test } from 'vitest'
import type { Transaction } from './transaction'
import { countByView, filterTransactions } from './transaction-filter'

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.random().toString(36),
    date: '2026-08-21',
    currency: 'EUR',
    amountRaw: -59.55,
    amountEur: -59.55,
    rawDescription: 'Albert Heijn',
    merchant: 'albert heijn',
    category: 'Food',
    subcategory: 'Groceries',
    account: 'NL77INGB0111635837',
    sourceBank: 'ing',
    type: 'card_payment',
    notes: '',
    ...over,
  }
}

describe('views', () => {
  const data = [
    tx({ merchant: 'albert heijn' }),
    tx({ merchant: 'bar cadaq', category: null, subcategory: null }),
    tx({
      merchant: 'amazon us',
      currency: 'USD',
      amountEur: null,
      category: null,
      subcategory: null,
    }),
  ]

  test('all shows everything', () => {
    expect(filterTransactions(data, 'all')).toHaveLength(3)
  })

  test('excluded shows only the rows not in EUR', () => {
    expect(filterTransactions(data, 'excluded').map((t) => t.merchant)).toEqual(
      ['amazon us'],
    )
  })

  // Otherwise the tab and the coverage bar would disagree about what is left.
  test('a non-EUR row is never counted as uncategorised work', () => {
    expect(
      filterTransactions(data, 'uncategorised').map((t) => t.merchant),
    ).toEqual(['bar cadaq'])
  })

  test('the counts match what each view returns', () => {
    expect(countByView(data)).toEqual({
      all: 3,
      uncategorised: 1,
      excluded: 1,
    })
  })
})

describe('search', () => {
  const data = [
    tx({ merchant: 'albert heijn', rawDescription: 'Albert Heijn' }),
    tx({
      merchant: 'mx3d b v',
      rawDescription: 'MX3D B.V.',
      category: 'Work',
      subcategory: null,
    }),
  ]

  test.each([
    ['albert', ['albert heijn']],
    ['MX3D', ['mx3d b v']],
    ['work', ['mx3d b v']],
    ['groceries', ['albert heijn']],
  ])('%j finds %j', (query, expected) => {
    expect(
      filterTransactions(data, 'all', query).map((t) => t.merchant),
    ).toEqual(expected)
  })

  test('search and view narrow together', () => {
    const rows = [
      tx({ merchant: 'albert heijn', amountEur: null }),
      tx({ merchant: 'albert heijn' }),
    ]
    expect(filterTransactions(rows, 'excluded', 'albert')).toHaveLength(1)
  })

  test('a query nothing matches returns nothing', () => {
    expect(filterTransactions(data, 'all', 'zzzz')).toEqual([])
  })

  test('whitespace is not a query', () => {
    expect(filterTransactions(data, 'all', '   ')).toHaveLength(2)
  })
})
