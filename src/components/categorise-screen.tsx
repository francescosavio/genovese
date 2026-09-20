import { useEffect, useMemo, useRef, useState } from 'react'
import {
  searchCategories,
  type CategoryOption,
} from '@/domain/category-options'
import { coverage, groupByMerchant } from '@/domain/merchant-groups'
import type { Transaction } from '@/domain/transaction'
import { setMerchantOverride } from '@/storage/overrides'

const EUR = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
})

export function CategoriseScreen({
  transactions,
}: {
  transactions: Transaction[]
}) {
  // The cursor is a merchant name, never a list index: assigning a category
  // re-sorts the list, and an index would then point at a different merchant.
  const [activeMerchant, setActiveMerchant] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState<number | null>(null)

  const groups = useMemo(() => groupByMerchant(transactions), [transactions])
  const options = useMemo(() => searchCategories(query), [query])
  const done = coverage(transactions)

  const active =
    groups.find((g) => g.merchant === activeMerchant) ??
    groups.find((g) => g.category === null) ??
    groups[0] ??
    null

  const activeRow = useRef<HTMLLIElement>(null)
  const queryInput = useRef<HTMLInputElement>(null)
  // Synchronising with the DOM, which is what effects are actually for.
  useEffect(() => {
    activeRow.current?.scrollIntoView({ block: 'nearest' })
  }, [active?.merchant])

  // Clicking a merchant moves the cursor but must not strand the keyboard,
  // so focus goes back to where the typing happens.
  function moveTo(merchant: string | null) {
    setActiveMerchant(merchant)
    setQuery('')
    setHighlight(null)
    queryInput.current?.focus()
  }

  function nextAfter(merchant: string): string | null {
    const from = groups.findIndex((g) => g.merchant === merchant)
    const remaining = groups
      .slice(from + 1)
      .concat(groups.slice(0, Math.max(from, 0)))
    return remaining.find((g) => g.category === null)?.merchant ?? null
  }

  async function assign(option: CategoryOption) {
    if (!active) return
    // Worked out before the write, because groups is about to change.
    const next = nextAfter(active.merchant)
    await setMerchantOverride(
      active.merchant,
      option.category,
      option.subcategory,
    )
    moveTo(next)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((h) =>
        h === null ? 0 : Math.min(h + 1, options.length - 1),
      )
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((h) => (h === null ? 0 : Math.max(h - 1, 0)))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = highlight === null ? undefined : options[highlight]
      if (option) void assign(option)
    } else if (event.key === 'Tab') {
      event.preventDefault()
      if (!active) return
      const at = groups.findIndex((g) => g.merchant === active.merchant)
      moveTo(groups[at + 1]?.merchant ?? groups[0]?.merchant ?? null)
    } else if (event.key === 'Escape') {
      setQuery('')
      setHighlight(null)
    }
  }

  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        Nothing to categorise yet.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <section aria-label="Coverage">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {done.percent}% of transactions categorised
          </span>
          <span className="text-muted-foreground tabular-nums">
            {done.categorised} of {done.total} ·{' '}
            {groups.filter((g) => g.category === null).length} merchants left
          </span>
        </div>
        <div
          className="bg-muted h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={done.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="bg-primary h-full transition-[width] duration-300"
            style={{ width: `${done.percent}%` }}
          />
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-[1fr_20rem]">
        <ul className="max-h-[28rem] overflow-y-auto pr-1">
          {groups.map((group) => {
            const isActive = group.merchant === active?.merchant
            return (
              <li
                key={group.merchant}
                ref={isActive ? activeRow : null}
                aria-current={isActive}
              >
                <button
                  type="button"
                  onClick={() => {
                    moveTo(group.merchant)
                  }}
                  className={`flex w-full items-baseline gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                    isActive ? 'bg-muted' : 'hover:bg-muted/50'
                  }`}
                >
                  <span className="flex-1 truncate">
                    {group.merchant}
                    {group.category && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {group.category}
                        {group.subcategory ? ` › ${group.subcategory}` : ''}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {group.count}×
                  </span>
                  <span className="w-24 shrink-0 text-right tabular-nums">
                    {EUR.format(group.totalEur)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="group space-y-3">
          <div>
            <p className="text-muted-foreground text-xs">Categorising</p>
            <p className="truncate font-medium">{active?.merchant}</p>
            <p className="text-muted-foreground truncate text-xs">
              {active?.sample}
            </p>
          </div>

          <input
            ref={queryInput}
            autoFocus
            value={query}
            placeholder="Type to filter, ↑↓ to move, ⏎ to assign"
            aria-label="Search categories"
            onChange={(event) => {
              setQuery(event.target.value)
              // Typing arms the best match; an empty box arms nothing.
              setHighlight(event.target.value.trim() === '' ? null : 0)
            }}
            onKeyDown={onKeyDown}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus-visible:ring-3"
          />

          <ul className="max-h-72 overflow-y-auto text-sm">
            {options.map((option, index) => (
              <li key={option.label}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    void assign(option)
                  }}
                  className={`w-full rounded-md px-3 py-1.5 text-left ${
                    index === highlight
                      ? 'bg-muted group-focus-within:bg-primary/50'
                      : ''
                  }`}
                >
                  {option.label}
                </button>
              </li>
            ))}
            {options.length === 0 && (
              <li className="text-muted-foreground px-3 py-1.5">
                No category matches “{query}”.
              </li>
            )}
          </ul>

          <p className="text-muted-foreground text-xs">
            Tab skips · Esc clears
          </p>
        </div>
      </div>
    </div>
  )
}
