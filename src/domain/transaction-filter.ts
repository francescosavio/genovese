import { inEur, type Transaction } from './transaction'

export const VIEWS = ['all', 'uncategorised', 'excluded'] as const
export type TransactionView = (typeof VIEWS)[number]

// Excluded means not in EUR. Such a row is not outstanding work, so it is
// never "uncategorised": same rule as the coverage bar, or the two disagree.
function matchesView(tx: Transaction, view: TransactionView): boolean {
  if (view === 'all') return true
  if (view === 'excluded') return !inEur(tx)
  return inEur(tx) && tx.category === null
}

const haystack = (tx: Transaction) =>
  `${tx.merchant ?? ''} ${tx.rawDescription} ${tx.category ?? ''} ${tx.subcategory ?? ''}`.toLowerCase()

export function filterTransactions(
  transactions: Transaction[],
  view: TransactionView,
  query = '',
): Transaction[] {
  const needle = query.trim().toLowerCase()
  return transactions.filter(
    (tx) =>
      matchesView(tx, view) && (needle === '' || haystack(tx).includes(needle)),
  )
}

export function countByView(
  transactions: Transaction[],
): Record<TransactionView, number> {
  return {
    all: transactions.length,
    uncategorised: filterTransactions(transactions, 'uncategorised').length,
    excluded: filterTransactions(transactions, 'excluded').length,
  }
}
