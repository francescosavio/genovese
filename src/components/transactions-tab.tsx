import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { TransactionTable } from '@/components/transaction-table'
import { CATEGORY_OPTIONS } from '@/domain/category-options'
import {
  VIEWS,
  countByView,
  filterTransactions,
  merchantsOf,
  type TransactionView,
} from '@/domain/transaction-filter'
import type { Transaction } from '@/domain/transaction'
import { setMerchantsCategory } from '@/storage/overrides'

export function TransactionsTab({
  transactions,
}: {
  transactions: Transaction[]
}) {
  const [view, setView] = useState<TransactionView>('all')
  const [query, setQuery] = useState('')
  // Ids, not rows: assigning re-reads the transactions, and ids survive that.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [option, setOption] = useState(0)

  const counts = useMemo(() => countByView(transactions), [transactions])
  const rows = useMemo(
    () => filterTransactions(transactions, view, query),
    [transactions, view, query],
  )
  const merchants = merchantsOf(rows, selected)

  // Picking only makes sense where everything is still to decide
  const picking = view === 'uncategorised'

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    const pickable = rows.filter((tx) => tx.merchant !== null)
    const all = pickable.every((tx) => selected.has(tx.id))
    setSelected(all ? new Set() : new Set(pickable.map((tx) => tx.id)))
  }

  async function assign() {
    const picked = CATEGORY_OPTIONS[option]
    if (!picked || merchants.length === 0) return
    await setMerchantsCategory(merchants, picked.category, picked.subcategory)
    setSelected(new Set())
  }

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
                setSelected(new Set())
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
            setSelected(new Set())
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
          {picking && selected.size > 0 ? (
            <div className="bg-muted flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-sm">
              <span className="font-medium">
                {selected.size} selected
                <span className="text-muted-foreground font-normal">
                  {' '}
                  · {merchants.length} merchant
                  {merchants.length === 1 ? '' : 's'}
                </span>
              </span>
              <select
                value={option}
                aria-label="Category to assign"
                onChange={(event) => {
                  setOption(Number(event.target.value))
                }}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 ml-auto rounded-lg border px-3 py-1.5 outline-none focus-visible:ring-3"
              >
                {CATEGORY_OPTIONS.map((o, index) => (
                  <option key={o.label} value={index}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => {
                  void assign()
                }}
              >
                Assign
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelected(new Set())
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {rows.length} of {counts.all} transactions
              {picking && ' · tick rows to categorise their merchants'}
            </p>
          )}
          <TransactionTable
            transactions={rows}
            selection={
              picking
                ? { selected, onToggle: toggle, onToggleAll: toggleAll }
                : undefined
            }
          />
        </>
      )}
    </div>
  )
}
