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
    return override
      ? {
          ...tx,
          category: override.category,
          subcategory: override.subcategory,
        }
      : tx
  })
}

export async function loadMerchantOverrides(): Promise<
  Map<string, MerchantOverride>
> {
  const rows = await db.merchants.toArray()
  return new Map(rows.map((row) => [row.merchant, row]))
}

// Apply the merchant-category mapping to all transactions of that merchant
export async function setMerchantOverride(
  merchant: string,
  category: Category,
  subcategory: Subcategory | null,
  now = new Date(),
): Promise<number> {
  return db.transaction('rw', db.merchants, db.transactions, async () => {
    await db.merchants.put({
      merchant,
      category,
      subcategory,
      updatedAt: now.toISOString(),
    })
    return db.transactions
      .where('merchant')
      .equals(merchant)
      .modify({ category, subcategory })
  })
}

// Forgets the mapping. Transactions keep the category they were given
export async function clearMerchantOverride(merchant: string): Promise<void> {
  await db.merchants.delete(merchant)
}

export async function saveMerchantOverrides(
  merchantOverrides: MerchantOverride[],
): Promise<void> {
  await db.merchants.bulkPut(merchantOverrides)
}
