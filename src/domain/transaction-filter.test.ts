import { describe, expect, test } from 'vitest'
import type { Transaction } from './transaction'
import { countByView, filterTransactions } from './transaction-filter'

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.random().toString(36),
    date: '2026-08-21',
    amount: -59.55,
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
  ]

  test('all shows everything', () => {
    expect(filterTransactions(data, 'all')).toHaveLength(2)
  })

  test('uncategorised shows only the rows still to decide', () => {
    expect(
      filterTransactions(data, 'uncategorised').map((t) => t.merchant),
    ).toEqual(['bar cadaq'])
  })

  test('the counts match what each view returns', () => {
    expect(countByView(data)).toEqual({ all: 2, uncategorised: 1 })
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
      tx({ merchant: 'albert heijn', category: null, subcategory: null }),
      tx({ merchant: 'albert heijn' }),
    ]
    expect(filterTransactions(rows, 'uncategorised', 'albert')).toHaveLength(1)
  })

  test('a query nothing matches returns nothing', () => {
    expect(filterTransactions(data, 'all', 'zzzz')).toEqual([])
  })

  test('whitespace is not a query', () => {
    expect(filterTransactions(data, 'all', '   ')).toHaveLength(2)
  })
})
