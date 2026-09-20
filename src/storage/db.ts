import type { Category, Subcategory } from '@/domain/categories'
import type { Transaction } from '@/domain/transaction'
import Dexie, { type EntityTable } from 'dexie'

export type MerchantOverride = {
  merchant: string
  category: Category
  subcategory: Subcategory | null
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
