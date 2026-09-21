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
  ideal: 'card_payment',
  idealwero: 'card_payment',
  'ideal|wero': 'card_payment',
  onlinebanking: 'transfer',
  sepadirectdebit: 'transfer',
  transfer: 'topup',
  exchange: 'exchange',
  cashmachine: 'atm',
}

const DATE_TIME = /^(\d{4}\d{2}\d{2})$/

const round2 = (n: number) => Math.round(n * 100) / 100

function mapType(raw: string): TransactionType {
  return TYPE_MAP[raw.toLowerCase().replace(/[^a-z]/g, '')] ?? 'other'
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
      const dateRaw = (row.Date ?? '').trim()
      const date = DATE_TIME.exec(dateRaw)?.[1]
      const amount = Number((row['Amount (EUR)'] ?? '').replace(',', '.'))
      const currency = 'EUR'
      const credit  = row['Debit/credit'] === 'Credit'

      if (!date || !currency || Number.isNaN(amount)) {
        skipped.push({
          reason: 'unparsable',
          detail: rawDescription,
          rawDescription,
        })
        continue
      }

      const amountRaw = round2(amount)
      const type = mapType(row['Transaction type'] ?? '')
      const isEur = currency === 'EUR'


      transactions.push({
        id: contentHash(
            // we don't have the seconds but very unlikely to collide
          `ing|${date}|${currency}|${amountRaw}|${rawDescription}`,
        ),
        date,
        currency,
        amountRaw,
        amountEur: isEur ? amountRaw : null,
        rawDescription,
        merchant: normaliseMerchant(rawDescription),
        category: null,
        subcategory: null,
        account: (row.Account ?? '').trim(),
        sourceBank: 'ing',
        type,
        excluded: credit,
        exclusionReason: !isEur
          ? 'non_eur'
          : credit
            ? 'internal_transfer'
            : null,
        notes: '',
      })
    }
    console.info(transactions)
    return { transactions, skipped }
  },
}
