import type { TableRow } from './spend-slices'

const EUR = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
})

export function CategoryTable({ rows }: { rows: TableRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing spent in this period.
      </p>
    )
  }

  return (
    <div className="max-h-56 overflow-y-auto pr-2">
      <table className="w-full text-sm">
        <caption className="sr-only">Spending by category</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="py-1 pr-3">
                <span
                  className={`inline-block w-11 rounded-[4px] px-1.5 py-0.5 text-right text-xs tabular-nums ${
                    row.ink === 'light' ? 'text-white' : 'text-foreground'
                  }`}
                  style={{ background: row.colour }}
                >
                  {Math.round(row.share * 100)}%
                </span>
              </td>
              <td className="w-full py-1 pr-3">{row.label}</td>
              <td className="py-1 text-right tabular-nums">
                {EUR.format(row.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
