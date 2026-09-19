import type { Transaction } from '@/domain/transaction'
import * as XLSX from 'xlsx'

export const SCHEMA_VERSION = 1

export const SHEETS = {
  transactions: 'transactions',
  merchants: 'merchants',
  meta: 'meta',
} as const

const TRANSACTION_COLUMNS = [
  'id',
  'date',
  'currency',
  'amountRaw',
  'amountEur',
  'rawDescription',
  'merchant',
  'category',
  'subcategory',
  'account',
  'sourceBank',
  'type',
  'excluded',
  'exclusionReason',
  'notes',
] as const satisfies readonly (keyof Transaction)[]

function transactionRow(tx: Transaction): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const column of TRANSACTION_COLUMNS) row[column] = tx[column] ?? ''
  return row
}

export function toWorkbook(transactions: Transaction[]): XLSX.WorkBook {
  const book = XLSX.utils.book_new()

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  const sheet = XLSX.utils.json_to_sheet(sorted.map(transactionRow), {
    header: [...TRANSACTION_COLUMNS],
  })
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(book, sheet, SHEETS.transactions)

  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet([], {
      header: ['merchant', 'category', 'subcategory', 'updatedAt'],
    }),
    SHEETS.merchants,
  )

  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet([
      { key: 'schema_version', value: SCHEMA_VERSION },
      { key: 'exported_at', value: new Date().toISOString() },
      { key: 'currency', value: 'EUR' },
    ]),
    SHEETS.meta,
  )

  return book
}

export function exportFilename(now = new Date()): string {
  return `genovese-${now.toISOString().slice(0, 10)}.xlsx`
}

// Never overwrites: every download carries the day in its name.
export function downloadWorkbook(transactions: Transaction[]): void {
  XLSX.writeFile(toWorkbook(transactions), exportFilename(), {
    compression: true,
  })
}
