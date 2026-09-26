import type { Category, Subcategory } from './categories'

export type BankId = 'revolut' | 'ing'

// Canonical types
export type TransactionType =
  'card_payment' | 'transfer' | 'topup' | 'exchange' | 'atm' | 'fee' | 'other'

export type Transaction = {
  id: string // content hash of the bank's own row
  date: string // ISO 8601, YYYY-MM-DD
  amount: number // EUR, 2 decimals; negative means money left
  rawDescription: string
  merchant: string | null // normalized; null on rows that have no merchant
  category: Category | null // from the merchant, resolved when read
  subcategory: Subcategory | null
  account: string // captured, not used: which account at that bank
  sourceBank: BankId
  type: TransactionType
  notes: string
}
