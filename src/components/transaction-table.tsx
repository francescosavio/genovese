import { bankLabel } from '@/adapters'
import type { Transaction } from '@/domain/transaction'

const EUR = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
})

// Display only: stored dates stay ISO, which is what sorts correctly.
const dayFirst = (iso: string) => iso.split('-').reverse().join('-')

// Present only where rows can be picked
export type Selection = {
  selected: ReadonlySet<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
}

// A row without a merchant has nothing to map a category to.
const selectable = (tx: Transaction) => tx.merchant !== null

export function TransactionTable({
  transactions,
  selection,
}: {
  transactions: Transaction[]
  selection?: Selection
}) {
  const pickable = transactions.filter(selectable)
  const allPicked =
    pickable.length > 0 &&
    pickable.every((tx) => selection?.selected.has(tx.id))

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-muted-foreground border-b text-left">
          {selection && (
            <th className="w-8 py-2 pr-2">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allPicked}
                onChange={selection.onToggleAll}
              />
            </th>
          )}
          <th className="py-2 pr-4 font-medium">Date</th>
          <th className="py-2 pr-4 font-medium">Bank</th>
          <th className="py-2 pr-4 font-medium">Merchant</th>
          <th className="py-2 pr-4 font-medium">Description</th>
          <th className="py-2 pr-4 font-medium">Category</th>
          <th className="py-2 pl-4 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => (
          <tr
            key={tx.id}
            className={`border-border/60 border-b last:border-0 ${
              selection?.selected.has(tx.id) ? 'bg-accent' : ''
            }`}
          >
            {selection && (
              <td className="py-2 pr-2">
                <input
                  type="checkbox"
                  aria-label={`Select ${tx.merchant ?? 'transaction'}`}
                  disabled={!selectable(tx)}
                  checked={selection.selected.has(tx.id)}
                  onChange={() => {
                    selection.onToggle(tx.id)
                  }}
                />
              </td>
            )}
            <td className="text-muted-foreground py-2 pr-4 whitespace-nowrap tabular-nums">
              {dayFirst(tx.date)}
            </td>
            <td className="text-muted-foreground py-2 pr-4">
              {bankLabel(tx.sourceBank)}
            </td>
            <td className="py-2 pr-4">{tx.merchant ?? '—'}</td>
            <td className="text-muted-foreground py-2 pr-4">
              {tx.rawDescription}
            </td>
            <td className="py-2 pr-4">
              {tx.category ? (
                <span>
                  {tx.category}
                  {tx.subcategory && (
                    <span className="text-muted-foreground">
                      {' › '}
                      {tx.subcategory}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground/60">uncategorised</span>
              )}
            </td>
            <td className="py-2 pl-4 text-right tabular-nums">
              {EUR.format(tx.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
