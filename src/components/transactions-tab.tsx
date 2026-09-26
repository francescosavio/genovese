import { useMemo, useState } from 'react'
import { TransactionTable } from '@/components/transaction-table'
import {
  VIEWS,
  countByView,
  filterTransactions,
  type TransactionView,
} from '@/domain/transaction-filter'
import type { Transaction } from '@/domain/transaction'

export function TransactionsTab({
  transactions,
}: {
  transactions: Transaction[]
}) {
  const [view, setView] = useState<TransactionView>('all')
  const [query, setQuery] = useState('')

  const counts = useMemo(() => countByView(transactions), [transactions])
  const rows = useMemo(
    () => filterTransactions(transactions, view, query),
    [transactions, view, query],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 text-sm">
          {VIEWS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setView(name)
              }}
              className={`rounded-lg px-3 py-1.5 capitalize ${
                view === name
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {name}
              {/* The count is on the button, so "12 uncategorised" is
                  answerable without clicking anything. */}
              <span className="ml-1.5 tabular-nums opacity-60">
                {counts[name]}
              </span>
            </button>
          ))}
        </div>

        <input
          value={query}
          placeholder="Search merchant, description or category"
          aria-label="Search transactions"
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 ml-auto w-72 rounded-lg border px-3 py-1.5 text-sm outline-none focus-visible:ring-3"
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          Nothing matches this filter.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {rows.length} of {counts.all} transactions
          </p>
          <TransactionTable transactions={rows} />
        </>
      )}
    </div>
  )
}
