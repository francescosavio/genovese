import { describe, expect, test } from 'vitest'
import {
  ALL,
  UNCATEGORISED,
  averages,
  monthsPresent,
  spendByBucket,
  spendByMonth,
  totals,
  uncategorised,
  yearsPresent,
  spendOverTime,
  runningTotal,
} from './summary'
import type { Transaction } from './transaction'

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.random().toString(36),
    date: '2026-09-01',
    amount: -10,
    rawDescription: 'Albert Heijn',
    merchant: 'albert heijn',
    category: 'Food',
    subcategory: 'Groceries',
    account: 'Current',
    sourceBank: 'revolut',
    type: 'card_payment',
    notes: '',
    ...over,
  }
}

const everything = { period: null, category: ALL } as const

describe('months present', () => {
  test('newest first, deduplicated', () => {
    expect(
      monthsPresent([
        tx({ date: '2026-09-04' }),
        tx({ date: '2024-01-15' }),
        tx({ date: '2026-09-20' }),
      ]),
    ).toEqual(['2026-09', '2024-01'])
  })
})

describe('totals', () => {
  // A refund is money coming back, so it genuinely does reduce what a period
  // cost. Salary and transfers must not, which is what the flow is for.
  test('a refund reduces what the period cost', () => {
    const { spent } = totals(
      [tx({ amount: -100 }), tx({ amount: 30 })],
      everything,
    )
    expect(spent).toBe(70)
  })

  test('salary is income and never cancels out spending', () => {
    expect(
      totals(
        [
          tx({ amount: -40 }),
          tx({ amount: 4140.36, category: 'Salary', subcategory: null }),
        ],
        everything,
      ),
    ).toEqual({ spent: 40, income: 4140.36 })
  })

  test('a transfer is neither spending nor income, in either direction', () => {
    expect(
      totals(
        [
          tx({ amount: -500, category: 'Transfers', subcategory: null }),
          tx({ amount: 200, category: 'Transfers', subcategory: null }),
        ],
        everything,
      ),
    ).toEqual({ spent: 0, income: 0 })
  })

  test('uncategorised money counts as spending until decided', () => {
    expect(
      totals(
        [tx({ amount: -15, category: null, subcategory: null })],
        everything,
      ).spent,
    ).toBe(15)
  })

  test('a month period selects by the transaction date', () => {
    const data = [
      tx({ date: '2026-08-31', amount: -10 }),
      tx({ date: '2026-09-01', amount: -25 }),
    ]
    expect(totals(data, { period: '2026-09', category: ALL }).spent).toBe(25)
  })

  // The period is a date prefix, so a year needs no separate code path.
  test('a year period gathers every month in it', () => {
    const data = [
      tx({ date: '2025-12-31', amount: -10 }),
      tx({ date: '2026-03-01', amount: -25 }),
      tx({ date: '2026-11-04', amount: -5 }),
    ]
    expect(totals(data, { period: '2026', category: ALL }).spent).toBe(30)
  })
})

describe('spend by bucket', () => {
  test('salary and transfers are not slices of spending', () => {
    const ranked = spendByBucket(
      [
        tx({ category: 'Food', amount: -30 }),
        tx({ category: 'Salary', subcategory: null, amount: 4000 }),
        tx({ category: 'Transfers', subcategory: null, amount: -500 }),
      ],
      everything,
    )
    expect(ranked.map((r) => r.bucket)).toEqual(['Food'])
  })

  test('ranks categories by how much left, biggest first', () => {
    const ranked = spendByBucket(
      [
        tx({ category: 'Food', amount: -30 }),
        tx({ category: 'Home', amount: -900 }),
        tx({ category: 'Sport', amount: -50 }),
      ],
      everything,
    )
    expect(ranked.map((r) => r.bucket)).toEqual(['Home', 'Sport', 'Food'])
  })

  test('shares add up to the whole', () => {
    const ranked = spendByBucket(
      [
        tx({ category: 'Food', amount: -25 }),
        tx({ category: 'Home', amount: -75 }),
      ],
      everything,
    )
    expect(ranked.map((r) => r.share)).toEqual([0.75, 0.25])
  })

  // Otherwise the chart's own total is a lie.
  test('uncategorised money is a bucket, not an omission', () => {
    const ranked = spendByBucket(
      [
        tx({ category: 'Food', amount: -10 }),
        tx({ category: null, subcategory: null, amount: -90 }),
      ],
      everything,
    )
    expect(ranked[0]).toMatchObject({ bucket: UNCATEGORISED, total: 90 })
  })

  test('a refund lands in its own category rather than posing as income', () => {
    const ranked = spendByBucket(
      [
        tx({ category: 'Food', amount: -50 }),
        tx({ category: 'Food', amount: 10 }),
      ],
      everything,
    )
    expect(ranked).toEqual([{ bucket: 'Food', total: 40, share: 1 }])
  })

  test('a category can end a period negative, and that is real', () => {
    const [only] = spendByBucket(
      [tx({ category: 'Shopping', amount: 120 })],
      everything,
    )
    expect(only?.total).toBe(-120)
  })

  test('an empty period is empty, not a division by zero', () => {
    expect(spendByBucket([], everything)).toEqual([])
  })
})

