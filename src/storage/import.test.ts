import 'fake-indexeddb/auto'
import type { ParseResult } from '@/domain/bank-adapter'
import type { Transaction } from '@/domain/transaction'
import { beforeEach, describe, expect, test } from 'vitest'
import { db } from './db'
import { importTransactions } from './import'

function tx(id: string, over: Partial<Transaction> = {}): Transaction {
  return {
    id,
    date: '2026-09-01',
    amount: -12.34,
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
})

describe('first import', () => {
  test('adds every transaction and reports it', async () => {
    const report = await importTransactions(result(tx('a'), tx('b')))
    expect(report).toEqual({
      added: 2,
      duplicates: 0,
      categorised: 0,
      skipped: 0,
    })
    expect(await db.transactions.count()).toBe(2)
  })

  test('reports rows the adapter never turned into transactions', async () => {
    const report = await importTransactions({
      transactions: [tx('a')],
      skipped: [
        { reason: 'not_completed', detail: 'PENDING', rawDescription: 'x' },
      ],
    })
    expect(report).toMatchObject({ added: 1, skipped: 1 })
  })
})

describe('re-import', () => {
  test('the same statement twice creates no duplicates', async () => {
    const statement = result(tx('a'), tx('b'))
    await importTransactions(statement)
    const second = await importTransactions(statement)

    expect(second).toMatchObject({ added: 0, duplicates: 2 })
    expect(await db.transactions.count()).toBe(2)
  })

  test('an overlapping statement adds only what is new', async () => {
    await importTransactions(result(tx('a'), tx('b')))
    const report = await importTransactions(result(tx('b'), tx('c')))

    expect(report).toMatchObject({ added: 1, duplicates: 1 })
    expect(await db.transactions.count()).toBe(3)
  })

  // The one irreversible risk in this project.
  test('re-importing never overwrites manual categorisation', async () => {
    await importTransactions(result(tx('a')))
    await db.transactions.update('a', {
      category: 'Food',
      subcategory: 'Groceries',
      notes: 'weekly shop',
    })

    await importTransactions(result(tx('a')))

    expect(await db.transactions.get('a')).toMatchObject({
      category: 'Food',
      subcategory: 'Groceries',
      notes: 'weekly shop',
    })
  })
})

describe('edge cases', () => {
  test('an empty statement is not an error', async () => {
    expect(await importTransactions(result())).toEqual({
      added: 0,
      duplicates: 0,
      categorised: 0,
      skipped: 0,
    })
  })
})
