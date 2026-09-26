import type { Category, Subcategory } from '@/domain/categories'
import type { Transaction } from '@/domain/transaction'
import { db, type MerchantOverride } from './db'

// Join Transactions, merchants and categories.
export function resolveCategories(
  transactions: Transaction[],
  merchantOverrides: Map<string, MerchantOverride>,
): Transaction[] {
  return transactions.map((tx) => {
    const override =
      tx.merchant === null ? undefined : merchantOverrides.get(tx.merchant)
    return {
      ...tx,
      category: override?.category ?? null,
      subcategory: override?.subcategory ?? null,
    }
  })
}

export async function loadMerchantOverrides(): Promise<
  Map<string, MerchantOverride>
> {
  const rows = await db.merchants.toArray()
  return new Map(rows.map((row) => [row.merchant, row]))
}

// One row written; every transaction of that merchant follows on the next read.
export async function setMerchantCategory(
  merchant: string,
  category: Category,
  subcategory: Subcategory | null,
  now = new Date(),
): Promise<void> {
  await db.merchants.put({
    merchant,
    category,
    subcategory,
    updatedAt: now.toISOString(),
  })
}

// Its transactions become uncategorised again
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
