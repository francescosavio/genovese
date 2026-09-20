import { describe, expect, test } from 'vitest'
import { CATEGORY_OPTIONS, searchCategories } from './category-options'
import { coverage, groupByMerchant } from './merchant-groups'
import type { Transaction } from './transaction'

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.random().toString(36),
    date: '2026-09-01',
    currency: 'EUR',
    amountRaw: -10,
    amountEur: -10,
    rawDescription: 'Albert Heijn',
    merchant: 'albert heijn',
    category: null,
    subcategory: null,
    account: 'Current',
    sourceBank: 'revolut',
    type: 'card_payment',
    excluded: false,
    exclusionReason: null,
    notes: '',
    ...over,
  }
}

describe('grouping', () => {
  test('collapses a merchant into one row with its count and total', () => {
    const [group] = groupByMerchant([
      tx({ amountEur: -10 }),
      tx({ amountEur: -46.36 }),
    ])
    expect(group).toMatchObject({
      merchant: 'albert heijn',
      count: 2,
      totalEur: -56.36,
    })
  })

  test('excluded rows are neither work nor coverage', () => {
    expect(
      groupByMerchant([
        tx({
          merchant: 'amazon us',
          excluded: true,
          exclusionReason: 'non_eur',
        }),
      ]),
    ).toEqual([])
  })

  test('rows without a merchant cannot be grouped', () => {
    expect(groupByMerchant([tx({ merchant: null })])).toEqual([])
  })

  test('a merchant counts as categorised if any of its rows is', () => {
    const [group] = groupByMerchant([
      tx({ category: null }),
      tx({ category: 'Food', subcategory: 'Groceries' }),
    ])
    expect(group).toMatchObject({ category: 'Food', subcategory: 'Groceries' })
  })
})

describe('ordering by impact', () => {
  test('uncategorised first, then by money at stake', () => {
    const order = groupByMerchant([
      tx({ merchant: 'big known', amountEur: -900, category: 'Food' }),
      tx({ merchant: 'small unknown', amountEur: -5 }),
      tx({ merchant: 'big unknown', amountEur: -300 }),
    ]).map((g) => g.merchant)

    expect(order).toEqual(['big unknown', 'small unknown', 'big known'])
  })

  test('income sorts by size too, not below every expense', () => {
    const order = groupByMerchant([
      tx({ merchant: 'refund', amountEur: 500 }),
      tx({ merchant: 'coffee', amountEur: -3 }),
    ]).map((g) => g.merchant)

    expect(order).toEqual(['refund', 'coffee'])
  })
})

describe('coverage', () => {
  test('is measured in transactions, not merchants', () => {
    expect(
      coverage([
        tx({ merchant: 'albert heijn', category: 'Food' }),
        tx({ merchant: 'albert heijn', category: 'Food' }),
        tx({ merchant: 'bar cadaq', category: null }),
      ]),
    ).toEqual({ categorised: 2, total: 3, percent: 67 })
  })

  test('excluded rows do not drag the bar down', () => {
    expect(
      coverage([
        tx({ category: 'Food' }),
        tx({ merchant: 'amazon us', excluded: true }),
      ]),
    ).toMatchObject({ percent: 100 })
  })

  test('an empty set is 0%, not NaN', () => {
    expect(coverage([])).toEqual({ categorised: 0, total: 0, percent: 0 })
  })
})

describe('category search', () => {
  test('a category is offered with and without its sub-categories', () => {
    const labels = CATEGORY_OPTIONS.map((o) => o.label)
    expect(labels).toContain('Food')
    expect(labels).toContain('Food › Groceries')
    expect(labels).toContain('Other')
  })

  test('the bare category ranks above its own sub-categories', () => {
    expect(
      searchCategories('food')
        .map((o) => o.label)
        .slice(0, 2),
    ).toEqual(['Food', 'Food › Groceries'])
  })

  test('picking a bare category means no sub-category, not an empty one', () => {
    const [food] = searchCategories('food')
    expect(food).toEqual({ category: 'Food', subcategory: null, label: 'Food' })
  })

  test('an empty query offers everything', () => {
    expect(searchCategories('  ')).toHaveLength(CATEGORY_OPTIONS.length)
  })

  test.each([
    ['groc', 'Food › Groceries'],
    ['fgroc', 'Food › Groceries'],
    ['fuel', 'Car › Fuel'],
    ['sub', 'Subscription'],
    // A typed run beats the same letters scattered: "trai" is in Train, but
    // t-r-a-i can also be picked out of "Transportation > Bike".
    ['trai', 'Transportation › Train'],
    ['bike', 'Transportation › Bike'],
  ])('%j finds %j first', (query, label) => {
    expect(searchCategories(query)[0]?.label).toBe(label)
  })

  test('a query nothing matches returns nothing rather than a bad guess', () => {
    expect(searchCategories('zzzz')).toEqual([])
  })
})
