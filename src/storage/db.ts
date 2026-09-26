import type { Category, Subcategory } from '@/domain/categories'
import type { Transaction } from '@/domain/transaction'
import Dexie, { type EntityTable } from 'dexie'

// Either a category was chosen, or the merchant was marked as not spending.
// Never both: excluded money has no place in a spending category.
export type MerchantOverride = {
  merchant: string
  category: Category | null
  subcategory: Subcategory | null
  excluded: boolean
  updatedAt: string
}

// Working state, not the source of truth. The spreadsheet file is.
// IndexedDB indexes cannot hold null or boolean, so category and excluded
// are filtered in memory instead.
export const db = new Dexie('genovese') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  merchants: EntityTable<MerchantOverride, 'merchant'>
}

db.version(1).stores({
  transactions: 'id, date, merchant',
  merchants: 'merchant',
})