describe('spend by month', () => {
  test('is ordered oldest first, because time runs that way on an axis', () => {
    const series = spendByMonth(
      [
        tx({ date: '2026-09-02', amount: -30 }),
        tx({ date: '2026-07-11', amount: -10 }),
        tx({ date: '2026-09-20', amount: -5 }),
      ],
      everything,
    )
    expect(series).toEqual([
      { month: '2026-07', spent: 10 },
      { month: '2026-09', spent: 35 },
    ])
  })

  test('honours a category filter', () => {
    const series = spendByMonth(
      [
        tx({ date: '2026-09-02', category: 'Food', amount: -30 }),
        tx({ date: '2026-09-03', category: 'Home', amount: -900 }),
      ],
      { period: null, category: 'Food' },
    )
    expect(series).toEqual([{ month: '2026-09', spent: 30 }])
  })
})

describe('outstanding work', () => {
  test('counts uncategorised rows and what they are worth', () => {
    expect(
      uncategorised([
        tx({ category: 'Food' }),
        tx({ category: null, amount: -12.5 }),
        tx({ category: null, amount: -7.5 }),
      ]),
    ).toEqual({ count: 2, total: 20 })
  })

  test('an uncategorised refund does not reduce the outstanding amount', () => {
    expect(uncategorised([tx({ category: null, amount: 40 })])).toEqual({
      count: 1,
      total: 0,
    })
  })
})

describe('averages', () => {
  test('divide by the months that have data inside the period', () => {
    const data = [
      tx({ date: '2026-01-05', amount: -100 }),
      tx({ date: '2026-03-05', amount: -200 }),
    ]
    expect(averages(data, { period: '2026', category: ALL })).toEqual({
      months: 2,
      spentPerMonth: 150,
      incomePerMonth: 0,
    })
  })

  test('income is averaged over the same months', () => {
    const data = [
      tx({ date: '2026-01-05', amount: -100 }),
      tx({
        date: '2026-01-25',
        category: 'Salary',
        subcategory: null,
        amount: 3000,
      }),
      tx({ date: '2026-02-05', amount: -100 }),
      tx({
        date: '2026-02-25',
        category: 'Salary',
        subcategory: null,
        amount: 3200,
      }),
    ]
    expect(averages(data, { period: '2026', category: ALL })).toMatchObject({
      months: 2,
      incomePerMonth: 3100,
    })
  })

  test('a single month averages to itself, which is why the UI hides it', () => {
    const data = [tx({ date: '2026-01-05', amount: -100 })]
    expect(averages(data, { period: '2026-01', category: ALL })).toMatchObject({
      months: 1,
      spentPerMonth: 100,
    })
  })

  test('an empty period does not divide by zero', () => {
    expect(averages([], everything)).toEqual({
      months: 0,
      spentPerMonth: 0,
      incomePerMonth: 0,
    })
  })
})

