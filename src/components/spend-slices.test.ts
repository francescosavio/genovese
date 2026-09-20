import { describe, expect, test } from 'vitest'
import { UNCATEGORISED, type BucketTotal } from '@/domain/summary'
import { toSlices, toTableRows } from './spend-slices'

const bucket = (b: string, total: number, share: number): BucketTotal =>
  ({ bucket: b, total, share }) as BucketTotal

describe('slices', () => {
  test('keeps five named buckets and folds the rest into Other', () => {
    const slices = toSlices(
      Array.from({ length: 9 }, (_, i) => bucket(`c${i}`, 10, 1 / 9)),
    )
    expect(slices).toHaveLength(6)
    expect(slices.at(-1)).toMatchObject({ label: 'Other', total: 40 })
  })

  test('each fill carries the text colour that is readable on it', () => {
    const slices = toSlices([
      bucket('a', 50, 0.5),
      bucket('b', 20, 0.2),
      bucket('c', 12, 0.12),
      bucket('d', 10, 0.1),
      bucket('e', 8, 0.08),
    ])
    expect(slices.map((s) => s.ink)).toEqual([
      'light',
      'light',
      'light',
      'dark',
      'dark',
    ])
  })

  test('fewer than six buckets means no Other slice at all', () => {
    expect(toSlices([bucket('Food', 10, 1)]).map((s) => s.label)).toEqual([
      'Food',
    ])
  })

  test('arcs are laid end to end and cover the whole ring', () => {
    const slices = toSlices([
      bucket('Home', 75, 0.75),
      bucket('Food', 25, 0.25),
    ])
    expect(slices.map((s) => [s.start, s.end])).toEqual([
      [0, 0.75],
      [0.75, 1],
    ])
  })

  test('uncategorised never wears a category colour', () => {
    const [first] = toSlices([bucket(UNCATEGORISED, 90, 0.9)])
    expect(first?.colour).toBe('var(--chart-other)')
  })

  test('the biggest bucket gets the darkest step of the ramp', () => {
    const slices = toSlices([bucket('Home', 90, 0.9), bucket('Food', 10, 0.1)])
    expect(slices.map((s) => s.colour)).toEqual([
      'var(--chart-1)',
      'var(--chart-2)',
    ])
  })
})

describe('table rows', () => {
  // The donut can only draw six things; the table must still account for
  // every euro, or "Other" becomes money that went nowhere.
  test('lists every bucket, not just the ones with a slice', () => {
    const rows = toTableRows(
      Array.from({ length: 9 }, (_, i) => bucket(`c${i}`, 10, 1 / 9)),
    )
    expect(rows).toHaveLength(9)
  })

  test('rows past the fifth wear the same neutral as the Other slice', () => {
    const rows = toTableRows(
      Array.from({ length: 7 }, (_, i) => bucket(`c${i}`, 10, 1 / 7)),
    )
    const slices = toSlices(
      Array.from({ length: 7 }, (_, i) => bucket(`c${i}`, 10, 1 / 7)),
    )
    expect(rows[5]?.colour).toBe(slices.at(-1)?.colour)
    expect(rows[6]?.colour).toBe(slices.at(-1)?.colour)
  })

  test('the first five match their slices exactly', () => {
    const buckets = Array.from({ length: 7 }, (_, i) =>
      bucket(`c${i}`, 10, 1 / 7),
    )
    const rows = toTableRows(buckets)
    const slices = toSlices(buckets)
    expect(rows.slice(0, 5).map((r) => r.colour)).toEqual(
      slices.slice(0, 5).map((s) => s.colour),
    )
  })

  test('uncategorised stays neutral even when it is the biggest', () => {
    const [first] = toTableRows([bucket(UNCATEGORISED, 90, 0.9)])
    expect(first).toMatchObject({ colour: 'var(--chart-other)', ink: 'dark' })
  })
})
