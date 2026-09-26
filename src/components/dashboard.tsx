import { useMemo, useState } from 'react'
import { SpendDonut } from '@/components/spend-donut'
import { toSlices, toTableRows } from '@/components/spend-slices'
import { CategoryTable } from '@/components/category-table'
import { SpendOverTime } from '@/components/spend-over-time'
import {
  ALL,
  averages,
  monthsPresent,
  spendByBucket,
  runningTotal,
  spendOverTime,
  totals,
  uncategorised,
  yearsPresent,
  type Filter,
} from '@/domain/summary'
import { EXPENSE_CATEGORIES, type Category } from '@/domain/categories'
import type { Transaction } from '@/domain/transaction'

const EUR = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
})

const WHOLE_YEAR = ''

const monthName = (month: string) =>
  new Date(`2000-${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    timeZone: 'UTC',
  })

const periodLabel = (year: string, month: string) =>
  month === WHOLE_YEAR ? year : `${monthName(month)} ${year}`

export function Dashboard({
  transactions,
  onFixUncategorised,
}: {
  transactions: Transaction[]
  onFixUncategorised: () => void
}) {
  const years = useMemo(() => yearsPresent(transactions), [transactions])
  const [year, setYear] = useState<string | null>(null)
  const [month, setMonth] = useState<string>(WHOLE_YEAR)
  // Scopes the plot only: filtering the donut to one category would leave it
  // showing a single 100% slice.
  const [plotCategory, setPlotCategory] = useState<Category | typeof ALL>(ALL)

  const shownYear = year ?? years[0] ?? ''
  const monthsInYear = useMemo(
    () => monthsPresent(transactions, shownYear).map((m) => m.slice(5)),
    [transactions, shownYear],
  )

  // A month absent from the chosen year would show an empty period, so it
  // falls back to the whole year rather than showing nothing.
  const activeMonth = monthsInYear.includes(month) ? month : WHOLE_YEAR
  const filter: Filter = {
    period:
      activeMonth === WHOLE_YEAR ? shownYear : `${shownYear}-${activeMonth}`,
    category: ALL,
  }

  const period = totals(transactions, filter)
  const buckets = spendByBucket(transactions, filter)
  const slices = toSlices(buckets)
  const outstanding = uncategorised(transactions)
  const average = averages(transactions, filter)
  const series = runningTotal(
    spendOverTime(transactions, { ...filter, category: plotCategory }),
  )
  // An average over one month is just that month's total.
  const showAverages = activeMonth === WHOLE_YEAR && average.months > 1

  if (years.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        Nothing to summarise yet.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {outstanding.count > 0 && (
        <button
          type="button"
          onClick={onFixUncategorised}
          className="border-border hover:bg-muted flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm"
        >
          <span>
            <span className="font-medium">
              {outstanding.count} transaction
              {outstanding.count === 1 ? '' : 's'} not categorised
            </span>
            <span className="text-muted-foreground">
              {' '}
              · {EUR.format(outstanding.total)} unaccounted for
            </span>
          </span>
          <span className="text-primary shrink-0 font-medium">
            Categorise →
          </span>
        </button>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs">
            Spent in {periodLabel(shownYear, activeMonth)}
          </p>
          <p className="text-3xl font-semibold tabular-nums">
            {EUR.format(period.spent)}
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <label>
            <span className="sr-only">Year</span>
            <select
              value={shownYear}
              onChange={(event) => {
                setYear(event.target.value)
                setMonth(WHOLE_YEAR)
              }}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border px-3 py-1.5 outline-none focus-visible:ring-3"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Month</span>
            <select
              value={activeMonth}
              onChange={(event) => {
                setMonth(event.target.value)
              }}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border px-3 py-1.5 outline-none focus-visible:ring-3"
            >
              <option value={WHOLE_YEAR}>Whole year</option>
              {monthsInYear.map((m) => (
                <option key={m} value={m}>
                  {monthName(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* The auto left margin on the table eats the free space, so the donut
          sits left and the table sits right with the slack between them. */}
      <div className="flex flex-wrap items-center gap-12">
        <SpendDonut slices={slices} />

        <CategoryTable rows={toTableRows(buckets)} />

        <dl className="divide-border min-w-56 divide-y text-sm md:ml-auto">
          <Stat label="Spent" value={period.spent} />
          <Stat label="Income" value={period.income} />
          {showAverages && (
            <>
              <Stat
                label="Spent / month"
                value={average.spentPerMonth}
                note={`avg of ${average.months}`}
              />
              <Stat
                label="Income / month"
                value={average.incomePerMonth}
                note={`avg of ${average.months}`}
              />
            </>
          )}
        </dl>
      </div>

      <div className="space-y-3 pt-2">
        <label className="text-sm">
          <span className="sr-only">Category shown in the plot</span>
          <select
            value={plotCategory}
            onChange={(event) => {
              setPlotCategory(event.target.value as Category | typeof ALL)
            }}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border px-3 py-1.5 outline-none focus-visible:ring-3"
          >
            <option value={ALL}>All categories</option>
            {EXPENSE_CATEGORIES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <SpendOverTime points={series} />
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  note,
}: {
  label: string
  value: number
  note?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">
        {label}
        {note && <span className="ml-2 text-xs">{note}</span>}
      </dt>
      <dd className="font-medium tabular-nums">{EUR.format(value)}</dd>
    </div>
  )
}
