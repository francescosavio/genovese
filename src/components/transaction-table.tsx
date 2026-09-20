import type { Transaction } from '@/domain/transaction'

const EUR = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
})

function amount(tx: Transaction): string {
  return tx.currency === 'EUR'
    ? EUR.format(tx.amountRaw)
    : `${tx.amountRaw.toFixed(2)} ${tx.currency}`
}

export function TransactionTable({
  transactions,
}: {
  transactions: Transaction[]
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-muted-foreground border-b text-left">
          <th className="py-2 pr-4 font-medium">Date</th>
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
            className="border-border/60 border-b last:border-0"
            data-excluded={tx.excluded}
          >
            <td className="text-muted-foreground py-2 pr-4 tabular-nums">
              {tx.date}
            </td>
            <td className="py-2 pr-4">{tx.merchant ?? '—'}</td>
            <td className="text-muted-foreground py-2 pr-4">
              {tx.rawDescription}
              {tx.excluded && (
                <span className="text-muted-foreground/70 ml-2 text-xs">
                  excluded · {tx.exclusionReason}
                </span>
              )}
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
                <span className="text-muted-foreground/60">
                  {tx.excluded ? '—' : 'uncategorised'}
                </span>
              )}
            </td>
            <td
              className={`py-2 pl-4 text-right tabular-nums ${
                tx.excluded ? 'text-muted-foreground/60 line-through' : ''
              }`}
            >
              {amount(tx)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
