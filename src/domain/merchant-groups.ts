import type { Category, Subcategory } from './categories'
import type { Transaction } from './transaction'

export type MerchantGroup = {
  merchant: string
  sample: string // original description, helpful for categorization
  count: number
  totalEur: number
  category: Category | null
  subcategory: Subcategory | null
  excluded: boolean // marked as not spending
}

// Non-EUR rows have no value to show and are not work. Rows I marked as not
// spending stay: otherwise the merchant would vanish and I could never
// change my mind about it.
const groupable = (tx: Transaction) =>
  tx.merchant !== null && tx.exclusionReason !== 'non_eur'

// Work, not exclusion: a merchant I marked as not spending is decided.
const decided = (g: MerchantGroup) => g.category !== null || g.excluded

// Undecided first, then sorted by value
function byImpact(a: MerchantGroup, b: MerchantGroup): number {
  if (decided(a) !== decided(b)) return decided(a) ? 1 : -1
  return Math.abs(b.totalEur) - Math.abs(a.totalEur)
}

export function groupByMerchant(transactions: Transaction[]): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup>()

  for (const tx of transactions) {
    if (!groupable(tx) || tx.merchant === null) continue

    const notSpending = tx.exclusionReason === 'not_spending'
    const existing = groups.get(tx.merchant)
    if (existing) {
      existing.count += 1
      existing.totalEur += tx.amountEur ?? 0
      // A merchant is decided if any of its transactions is.
      existing.category ??= tx.category
      existing.subcategory ??= tx.subcategory
      existing.excluded ||= notSpending
    } else {
      groups.set(tx.merchant, {
        merchant: tx.merchant,
        sample: tx.rawDescription,
        count: 1,
        totalEur: tx.amountEur ?? 0,
        category: tx.category,
        subcategory: tx.subcategory,
        excluded: notSpending,
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
  const countables = transactions.filter((tx) => !tx.excluded)
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
