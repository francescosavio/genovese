import type { Category, Subcategory } from './categories'

export type BankId = 'revolut' | 'ing'

// Canonical types
export type TransactionType =
  'card_payment' | 'transfer' | 'topup' | 'exchange' | 'atm' | 'fee' | 'other'

export type ExclusionReason =
  'non_eur' | 'internal_transfer' | 'investment' | 'manual'

export type Transaction = {
  id: string // content hash of sourceBank + date + currency + amountRaw + rawDescription
  date: string // ISO 8601, YYYY-MM-DD
  currency: string
  amountRaw: number // in currency units, 2 decimals
  amountEur: number | null
  rawDescription: string
  merchant: string | null // normalized; null on rows that have no merchant
  category: Category | null
  subcategory: Subcategory | null
  account: string // captured, not used: which account at that bank
  sourceBank: BankId
  type: TransactionType
  excluded: boolean
  exclusionReason: ExclusionReason | null
  notes: string
}
