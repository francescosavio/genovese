import { describe, expect, test } from 'vitest'
import type { Transaction } from './transaction'
import {
  countByView,
  filterTransactions,
  merchantsOf,
} from './transaction-filter'

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.random().toString(36),
    date: '2026-08-21',
    amount: -59.55,
    rawDescription: 'Albert Heijn',
    merchant: 'albert heijn',
    category: 'Food',
    subcategory: 'Groceries',
    account: 'NL00INGB0000000000',
    sourceBank: 'ing',
    type: 'card_payment',
    notes: '',
    ...over,
  }
}

describe('views', () => {
  const data = [
    tx({ merchant: 'albert heijn' }),
    tx({ merchant: 'bar luna', category: null, subcategory: null }),
  ]

  test('all shows everything', () => {
    expect(filterTransactions(data, 'all')).toHaveLength(2)
  })

  test('uncategorised shows only the rows still to decide', () => {
    expect(
      filterTransactions(data, 'uncategorised').map((t) => t.merchant),
    ).toEqual(['bar luna'])
  })

  test('the counts match what each view returns', () => {
    expect(countByView(data)).toEqual({ all: 2, uncategorised: 1 })
  })
})

describe('search', () => {
  const data = [
    tx({ merchant: 'albert heijn', rawDescription: 'Albert Heijn' }),
    tx({
      merchant: 'acme b v',
      rawDescription: 'Acme B.V.',
      category: 'Work',
      subcategory: null,
    }),
  ]

  test.each([
    ['albert', ['albert heijn']],
    ['ACME', ['acme b v']],
    ['work', ['acme b v']],
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

describe('merchants of a selection', () => {
  const data = [
    tx({ id: 'a', merchant: 'bar luna' }),
    tx({ id: 'b', merchant: 'bar luna' }),
    tx({ id: 'c', merchant: 'cafe nord' }),
    tx({ id: 'd', merchant: null }),
    tx({ id: 'e', merchant: 'not picked' }),
  ]

  test('each merchant once, however many of its rows were picked', () => {
    expect(merchantsOf(data, new Set(['a', 'b', 'c']))).toEqual([
      'bar luna',
      'cafe nord',
    ])
  })

  test('a row without a merchant contributes nothing', () => {
    expect(merchantsOf(data, new Set(['d']))).toEqual([])
  })

  test('an id no longer on screen is ignored', () => {
    expect(merchantsOf(data, new Set(['gone']))).toEqual([])
  })
})
