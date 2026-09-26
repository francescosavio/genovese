import Papa from 'papaparse'
import type { BankAdapter, SkippedRow } from '@/domain/bank-adapter'
import { contentHash } from '@/domain/hash'
import { normaliseMerchant } from '@/domain/merchant'
import type { Transaction, TransactionType } from '@/domain/transaction'

// The export opens with an account summary; this is its header row.
const PREAMBLE_HEADERS = ['Nickname', 'IBAN', 'Saldo contabile']

const COLUMNS = {
  booked: 'Operazione',
  value: 'Valuta',
  kind: 'Tipologia Operazione',
  description: 'Descrizione',
  out: 'Uscite',
  in: 'Entrate',
} as const

const TYPE_MAP: Record<string, TransactionType> = {
  prelievipagamenti: 'card_payment',
  pagamenti: 'transfer',
  bonifici: 'transfer',
  addebitidiretti: 'transfer',
  stipendipensioni: 'transfer',
}

// The description holds the counterparty plus IBANs, dates and a unique CRO
// reference, so normalising all of it would make every row its own merchant.
// One pattern per shape the bank writes; the first match wins.
const COUNTERPARTY = [
  /C\/O (.+?)(?: PAESE)? CARTA N\./, // card payment
  /PRG\.CAR\.: \S+ \S+ (.+?) - /, // direct debit: after the mandate ids
  /^EMOLUMENTI (.+?) NOTE:/, // salary
  /^DISPOSIZIONE VS\. FAVORE (.+?) VAL\. ACCREDITO/, // transfer in
  /^(?:BONIFICO - SEPA ISTANTANEO|BONIFICO SEPA|VOSTRA DISPOSIZIONE(?: A FAV\.)?) (.+?) (?:BONIFICO DISPOSTO|VAL\. ACCREDITO)/, // transfer, either way
]

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/

function mapType(raw: string): TransactionType {
  return TYPE_MAP[raw.toLowerCase().replace(/[^a-z]/g, '')] ?? 'other'
}

// Joint holders come in either order, which would make two merchants.
export function counterparty(description: string): string {
  for (const pattern of COUNTERPARTY) {
    const name = pattern.exec(description)?.[1]
    if (name) return name.split(', ').sort().join(', ')
  }
  // Unknown shape: stays visible as its own merchant rather than guessed.
  return description
}

// "-21.00 €" here, "3.841,47 €" in the summary: the separator before the
// last two digits is the decimal one, whichever it is.
export function parseAmount(raw: string): number {
  const text = raw.replace(/[^\d,.-]/g, '')
  if (text === '') return NaN
  const parts = /^(-?)([\d.,]*)[.,](\d{2})$/.exec(text)
  if (!parts) return Number(text.replace(/[.,]/g, ''))
  return Number(`${parts[1]}${parts[2]!.replace(/[.,]/g, '')}.${parts[3]}`)
}

const round2 = (n: number) => Math.round(n * 100) / 100

export const mediolanumAdapter = {
  id: 'mediolanum' as const,
  label: 'Mediolanum',

  detect(headers) {
    return PREAMBLE_HEADERS.every((h) => headers.includes(h))
  },

  parse(csv) {
    const { data } = Papa.parse<string[]>(csv, { skipEmptyLines: true })

    const iban = data[1]?.[data[0]?.indexOf('IBAN') ?? -1]?.trim() ?? ''
    const start = data.findIndex(
      (row) => row[0]?.trim() === COLUMNS.booked && row.includes(COLUMNS.value),
    )
    if (start === -1) {
      throw new Error('This Mediolanum export has no table of movements.')
    }
    const header = data[start]!.map((h) => h.trim())
    const at = (row: string[], column: string) =>
      (row[header.indexOf(column)] ?? '').trim()

    const transactions: Transaction[] = []
    const skipped: SkippedRow[] = []
    // No time and no reference column: two identical card payments on one day
    // are told apart by how many times the row has been seen in this file.
    const seen = new Map<string, number>()

    for (const row of data.slice(start + 1)) {
      const rawDescription = at(row, COLUMNS.description)
      // Value date: when the card was used, not when the bank booked it.
      const valueDate = at(row, COLUMNS.value)
      const parts = DATE.exec(valueDate)
      const out = at(row, COLUMNS.out)
      const incoming = at(row, COLUMNS.in)
      const magnitude = Math.abs(parseAmount(out || incoming))

      if (
        !parts ||
        Number.isNaN(magnitude) ||
        (out === '') === (incoming === '')
      ) {
        skipped.push({
          reason: 'unparsable',
          detail: valueDate,
          rawDescription,
        })
        continue
      }

      const date = `${parts[3]}-${parts[2]}-${parts[1]}`
      const amount = round2(out ? -magnitude : magnitude)
      const content = `mediolanum|${date}|${at(row, COLUMNS.booked)}|${amount}|${rawDescription}`
      const occurrence = (seen.get(content) ?? 0) + 1
      seen.set(content, occurrence)

      transactions.push({
        id: contentHash(`${content}|${occurrence}`),
        date,
        amount,
        rawDescription,
        merchant: normaliseMerchant(counterparty(rawDescription)),
        category: null,
        subcategory: null,
        account: iban,
        sourceBank: 'mediolanum',
        type: mapType(at(row, COLUMNS.kind)),
        notes: '',
      })
    }

    return { transactions, skipped }
  },
} satisfies BankAdapter
