import type { Transaction } from '@/domain/transaction'

const EUR = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
})

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
          <tr key={tx.id} className="border-border/60 border-b last:border-0">
            <td className="text-muted-foreground py-2 pr-4 tabular-nums">
              {tx.date}
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
