import type { Category, Subcategory } from './categories'
import type { Transaction } from './transaction'

export type MerchantGroup = {
  merchant: string
  sample: string // original description, helpful for categorization
  count: number
  totalEur: number
  category: Category | null
  subcategory: Subcategory | null
}

// A type predicate: past this check the compiler knows merchant is a string.
const groupable = (tx: Transaction): tx is Transaction & { merchant: string } =>
  tx.merchant !== null

const decided = (g: MerchantGroup) => g.category !== null

// Undecided first, then sorted by value
function byImpact(a: MerchantGroup, b: MerchantGroup): number {
  if (decided(a) !== decided(b)) return decided(a) ? 1 : -1
  return Math.abs(b.totalEur) - Math.abs(a.totalEur)
}

export function groupByMerchant(transactions: Transaction[]): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup>()

  for (const tx of transactions) {
    if (!groupable(tx)) continue

    const existing = groups.get(tx.merchant)
    if (existing) {
      // append case
      existing.count += 1
      existing.totalEur += tx.amount
      // A merchant is decided if any of its transactions is.
      existing.category ??= tx.category
      existing.subcategory ??= tx.subcategory
    } else {
      // group creation
      groups.set(tx.merchant, {
        merchant: tx.merchant,
        sample: tx.rawDescription,
        count: 1,
        totalEur: tx.amount,
        category: tx.category,
        subcategory: tx.subcategory,
      })
    }
  }

  return [...groups.values()]
    .map((g) => ({ ...g, totalEur: Math.round(g.totalEur * 100) / 100 }))
    .sort(byImpact)
}

export type Coverage = {
  categorised: number
  total: number
  percent: number
}

// Measured in transactions
export function coverage(transactions: Transaction[]): Coverage {
  const categorised = transactions.filter((tx) => tx.category !== null).length
  return {
    categorised,
    total: transactions.length,
    percent:
      transactions.length === 0
        ? 0
        : Math.round((categorised / transactions.length) * 100),
  }
}
