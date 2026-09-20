import { describe, expect, test } from 'vitest'
import { UNCATEGORISED, type BucketTotal } from '@/domain/summary'
import { toSlices } from './spend-slices'

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
