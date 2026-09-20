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

// Discard excluded rows
const countable = (tx: Transaction) => !tx.excluded && tx.merchant !== null

// Uncategorized first, then sorted by value
function byImpact(a: MerchantGroup, b: MerchantGroup): number {
  if ((a.category === null) !== (b.category === null)) {
    return a.category === null ? -1 : 1
  }
  return Math.abs(b.totalEur) - Math.abs(a.totalEur)
}

export function groupByMerchant(transactions: Transaction[]): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup>()

  for (const tx of transactions) {
    if (!countable(tx) || tx.merchant === null) continue

    const existing = groups.get(tx.merchant)
    if (existing) {
      existing.count += 1
      existing.totalEur += tx.amountEur ?? 0
      // A merchant is categorized if any of its transactions is.
      existing.category ??= tx.category
      existing.subcategory ??= tx.subcategory
    } else {
      groups.set(tx.merchant, {
        merchant: tx.merchant,
        sample: tx.rawDescription,
        count: 1,
        totalEur: tx.amountEur ?? 0,
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
  const countables = transactions.filter(countable)
  const categorised = countables.filter((tx) => tx.category !== null).length
  return {
    categorised,
    total: countables.length,
    percent:
      countables.length === 0
        ? 0
        : Math.round((categorised / countables.length) * 100),
  }
}
