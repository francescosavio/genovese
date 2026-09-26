import type { ParseResult } from '@/domain/bank-adapter'
import { db } from './db'
import { loadMerchantOverrides, resolveCategories } from './overrides'

export type ImportReport = {
  added: number
  duplicates: number
  categorised: number
  skipped: number
}

// Existing rows are never overwritten: they carry notes that exist nowhere
// else, and a re-imported statement carries none.
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
    const fresh = transactions.filter((t) => !seen.has(t.id))
    await db.transactions.bulkAdd(fresh)

    return {
      added: fresh.length,
      duplicates: transactions.length - fresh.length,
      // Already known merchants, so nothing to do for these
      categorised: resolveCategories(fresh, merchantOverrides).filter(
        (t) => t.category !== null,
      ).length,
      skipped: skipped.length,
    }
  })
}
