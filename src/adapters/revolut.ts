import Papa from 'papaparse'
import type { BankAdapter, SkippedRow } from '@/domain/bank-adapter'
import { contentHash } from '@/domain/hash'
import { normaliseMerchant } from '@/domain/merchant'
import type { Transaction, TransactionType } from '@/domain/transaction'

const REQUIRED_HEADERS = [
  'Type',
  'Started Date',
  'Description',
  'Amount',
  'Currency',
  'State',
]

const TYPE_MAP: Record<string, TransactionType> = {
  cardpayment: 'card_payment',
  cardrefund: 'card_payment',
  transfer: 'transfer',
  topup: 'topup',
  exchange: 'exchange',
  atm: 'atm',
}

const ROUTING_PREFIX = /^(payment from|to|from)\s+/i
const ROUTED: ReadonlySet<TransactionType> = new Set(['transfer', 'topup'])

const DATE_TIME = /^(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2}$/

const round2 = (n: number) => Math.round(n * 100) / 100

function mapType(raw: string): TransactionType {
  return TYPE_MAP[raw.toLowerCase().replace(/[^a-z]/g, '')] ?? 'other'
}

export const revolutAdapter: BankAdapter = {
  id: 'revolut',
  label: 'Revolut',

  detect(headers) {
    return REQUIRED_HEADERS.every((h) => headers.includes(h))
  },

  parse(csv) {
    const { data } = Papa.parse<Record<string, string | undefined>>(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })

    const transactions: Transaction[] = []
    const skipped: SkippedRow[] = []

    for (const row of data) {
      const rawDescription = (row.Description ?? '').trim()
      const state = (row.State ?? '').trim().toUpperCase()

      if (state !== 'COMPLETED') {
        skipped.push({ reason: 'not_completed', detail: state, rawDescription })
        continue
      }

      const startedAt = (row['Started Date'] ?? '').trim()
      const date = DATE_TIME.exec(startedAt)?.[1]
      const amount = Number(row.Amount)
      const currency = (row.Currency ?? '').trim().toUpperCase()

      if (!date || !currency || Number.isNaN(amount)) {
        skipped.push({
          reason: 'unparsable',
          detail: startedAt,
          rawDescription,
        })
        continue
      }

      // Rare enough to drop, and a foreign amount has no EUR value to count.
      if (currency !== 'EUR') {
        skipped.push({ reason: 'not_eur', detail: currency, rawDescription })
        continue
      }

      const rounded = round2(amount)
      const type = mapType(row.Type ?? '')

      transactions.push({
        id: contentHash(
          `revolut|${startedAt}|${currency}|${rounded}|${rawDescription}`,
        ),
        date,
        amount: rounded,
        rawDescription,
        merchant: normaliseMerchant(
          ROUTED.has(type)
            ? rawDescription.replace(ROUTING_PREFIX, '')
            : rawDescription,
        ),
        category: null,
        subcategory: null,
        account: (row.Product ?? '').trim(),
        sourceBank: 'revolut',
        type,
        notes: '',
      })
    }

    return { transactions, skipped }
  },
}
