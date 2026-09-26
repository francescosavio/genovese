import type { Category, Subcategory } from '@/domain/categories'
import type { Transaction } from '@/domain/transaction'
import { db, type MerchantOverride } from './db'

export function applyMerchantOverrides(
  transactions: Transaction[],
  merchantOverridesMap: Map<string, MerchantOverride>,
): Transaction[] {
  return transactions.map((tx) => {
    const override =
      tx.merchant === null ? undefined : merchantOverridesMap.get(tx.merchant)
    if (!override) return tx
    return {
      ...tx,
      category: override.category,
      subcategory: override.subcategory,
      excluded: override.excluded,
      exclusionReason: override.excluded ? 'not_spending' : tx.exclusionReason,
    }
  })
}

export async function loadMerchantOverrides(): Promise<
  Map<string, MerchantOverride>
> {
  const rows = await db.merchants.toArray()
  return new Map(rows.map((row) => [row.merchant, row]))
}

// One decision, applied to every transaction of that merchant at once.
function write(
  merchant: string,
  override: Omit<MerchantOverride, 'merchant' | 'updatedAt'>,
  now: Date,
): Promise<number> {
  return db.transaction('rw', db.merchants, db.transactions, async () => {
    await db.merchants.put({
      merchant,
      ...override,
      updatedAt: now.toISOString(),
    })
    return db.transactions
      .where('merchant')
      .equals(merchant)
      .modify({
        category: override.category,
        subcategory: override.subcategory,
        excluded: override.excluded,
        exclusionReason: override.excluded ? 'not_spending' : null,
      })
  })
}

export function setMerchantCategory(
  merchant: string,
  category: Category,
  subcategory: Subcategory | null,
  now = new Date(),
): Promise<number> {
  return write(merchant, { category, subcategory, excluded: false }, now)
}

// Money moved between my own accounts, or put aside rather than spent. It is
// still imported and still visible; it just is not spending.
export function setMerchantNotSpending(
  merchant: string,
  now = new Date(),
): Promise<number> {
  return write(
    merchant,
    { category: null, subcategory: null, excluded: true },
    now,
  )
}

// Forgets the mapping. Transactions keep what they were given
export async function clearMerchantOverride(merchant: string): Promise<void> {
  await db.merchants.delete(merchant)
}

export async function saveMerchantOverrides(
  merchantOverrides: MerchantOverride[],
): Promise<void> {
  await db.merchants.bulkPut(merchantOverrides)
}

export async function clearEverything(): Promise<void> {
  await db.transaction('rw', db.transactions, db.merchants, async () => {
    await db.transactions.clear()
    await db.merchants.clear()
  })
}
