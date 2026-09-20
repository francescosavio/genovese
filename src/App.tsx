import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ADAPTERS, adapterFor } from '@/adapters'
import { CategoriseScreen } from '@/components/categorise-screen'
import { Dashboard } from '@/components/dashboard'
import { ClearDataButton } from '@/components/clear-data-button'
import { Button } from '@/components/ui/button'
import { TransactionTable } from '@/components/transaction-table'
import { db } from '@/storage/db'
import { importTransactions, type ImportReport } from '@/storage/import'
import { saveMerchantOverrides } from '@/storage/overrides'
import { downloadWorkbook, readSpreadsheet } from '@/storage/spreadsheet'

const supportedBanks = () => ADAPTERS.map((a) => a.label).join(', ')

function summarise(report: ImportReport): string {
  const parts = [`${report.added} imported`]
  if (report.duplicates > 0) parts.push(`${report.duplicates} already here`)
  if (report.excluded > 0) parts.push(`${report.excluded} excluded from totals`)
  if (report.skipped > 0) parts.push(`${report.skipped} skipped`)
  return parts.join(' · ')
}

export default function App() {
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [view, setView] = useState<'dashboard' | 'categorise' | 'transactions'>(
    'dashboard',
  )

  // Re-runs on its own whenever the table changes, so importing updates the
  // list without a refetch. undefined means the first read is still running.
  const transactions = useLiveQuery(() =>
    db.transactions.orderBy('date').reverse().toArray(),
  )
  const merchantOverrides = useLiveQuery(() => db.merchants.toArray())

  async function importFile(file: File) {
    setReport(null)
    setError(null)
    setWarnings([])
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const loaded = await readSpreadsheet(file)
        setWarnings(loaded.warnings)
        await saveMerchantOverrides(loaded.merchantOverrides)
        setReport(
          await importTransactions({
            transactions: loaded.transactions,
            skipped: [],
          }),
        )
        return
      }

      const csv = await file.text()
      const adapter = adapterFor(csv)
      if (!adapter) {
        setError(
          `${file.name} does not look like a statement from a bank this app knows. Supported: ${supportedBanks()}.`,
        )
        return
      }
      setReport(await importTransactions(adapter.parse(csv)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <header className="mb-8 flex items-end justify-between gap-6">
        <div>
          <h1 className="text-primary text-2xl font-semibold tracking-tight">
            Genovese
          </h1>
          <p className="text-muted-foreground text-sm">
            Reads your bank exports and shows where the money goes.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="text-sm">
            <span className="sr-only">Import a statement</span>
            <input
              type="file"
              accept=".csv,.xlsx"
              className="file:bg-primary file:text-primary-foreground hover:file:bg-primary/80 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importFile(file)
                event.target.value = ''
              }}
            />
          </label>
          <Button
            variant="outline"
            disabled={!transactions || transactions.length === 0}
            onClick={() => {
              downloadWorkbook(transactions ?? [], merchantOverrides ?? [])
            }}
          >
            Export
          </Button>
          <ClearDataButton
            disabled={!transactions || transactions.length === 0}
            onCleared={() => {
              setReport(null)
              setWarnings([])
              setError(null)
            }}
          />
        </div>
      </header>

      {error && (
        <p className="border-destructive/40 bg-destructive/10 text-destructive mb-6 rounded-lg border px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {report && (
        <p className="bg-muted text-muted-foreground mb-6 rounded-lg px-4 py-3 text-sm">
          {summarise(report)}
        </p>
      )}

      {warnings.length > 0 && (
        <details className="border-border mb-6 rounded-lg border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">
            {warnings.length} thing{warnings.length === 1 ? '' : 's'} in that
            file needed attention
          </summary>
          <ul className="text-muted-foreground mt-2 space-y-1">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}

      {transactions === undefined ? null : transactions.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="font-medium">No transactions yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Import a {supportedBanks()} CSV export to get started.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-1 text-sm">
            {(['dashboard', 'categorise', 'transactions'] as const).map(
              (name) => (
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
                </button>
              ),
            )}
          </div>
          {view === 'dashboard' && (
            <Dashboard
              transactions={transactions}
              onFixUncategorised={() => {
                setView('categorise')
              }}
            />
          )}
          {view === 'categorise' && (
            <CategoriseScreen transactions={transactions} />
          )}
          {view === 'transactions' && (
            <TransactionTable transactions={transactions} />
          )}
        </>
      )}
    </main>
  )
}
