import type { Category, Subcategory } from '@/domain/categories'
import type { Transaction } from '@/domain/transaction'
import Dexie, { type EntityTable } from 'dexie'

// A saved decision always has a category; the category carries the flow.
export type MerchantOverride = {
  merchant: string
  category: Category
  subcategory: Subcategory | null
  updatedAt: string
}

// Working state, not the source of truth. The spreadsheet file is.
// IndexedDB indexes cannot hold null, so category is filtered in memory.
export const db = new Dexie('genovese') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  merchants: EntityTable<MerchantOverride, 'merchant'>
}

db.version(1).stores({
  transactions: 'id, date, merchant',
  merchants: 'merchant',
})
