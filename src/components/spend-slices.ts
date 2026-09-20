import type { BucketTotal } from '@/domain/summary'
import { UNCATEGORISED } from '@/domain/summary'

const NAMED = 5
const OTHER = 'Other'

export type Paint = { colour: string; ink: 'light' | 'dark' }

const RAMP: Paint[] = [
  { colour: 'var(--chart-1)', ink: 'light' },
  { colour: 'var(--chart-2)', ink: 'light' },
  { colour: 'var(--chart-3)', ink: 'light' },
  { colour: 'var(--chart-4)', ink: 'dark' },
  { colour: 'var(--chart-5)', ink: 'dark' },
]
const NEUTRAL: Paint = { colour: 'var(--chart-other)', ink: 'dark' }

// Uncategorised is not a category, so it never wears a category colour.
const paintFor = (bucket: string, index: number): Paint =>
  bucket === UNCATEGORISED ? NEUTRAL : (RAMP[index] ?? NEUTRAL)

export type Slice = {
  label: string
  total: number
  share: number
  start: number
  end: number
} & Paint

export function toSlices(buckets: BucketTotal[]): Slice[] {
  const named = buckets.slice(0, NAMED)
  const tail = buckets.slice(NAMED)

  const flat = named.map((b, i) => ({
    label: b.bucket as string,
    total: b.total,
    share: b.share,
    ...paintFor(b.bucket, i),
  }))

  if (tail.length > 0) {
    flat.push({
      label: OTHER,
      total: Math.round(tail.reduce((s, b) => s + b.total, 0) * 100) / 100,
      share: tail.reduce((s, b) => s + b.share, 0),
      ...NEUTRAL,
    })
  }

  let cursor = 0
  return flat.map((slice) => {
    const start = cursor
    cursor += slice.share
    return { ...slice, start, end: cursor }
  })
}

export type TableRow = {
  label: string
  total: number
  share: number
} & Paint

// Every bucket, so the money folded into "Other" is still itemised. Rows past
// the fifth carry the neutral.
export function toTableRows(buckets: BucketTotal[]): TableRow[] {
  return buckets.map((b, i) => ({
    label: b.bucket as string,
    total: b.total,
    share: b.share,
    ...paintFor(b.bucket, i),
  }))
}
