import Papa from 'papaparse'
import type { BankAdapter, SkippedRow } from '@/domain/bank-adapter'
import { contentHash } from '@/domain/hash'
import { normaliseMerchant } from '@/domain/merchant'
import type { Transaction, TransactionType } from '@/domain/transaction'

const REQUIRED_HEADERS = [
  'Date',
  'Name / Description',
  'Account',
  'Debit/credit',
  'Amount (EUR)',
  'Transaction type',
]

const TYPE_MAP: Record<string, TransactionType> = {
  paymentterminal: 'card_payment',
  idealwero: 'card_payment',
  ideal: 'card_payment',
  transfer: 'transfer',
  onlinebanking: 'transfer',
  sepadirectdebit: 'transfer',
  various: 'fee',
  cashmachine: 'atm',
}

const DATE = /^(\d{4})(\d{2})(\d{2})$/

const round2 = (n: number) => Math.round(n * 100) / 100

function mapType(raw: string): TransactionType {
  return TYPE_MAP[raw.toLowerCase().replace(/[^a-z]/g, '')] ?? 'other'
}

// Dutch formatting: "1.358,00"
function parseAmount(raw: string): number {
  const text = raw.trim()
  const normalised = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text
  const value = Number(normalised)
  return Number.isFinite(value) ? value : NaN
}

export const ingAdapter: BankAdapter = {
  id: 'ing',
  label: 'ING',

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
      const rawDescription = (row['Name / Description'] ?? '').trim()
      const parts = DATE.exec((row.Date ?? '').trim())
      const date = parts ? `${parts[1]}-${parts[2]}-${parts[3]}` : undefined
      const magnitude = parseAmount(row['Amount (EUR)'] ?? '')
      const direction = (row['Debit/credit'] ?? '').trim().toLowerCase()

      if (!date || Number.isNaN(magnitude) || direction === '') {
        skipped.push({
          reason: 'unparsable',
          detail: (row.Date ?? '').trim(),
          rawDescription,
        })
        continue
      }

      // ING always writes a positive number and puts the direction in its own
      // column, so the sign has to be reassembled here.
      const amount = round2(direction === 'credit' ? magnitude : -magnitude)

      transactions.push({
        // Notifications holds the bank's own reference, date carries not time.
        id: contentHash(
          `ing|${date}|EUR|${amount}|${rawDescription}|${(row.Notifications ?? '').trim()}`,
        ),
        date,
        amount, // the export is a single-currency account
        rawDescription,
        merchant: normaliseMerchant(rawDescription),
        category: null,
        subcategory: null,
        account: (row.Account ?? '').trim(),
        sourceBank: 'ing',
        type: mapType(row['Transaction type'] ?? ''),
        notes: '',
      })
    }

    return { transactions, skipped }
  },
}
