import {
  CATEGORIES,
  type Category,
  type Subcategory,
} from '@/domain/categories'
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

export type LoadResult = {
  transactions: Transaction[]
  warnings: string[]
}

// Excel turns a text column into real date cells the moment someone reformats
// it, so a Date here means the ISO string we wrote came back as an object.
function asText(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

const asOptional = (v: unknown): string | null => asText(v) || null

function asNumber(v: unknown): number | null {
  if (typeof v === 'number') return v
  const text = asText(v)
  if (text === '') return null
  const n = Number(text.replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

// Sheets may hand back a real boolean or the text manually written
const asBoolean = (v: unknown): boolean =>
  typeof v === 'boolean' ? v : /^(true|1|yes)$/i.test(asText(v))

function readCategory(
  row: Record<string, unknown>,
  warn: (message: string) => void,
): Pick<Transaction, 'category' | 'subcategory'> {
  const category = asOptional(row.category)
  const subcategory = asOptional(row.subcategory)
  if (category === null) return { category: null, subcategory: null }

  if (!(category in CATEGORIES)) {
    warn(`unknown category "${category}", left uncategorised`)
    return { category: null, subcategory: null }
  }

  const valid = CATEGORIES[category as Category] as readonly string[]
  if (subcategory !== null && !valid.includes(subcategory)) {
    warn(`"${subcategory}" is not a sub-category of ${category}, dropped`)
    return { category: category as Category, subcategory: null }
  }
  return {
    category: category as Category,
    subcategory: subcategory as Subcategory | null,
  }
}

export function fromWorkbook(book: XLSX.WorkBook): LoadResult {
  const sheet = book.Sheets[SHEETS.transactions]
  if (!sheet) {
    throw new Error(
      `This file has no "${SHEETS.transactions}" sheet, so it is not a Genovese file.`,
    )
  }

  const warnings: string[] = []
  const version = readSchemaVersion(book)
  if (version !== null && version > SCHEMA_VERSION) {
    warnings.push(
      `File was written by a newer version of the app (schema ${version}); some columns may be ignored.`,
    )
  }

  const transactions: Transaction[] = []
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

  rows.forEach((row, index) => {
    const line = index + 2 // header is line 1
    const warn = (message: string) => warnings.push(`row ${line}: ${message}`)

    const id = asText(row.id)
    const date = asText(row.date)
    const amountRaw = asNumber(row.amountRaw)

    if (id === '' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || amountRaw === null) {
      warn('missing id, date or amount, skipped')
      return
    }

    transactions.push({
      id,
      date,
      currency: asText(row.currency) || 'EUR',
      amountRaw,
      amountEur: asNumber(row.amountEur),
      rawDescription: asText(row.rawDescription),
      merchant: asOptional(row.merchant),
      ...readCategory(row, warn),
      account: asText(row.account),
      sourceBank: asText(row.sourceBank) === 'ing' ? 'ing' : 'revolut',
      type: asText(row.type) as Transaction['type'],
      excluded: asBoolean(row.excluded),
      exclusionReason: asOptional(
        row.exclusionReason,
      ) as Transaction['exclusionReason'],
      notes: asText(row.notes),
    })
  })

  return { transactions, warnings }
}

function readSchemaVersion(book: XLSX.WorkBook): number | null {
  const meta = book.Sheets[SHEETS.meta]
  if (!meta) return null
  const row = XLSX.utils
    .sheet_to_json<{ key?: unknown; value?: unknown }>(meta)
    .find((r) => asText(r.key) === 'schema_version')
  return row ? asNumber(row.value) : null
}

export async function readSpreadsheet(file: File): Promise<LoadResult> {
  return fromWorkbook(XLSX.read(await file.arrayBuffer(), { type: 'array' }))
}
