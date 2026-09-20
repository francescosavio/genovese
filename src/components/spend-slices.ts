import type { BucketTotal } from '@/domain/summary'
import { UNCATEGORISED } from '@/domain/summary'

const MAX_SLICES = 6
const OTHER = 'Other'

const RAMP = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]
const NEUTRAL = 'var(--chart-other)'

export type Slice = {
  label: string
  total: number
  share: number
  start: number
  end: number
  colour: string
}

export function toSlices(buckets: BucketTotal[]): Slice[] {
  const named = buckets.slice(0, MAX_SLICES - 1)
  const tail = buckets.slice(MAX_SLICES - 1)

  const flat = named.map((b, i) => ({
    label: b.bucket as string,
    total: b.total,
    share: b.share,
    // Uncategorised is not a category, so it never wears a category colour.
    colour: b.bucket === UNCATEGORISED ? NEUTRAL : (RAMP[i] ?? NEUTRAL),
  }))

  if (tail.length > 0) {
    flat.push({
      label: OTHER,
      total: Math.round(tail.reduce((s, b) => s + b.total, 0) * 100) / 100,
      share: tail.reduce((s, b) => s + b.share, 0),
      colour: NEUTRAL,
    })
  }

  let cursor = 0
  return flat.map((slice) => {
    const start = cursor
    cursor += slice.share
    return { ...slice, start, end: cursor }
  })
}
