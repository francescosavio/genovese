import type { Transaction } from '@/domain/transaction'
import type { MerchantOverride } from './db'
import { describe, expect, test } from 'vitest'
import * as XLSX from 'xlsx'
import {
  SCHEMA_VERSION,
  SHEETS,
  exportFilename,
  fromWorkbook,
  toWorkbook,
} from './spreadsheet'

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 'a',
    date: '2026-09-01',
    currency: 'EUR',
    amountRaw: -12.34,
    amountEur: -12.34,
    rawDescription: 'Albert Heijn',
    merchant: 'albert heijn',
    category: null,
    subcategory: null,
    account: 'Current',
    sourceBank: 'revolut',
    type: 'card_payment',
    notes: '',
    ...over,
  }
}

const rows = (book: XLSX.WorkBook, name: string) =>
  XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[name]!)

describe('workbook shape', () => {
  test('has exactly the three sheets the format defines', () => {
    expect(toWorkbook([]).SheetNames).toEqual([
      SHEETS.transactions,
      SHEETS.merchants,
      SHEETS.meta,
    ])
  })

  test('meta carries the schema version', () => {
    const meta = rows(toWorkbook([]), SHEETS.meta)
    expect(meta).toContainEqual({
      key: 'schema_version',
      value: SCHEMA_VERSION,
    })
  })

  test('merchants exists but is empty until Phase 5', () => {
    expect(rows(toWorkbook([]), SHEETS.merchants)).toEqual([])
  })
})

