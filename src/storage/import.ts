import type { ParseResult } from '@/domain/bank-adapter'
import { db } from './db'

export type ImportReport = {
  added: number
  duplicates: number
  excluded: number
  skipped: number
}

// Existing rows are never overwritten.
export async function importTransactions({
  transactions,
  skipped,
}: ParseResult): Promise<ImportReport> {
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
      excluded: fresh.filter((t) => t.excluded).length,
      skipped: skipped.length,
    }
  })
}
