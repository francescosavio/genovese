import { flowOf, type Category } from './categories'
import { inEur, type Transaction } from './transaction'

export type MonthKey = string // YYYY-MM

// A date prefix: "2026" is a year, "2026-09" is a month, null is everything.
export type Period = string | null

export const ALL = 'all' as const

export type Filter = {
  period: Period
  // Category uses the ALL sentinel rather than null, because null already
  // means "uncategorised" there and filtering for that is a thing someone
  // will legitimately want.
  category: Category | typeof ALL
}

// Not a real category. Kept as a bucket so a chart can never quietly leave
// uncategorised money out of its own total.
export const UNCATEGORISED = 'Uncategorised' as const
export type Bucket = Category | typeof UNCATEGORISED

export const monthOf = (tx: Transaction): MonthKey => tx.date.slice(0, 7)

export const yearOf = (tx: Transaction): string => tx.date.slice(0, 4)

export function monthsPresent(
  transactions: Transaction[],
  within: Period = null,
): MonthKey[] {
  return [
    ...new Set(
      transactions
        .filter((tx) => inEur(tx) && inPeriod(tx, within))
        .map(monthOf),
    ),
  ].sort((a, b) => b.localeCompare(a))
}

export function yearsPresent(transactions: Transaction[]): string[] {
  return [...new Set(transactions.filter(inEur).map(yearOf))].sort((a, b) =>
    b.localeCompare(a),
  )
}

const inPeriod = (tx: Transaction, period: Period) =>
  period === null || tx.date.startsWith(period)

// Spending only: income and transfers never match.
export function matches(tx: Transaction, filter: Filter): boolean {
  if (!inEur(tx) || flowOf(tx.category) !== 'expense') return false
  if (!inPeriod(tx, filter.period)) return false
  if (filter.category !== ALL && tx.category !== filter.category) return false
  return true
}

export type Totals = {
  spent: number // net of refunds; positive means money left
  income: number
}

// The category's flow decides which side a row lands on, so a refund nets
// into its expense and a transfer counts as neither.
export function totals(transactions: Transaction[], filter: Filter): Totals {
  let spent = 0
  let income = 0
  for (const tx of transactions) {
    if (!inEur(tx) || !inPeriod(tx, filter.period)) continue
    if (matches(tx, filter)) spent -= tx.amountEur
    else if (flowOf(tx.category) === 'income') income += tx.amountEur
  }
  return { spent: round2(spent), income: round2(income) }
}

export type BucketTotal = {
  bucket: Bucket
  total: number
  share: number // 0..1 of the period's spending
}

export function spendByBucket(
  transactions: Transaction[],
  filter: Filter,
): BucketTotal[] {
  const sums = new Map<Bucket, number>()

  // Signed, so a refund reduces the category it came from instead of posing
  // as income. A category can end a period negative, which is real.
  for (const tx of transactions) {
    if (!matches(tx, filter)) continue
    const bucket: Bucket = tx.category ?? UNCATEGORISED
    sums.set(bucket, (sums.get(bucket) ?? 0) - (tx.amountEur ?? 0))
  }

  const spent = [...sums.values()].reduce((a, b) => a + b, 0)
  return [...sums]
    .map(([bucket, total]) => ({
      bucket,
      total: round2(total),
      share: spent === 0 ? 0 : total / spent,
    }))
    .sort((a, b) => b.total - a.total)
}

export type MonthTotal = { month: MonthKey; spent: number }

export function spendByMonth(
  transactions: Transaction[],
  filter: Filter,
): MonthTotal[] {
  const sums = new Map<MonthKey, number>()
  for (const tx of transactions) {
    if (!matches(tx, filter)) continue
    const amount = tx.amountEur ?? 0
    if (amount >= 0) continue
    const month = monthOf(tx)
    sums.set(month, (sums.get(month) ?? 0) - amount)
  }
  return [...sums]
    .map(([month, spent]) => ({ month, spent: round2(spent) }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export type Outstanding = { count: number; total: number }

export function uncategorised(transactions: Transaction[]): Outstanding {
  const rows = transactions.filter((tx) => inEur(tx) && tx.category === null)
  return {
    count: rows.length,
    total: round2(
      rows.reduce((sum, tx) => sum + Math.min(tx.amountEur ?? 0, 0), 0) * -1,
    ),
  }
}

// The + 0 normalises -0, which Intl formats as "-0,00" and reads as a bug.
const round2 = (n: number) => Math.round(n * 100) / 100 + 0

export type Averages = {
  months: number
  spentPerMonth: number
  incomePerMonth: number
}

// Averaged over the months inside the selected period that actually have
// data.
export function averages(
  transactions: Transaction[],
  filter: Filter,
): Averages {
  const months = new Set(
    transactions.filter((tx) => matches(tx, filter)).map(monthOf),
  ).size
  if (months === 0) return { months: 0, spentPerMonth: 0, incomePerMonth: 0 }
  const all = totals(transactions, filter)
  return {
    months,
    spentPerMonth: round2(all.spent / months),
    incomePerMonth: round2(all.income / months),
  }
}

export type TimePoint = { key: string; spent: number }

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate()

// Daily inside any chosen period
export function spendOverTime(
  transactions: Transaction[],
  filter: Filter,
): TimePoint[] {
  const daily = filter.period !== null
  const sums = new Map<string, number>()

  for (const tx of transactions) {
    if (!matches(tx, filter)) continue
    const amount = tx.amountEur ?? 0
    if (amount >= 0) continue
    const key = daily ? tx.date : monthOf(tx)
    sums.set(key, (sums.get(key) ?? 0) - amount)
  }

  return bucketKeys(transactions, filter.period).map((key) => ({
    key,
    spent: round2(sums.get(key) ?? 0),
  }))
}

const pad = (n: number) => String(n).padStart(2, '0')

const daysOfMonth = (year: number, month: number): string[] =>
  Array.from(
    { length: daysInMonth(year, month) },
    (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`,
  )

function bucketKeys(transactions: Transaction[], period: Period): string[] {
  if (period === null) return monthsPresent(transactions).slice().reverse()

  if (period.length === 7) {
    const [year, month] = period.split('-').map(Number)
    return daysOfMonth(year!, month!)
  }

  const year = Number(period)
  return Array.from({ length: 12 }, (_, i) => i + 1).flatMap((month) =>
    daysOfMonth(year, month),
  )
}

export type CumulativePoint = TimePoint & { total: number }

// The line plots the running total, so it only ever grows. Each point keeps
// its own bucket's spend too, so the hover can show both.
export function runningTotal(points: TimePoint[]): CumulativePoint[] {
  let sum = 0
  return points.map((point) => {
    sum = round2(sum + point.spent)
    return { ...point, total: sum }
  })
}