describe('transaction rows', () => {
  test('amounts stay numbers, not text', () => {
    const [row] = rows(toWorkbook([tx({ amountRaw: -12.34 })]), 'transactions')
    expect(row?.amountRaw).toBe(-12.34)
    expect(typeof row?.amountRaw).toBe('number')
  })

  test('dates stay ISO strings, not Excel serial numbers', () => {
    const [row] = rows(toWorkbook([tx({ date: '2026-03-04' })]), 'transactions')
    expect(row?.date).toBe('2026-03-04')
  })

  test('rows are ordered by date', () => {
    const book = toWorkbook([
      tx({ id: 'c', date: '2026-09-03' }),
      tx({ id: 'a', date: '2026-09-01' }),
      tx({ id: 'b', date: '2026-09-02' }),
    ])
    expect(rows(book, 'transactions').map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  test('every year lives in the one sheet', () => {
    const book = toWorkbook([
      tx({ id: 'x', date: '2024-01-01' }),
      tx({ id: 'y', date: '2026-09-01' }),
    ])
    expect(book.SheetNames).not.toContain('2024')
    expect(rows(book, 'transactions')).toHaveLength(2)
  })
})

describe('filename', () => {
  test('carries the date so a download never overwrites the last one', () => {
    expect(exportFilename(new Date('2026-09-19T10:00:00Z'))).toBe(
      'genovese-2026-09-19.xlsx',
    )
  })
})

function roundTrip(
  transactions: Transaction[],
  merchantOverrides: MerchantOverride[] = [],
) {
  const bytes = XLSX.write(toWorkbook(transactions, merchantOverrides), {
    type: 'buffer',
    bookType: 'xlsx',
  }) as Buffer
  return fromWorkbook(XLSX.read(bytes, { type: 'buffer' }))
}

describe('round trip', () => {
  test('import(export(x)) equals x', () => {
    const input = [
      tx({ id: 'a', date: '2024-01-15', amountRaw: -10, amountEur: -10 }),
      tx({
        id: 'b',
        date: '2026-09-02',
        amountRaw: -46.36,
        amountEur: -46.36,
        category: 'Food',
        subcategory: 'Groceries',
        notes: 'weekly shop',
      }),
      tx({
        id: 'c',
        date: '2026-09-04',
        currency: 'USD',
        amountRaw: -20,
        amountEur: null,
        merchant: null,
        type: 'transfer',
      }),
    ]
    const mappings: MerchantOverride[] = [
      {
        merchant: 'albert heijn',
        category: 'Food',
        subcategory: 'Groceries',
        updatedAt: '2026-09-19T10:00:00.000Z',
      },
      {
        merchant: 'netflix',
        category: 'Subscription',
        subcategory: null,
        updatedAt: '2026-09-19T10:00:00.000Z',
      },
    ]
    const { transactions, merchantOverrides, warnings } = roundTrip(
      input,
      mappings,
    )

    expect(warnings).toEqual([])
    expect(transactions).toEqual(
      [...input].sort((a, b) => a.date.localeCompare(b.date)),
    )
    expect(merchantOverrides).toEqual(
      [...mappings].sort((a, b) => a.merchant.localeCompare(b.merchant)),
    )
  })

  test('an empty file survives the trip', () => {
    expect(roundTrip([])).toEqual({
      transactions: [],
      merchantOverrides: [],
      warnings: [],
    })
  })

  test('amounts do not drift through the file', () => {
    const { transactions } = roundTrip([
      tx({ id: 'a', amountRaw: -0.45, amountEur: -0.45 }),
      tx({ id: 'b', amountRaw: -1234.56, amountEur: -1234.56 }),
    ])
    expect(transactions.map((t) => t.amountRaw)).toEqual([-0.45, -1234.56])
  })
})

describe('reading a file manually edited', () => {
  const sheetWith = (row: Record<string, unknown>) => {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet([row]),
      SHEETS.transactions,
    )
    return fromWorkbook(book)
  }

  test('a misspelled category is reported, not silently accepted', () => {
    const { transactions, warnings } = sheetWith({
      id: 'a',
      date: '2026-09-01',
      amountRaw: -1,
      category: 'Grocery',
    })
    expect(transactions[0]?.category).toBeNull()
    expect(warnings[0]).toMatch(/unknown category "Grocery"/)
  })

  test('a sub-category under the wrong parent is dropped with a warning', () => {
    const { transactions, warnings } = sheetWith({
      id: 'a',
      date: '2026-09-01',
      amountRaw: -1,
      category: 'Car',
      subcategory: 'Books',
    })
    expect(transactions[0]).toMatchObject({
      category: 'Car',
      subcategory: null,
    })
    expect(warnings[0]).toMatch(/not a sub-category of Car/)
  })

  test('a row with no id is skipped and reported', () => {
    const { transactions, warnings } = sheetWith({
      date: '2026-09-01',
      amountRaw: -1,
    })
    expect(transactions).toHaveLength(0)
    expect(warnings[0]).toMatch(/row 2: missing id/)
  })

  test('a date cell reformatted by Excel still reads as an ISO date', () => {
    const { transactions, warnings } = sheetWith({
      id: 'a',
      date: new Date(Date.UTC(2026, 8, 1)),
      amountRaw: -1,
    })
    expect(transactions[0]?.date).toBe('2026-09-01')
    expect(warnings).toEqual([])
  })

  test('a file with no transactions sheet is a clear error', () => {
    expect(() => fromWorkbook(XLSX.utils.book_new())).toThrow(
      /not a Genovese file/,
    )
  })
})

describe('merchant mappings without a category', () => {
  function merchantsSheet(row: Record<string, unknown>) {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet([]),
      SHEETS.transactions,
    )
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet([row]),
      SHEETS.merchants,
    )
    return fromWorkbook(book)
  }

  test('a row with no category is skipped and reported', () => {
    const { merchantOverrides, warnings } = merchantsSheet({
      merchant: 'mystery',
      updatedAt: '',
    })
    expect(merchantOverrides).toEqual([])
    expect(warnings.join(' ')).toMatch(/no category for "mystery"/)
  })

  // Salary or transfer is not guessed; the merchant goes back to the list.
  test('an old not-spending mark comes back uncategorised, with a warning', () => {
    const { merchantOverrides, warnings } = merchantsSheet({
      merchant: 'hr f savio',
      category: '',
      excluded: 'TRUE',
      updatedAt: '',
    })
    expect(merchantOverrides).toEqual([])
    expect(warnings.join(' ')).toMatch(/"hr f savio" was marked not spending/)
  })
})