describe('years present', () => {
  test('newest first', () => {
    expect(
      yearsPresent([tx({ date: '2024-05-01' }), tx({ date: '2026-01-01' })]),
    ).toEqual(['2026', '2024'])
  })

  test('months can be narrowed to one year', () => {
    const data = [tx({ date: '2025-06-01' }), tx({ date: '2026-02-01' })]
    expect(monthsPresent(data, '2026')).toEqual(['2026-02'])
  })
})

describe('spend over time', () => {
  // Daily inside a year too, so the cumulative line shows the shape of each
  // month rather than eleven straight segments.
  test('a year is bucketed into every one of its days', () => {
    const points = spendOverTime([tx({ date: '2026-03-04', amount: -30 })], {
      period: '2026',
      category: ALL,
    })
    expect(points).toHaveLength(365)
    expect(points[0]).toEqual({ key: '2026-01-01', spent: 0 })
    expect(points[62]).toEqual({ key: '2026-03-04', spent: 30 })
  })

  test('a leap year has the extra day', () => {
    expect(spendOverTime([], { period: '2028', category: ALL })).toHaveLength(
      366,
    )
  })

  test('a month is bucketed into its real number of days', () => {
    const feb = spendOverTime([], { period: '2026-02', category: ALL })
    const jan = spendOverTime([], { period: '2026-01', category: ALL })
    expect(feb).toHaveLength(28)
    expect(jan).toHaveLength(31)
  })

  // Dropping empty buckets would space the axis by data rather than by time.
  test('a quiet day is still a bucket, so the axis stays evenly spaced', () => {
    const points = spendOverTime(
      [
        tx({ date: '2026-04-01', amount: -10 }),
        tx({ date: '2026-04-30', amount: -10 }),
      ],
      { period: '2026-04', category: ALL },
    )
    expect(points).toHaveLength(30)
    expect(points.filter((p) => p.spent === 0)).toHaveLength(28)
  })

  test('several transactions on one day add up into that bucket', () => {
    const points = spendOverTime(
      [
        tx({ date: '2026-04-02', amount: -3.5 }),
        tx({ date: '2026-04-02', amount: -6.5 }),
      ],
      { period: '2026-04', category: ALL },
    )
    expect(points[1]).toEqual({ key: '2026-04-02', spent: 10 })
  })

  test('income never appears as spending', () => {
    const points = spendOverTime([tx({ date: '2026-04-02', amount: 900 })], {
      period: '2026-04',
      category: ALL,
    })
    expect(points.every((p) => p.spent === 0)).toBe(true)
  })

  test('the category filter scopes the series', () => {
    const data = [
      tx({ date: '2026-04-02', category: 'Food', amount: -10 }),
      tx({ date: '2026-04-03', category: 'Home', amount: -900 }),
    ]
    const points = spendOverTime(data, { period: '2026-04', category: 'Food' })
    expect(points.filter((p) => p.spent > 0)).toEqual([
      { key: '2026-04-02', spent: 10 },
    ])
  })

  test('with no period at all it falls back to the months that exist', () => {
    const points = spendOverTime([tx({ date: '2025-06-02', amount: -10 })], {
      period: null,
      category: ALL,
    })
    expect(points).toEqual([{ key: '2025-06', spent: 10 }])
  })
})

describe('running total', () => {
  test('never decreases, whatever the period does', () => {
    const totals = runningTotal([
      { key: 'a', spent: 10 },
      { key: 'b', spent: 0 },
      { key: 'c', spent: 5 },
    ]).map((p) => p.total)

    expect(totals).toEqual([10, 10, 15])
    expect(totals).toEqual([...totals].sort((x, y) => x - y))
  })

  test('keeps the bucket spend alongside the total', () => {
    expect(
      runningTotal([
        { key: 'a', spent: 4 },
        { key: 'b', spent: 6 },
      ]),
    ).toEqual([
      { key: 'a', spent: 4, total: 4 },
      { key: 'b', spent: 6, total: 10 },
    ])
  })

  test('ends at the period total, without float drift', () => {
    const points = runningTotal([
      { key: 'a', spent: 0.1 },
      { key: 'b', spent: 0.2 },
    ])
    expect(points.at(-1)?.total).toBe(0.3)
  })

  test('an empty period produces no points', () => {
    expect(runningTotal([])).toEqual([])
  })
})
