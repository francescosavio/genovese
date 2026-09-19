import type { Transaction } from '@/domain/transaction'
import { describe, expect, test } from 'vitest'
import * as XLSX from 'xlsx'
import {
  SCHEMA_VERSION,
  SHEETS,
  exportFilename,
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
    excluded: false,
    exclusionReason: null,
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
