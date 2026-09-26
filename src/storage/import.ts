import type { ParseResult } from '@/domain/bank-adapter'
import { inEur } from '@/domain/transaction'
import { db } from './db'
import { applyMerchantOverrides, loadMerchantOverrides } from './overrides'

export type ImportReport = {
  added: number
  duplicates: number
  categorised: number
  excluded: number // not in EUR
  skipped: number
}

// Existing rows are never overwritten: they carry categorisation that exists
// nowhere else, and a re-imported statement carries none.
export async function importTransactions({
  transactions,
  skipped,
}: ParseResult): Promise<ImportReport> {
  const merchantOverrides = await loadMerchantOverrides()

  return db.transaction('rw', db.transactions, async () => {
    const seen = new Set(
      await db.transactions
        .where('id')
        .anyOf(transactions.map((t) => t.id))
        .primaryKeys(),
    )
    const fresh = applyMerchantOverrides(
      transactions.filter((t) => !seen.has(t.id)),
      merchantOverrides,
    )
    await db.transactions.bulkAdd(fresh)

    return {
      added: fresh.length,
      duplicates: transactions.length - fresh.length,
      categorised: fresh.filter((t) => t.category !== null).length,
      excluded: fresh.filter((t) => !inEur(t)).length,
      skipped: skipped.length,
    }
  })
}
