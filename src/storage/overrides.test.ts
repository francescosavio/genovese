import 'fake-indexeddb/auto'
import type { ParseResult } from '@/domain/bank-adapter'
import type { Transaction } from '@/domain/transaction'
import { beforeEach, describe, expect, test } from 'vitest'
import * as XLSX from 'xlsx'
import { db, type MerchantOverride } from './db'
import { importTransactions } from './import'
import {
  clearEverything,
  clearMerchantOverride,
  loadMerchantOverrides,
  setMerchantCategory,
} from './overrides'
import { SHEETS, fromWorkbook, toWorkbook } from './spreadsheet'

function tx(id: string, over: Partial<Transaction> = {}): Transaction {
  return {
    id,
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

const result = (...transactions: Transaction[]): ParseResult => ({
  transactions,
  skipped: [],
})

beforeEach(async () => {
  await db.transactions.clear()
  await db.merchants.clear()
})

describe('assigning a merchant', () => {
  test('categorises every transaction of that merchant at once', async () => {
    await importTransactions(
      result(tx('a'), tx('b'), tx('c', { merchant: 'solebox' })),
    )

    const touched = await setMerchantCategory(
      'albert heijn',
      'Food',
      'Groceries',
    )

    expect(touched).toBe(2)
    expect(await db.transactions.get('a')).toMatchObject({
      category: 'Food',
      subcategory: 'Groceries',
    })
    expect((await db.transactions.get('c'))?.category).toBeNull()
  })

  test('is remembered as a mapping, not just on the rows', async () => {
    await setMerchantCategory('albert heijn', 'Food', 'Groceries')
    expect((await loadMerchantOverrides()).get('albert heijn')).toMatchObject({
      category: 'Food',
      subcategory: 'Groceries',
    })
  })

  test('re-assigning replaces the old mapping', async () => {
    await setMerchantCategory('albert heijn', 'Food', 'Groceries')
    await setMerchantCategory('albert heijn', 'Home', 'Kitchen')

    const overrides = await loadMerchantOverrides()
    expect(overrides.size).toBe(1)
    expect(overrides.get('albert heijn')?.category).toBe('Home')
  })

  test('forgetting a mapping leaves the transactions categorised', async () => {
    await importTransactions(result(tx('a')))
    await setMerchantCategory('albert heijn', 'Food', 'Groceries')
    await clearMerchantOverride('albert heijn')

    expect(await db.merchants.count()).toBe(0)
    expect((await db.transactions.get('a'))?.category).toBe('Food')
  })
})

// This is the "never asks again" promise of the whole app.
describe('a later import', () => {
  test('auto-categorises a merchant decided in an earlier session', async () => {
    await setMerchantCategory('albert heijn', 'Food', 'Groceries')

    const report = await importTransactions(result(tx('new')))

    expect(report).toMatchObject({ added: 1, categorised: 1 })
    expect(await db.transactions.get('new')).toMatchObject({
      category: 'Food',
      subcategory: 'Groceries',
    })
  })

  test('leaves unknown merchants alone rather than guessing', async () => {
    await setMerchantCategory('albert heijn', 'Food', 'Groceries')

    const report = await importTransactions(
      result(tx('x', { merchant: 'bar cadaq' })),
    )

    expect(report).toMatchObject({ added: 1, categorised: 0 })
    expect((await db.transactions.get('x'))?.category).toBeNull()
  })

  test('a row with no merchant is never matched', async () => {
    await setMerchantCategory('albert heijn', 'Food', 'Groceries')
    await importTransactions(result(tx('y', { merchant: null })))
    expect((await db.transactions.get('y'))?.category).toBeNull()
  })
})

describe('the merchant table travels in the file', () => {
  const roundTrip = (
    transactions: Transaction[],
    overrides: MerchantOverride[],
  ) =>
    fromWorkbook(
      XLSX.read(
        XLSX.write(toWorkbook(transactions, overrides), {
          type: 'buffer',
          bookType: 'xlsx',
        }) as Buffer,
        { type: 'buffer' },
      ),
    )

  test('what Dexie stores is exactly what the file carries', async () => {
    await setMerchantCategory('albert heijn', 'Food', 'Groceries')
    await setMerchantCategory('netflix', 'Subscription', null)

    const { merchantOverrides, warnings } = roundTrip(
      [],
      await db.merchants.toArray(),
    )

    expect(warnings).toEqual([])
    expect(merchantOverrides).toEqual(
      [...(await db.merchants.toArray())].sort((a, b) =>
        a.merchant.localeCompare(b.merchant),
      ),
    )
  })

  test('a mapping to a category that no longer exists is reported, not kept', () => {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet([]),
      SHEETS.transactions,
    )
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet([
        { merchant: 'albert heijn', category: 'Groceries', updatedAt: '' },
      ]),
      SHEETS.merchants,
    )
    const { merchantOverrides, warnings } = fromWorkbook(book)

    expect(merchantOverrides).toEqual([])
    expect(warnings.join(' ')).toMatch(/unknown category "Groceries"/)
  })
})

describe('clearing everything', () => {
  // Clearing only the transactions leaves mappings that would silently
  // re-categorise the next import from data you thought you had deleted.
  test('empties the merchant table as well as the transactions', async () => {
    await importTransactions(result(tx('a')))
    await setMerchantCategory('albert heijn', 'Food', 'Groceries')

    await clearEverything()

    expect(await db.transactions.count()).toBe(0)
    expect(await db.merchants.count()).toBe(0)
  })

  test('a later import is not categorised by a mapping that was cleared', async () => {
    await setMerchantCategory('albert heijn', 'Food', 'Groceries')
    await clearEverything()

    const report = await importTransactions(result(tx('b')))

    expect(report).toMatchObject({ added: 1, categorised: 0 })
    expect((await db.transactions.get('b'))?.category).toBeNull()
  })
})
