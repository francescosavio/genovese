import type { Transaction } from './transaction'

export const VIEWS = ['all', 'uncategorised'] as const
export type TransactionView = (typeof VIEWS)[number]

const matchesView = (tx: Transaction, view: TransactionView): boolean =>
  view === 'all' || tx.category === null

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
  }
}
