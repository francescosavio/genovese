import { describe, expect, test } from 'vitest'
import { adapterFor } from './index'
import { counterparty, mediolanumAdapter, parseAmount } from './mediolanum'

// Shaped like the real export: an account summary, two quoted blank fields,
// then the movements. Every name, IBAN and reference here is made up.
const PREAMBLE = [
  'Nickname;IBAN;Saldo contabile;Saldo disponibile',
  '-;IT00X0306200000000000000001;1.234,56 €;1.234,56 €',
  'Numero del conto 001/00000001/07;;;Intestato a: Test User',
  '"',
  '"',
  '"',
  '"',
  'Operazione;Valuta;Tipologia Operazione;Descrizione;Uscite;Entrate',
]

type Row = {
  booked?: string
  value?: string
  kind?: string
  description?: string
  out?: string
  in?: string
}

const CARD =
  "PAGAMENTI PAESI UE CARTA N. 000 DEL 07/05/25 VALUTA EUR PAESE PAESI BASSI C/O HEMA EV001 A'DAM AMSTERDAM CARTA N. 000000******0000 - CIRCUITO MASTERCARD COD. MCC 5311 000000000001"

function row(r: Row = {}): string {
  return [
    r.booked ?? '12/05/2025',
    r.value ?? '07/05/2025',
    r.kind ?? 'Prelievi - Pagamenti',
    r.description ?? CARD,
    r.out ?? (r.in ? '' : '-43.56 €'),
    r.in ?? '',
  ].join(';')
}

// With the byte-order mark and CRLF endings the real file has
const csv = (...rows: string[]) => '﻿' + [...PREAMBLE, ...rows].join('\r\n')

function parseOne(r: Row = {}) {
  const [tx] = mediolanumAdapter.parse(csv(row(r))).transactions
  if (!tx) throw new Error('expected exactly one transaction')
  return tx
}

describe('detect', () => {
  test('recognises the export by its account summary', () => {
    expect(adapterFor(csv(row()))?.id).toBe('mediolanum')
  })

  test('does not claim a Revolut or ING export', () => {
    expect(
      mediolanumAdapter.detect([
        'Type',
        'Started Date',
        'Description',
        'Amount',
      ]),
    ).toBe(false)
    expect(
      mediolanumAdapter.detect(['Date', 'Name / Description', 'Debit/credit']),
    ).toBe(false)
  })

  test('a file with the summary but no movements is a clear error', () => {
    expect(() =>
      mediolanumAdapter.parse('Nickname;IBAN;Saldo contabile\n-;IT00;0 €'),
    ).toThrow(/no table of movements/)
  })
})

describe('reading a row', () => {
  test('finds the movements below the summary', () => {
    expect(parseOne()).toMatchObject({
      amount: -43.56,
      sourceBank: 'mediolanum',
      account: 'IT00X0306200000000000000001',
      type: 'card_payment',
    })
  })

  // The card was used on the 7th; the bank booked it on the 12th.
  test('the date is the value date, not the booking date', () => {
    expect(parseOne().date).toBe('2025-05-07')
  })

  test('Uscite is money out, Entrate is money in', () => {
    expect(parseOne({ out: '-21.00 €' }).amount).toBe(-21)
    expect(parseOne({ in: '1184.18 €' }).amount).toBe(1184.18)
  })

  test.each([
    ['-21.00 €', -21],
    ['1317.00 €', 1317],
    ['3.841,47 €', 3841.47],
    ['1,184.18 €', 1184.18],
    ['-0,45 €', -0.45],
  ])('%j reads as %d', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected)
  })

  test('a row with neither amount is skipped and reported', () => {
    const { transactions, skipped } = mediolanumAdapter.parse(
      csv(row({ out: '', in: '' })),
    )
    expect(transactions).toEqual([])
    expect(skipped[0]?.reason).toBe('unparsable')
  })

  test('a row with an unreadable date is skipped and reported', () => {
    const { skipped } = mediolanumAdapter.parse(
      csv(row({ value: '2025-05-07' })),
    )
    expect(skipped[0]).toMatchObject({
      reason: 'unparsable',
      detail: '2025-05-07',
    })
  })
})

// Every other part of the description is unique per row, so this is what
// decides whether a merchant is categorised once or every month.
describe('counterparty', () => {
  test.each([
    ['card payment', CARD, "HEMA EV001 A'DAM AMSTERDAM"],
    [
      'card payment in Italy, with a stray PAESE',
      'PAGAMENTI PAESI UE CARTA N. 000 DEL 02/05/25 VALUTA EUR PAESE ITALIA C/O ACME CARBURANTI SPA PAESE CARTA N. 000000******0000 - CIRCUITO MASTERCARD',
      'ACME CARBURANTI SPA',
    ],
    [
      'direct debit',
      'ADDEBITO DIRETTO CORE RCUR PRG.CAR.: 250000000000001 MND0000000001 ACME INSURANCE - ADDEBITO ACME - N 1 000/2025 - ACMEXXXX IT000000000000',
      'ACME INSURANCE',
    ],
    [
      'utility debit',
      'PAGAMENTO UTENZA TELEFONICA CORE FRST PRG.CAR.: 250000000000002 3F00000000 ACME TELECOM SPA - ADDEBITO ACME 2025 - M000 SDD 000',
      'ACME TELECOM SPA',
    ],
    [
      'salary',
      'EMOLUMENTI ACME S.P.A. NOTE: RETRIBUZIONE MESE GIUGNO 2025 DATA REGOLAMENTO: 10/07/25 CRO: 0000000000000001',
      'ACME S.P.A.',
    ],
    [
      'transfer in',
      'DISPOSIZIONE VS. FAVORE MARIO ROSSI VAL. ACCREDITO: 07/07/25 COD.ID.ORD: IT00 X000 0000 0000 CRO: 00000000001 NOTE: REGALO',
      'MARIO ROSSI',
    ],
    [
      'instant transfer in',
      'BONIFICO - SEPA ISTANTANEO MARIO ROSSI VAL. ACCREDITO: 10/05/25 COD.ID.ORD: IT00 X000 0000 0000 CRO: ABC NOTE: GRAZIE',
      'MARIO ROSSI',
    ],
    [
      'instant transfer out',
      'BONIFICO - SEPA ISTANTANEO ANNA BIANCHI BONIFICO DISPOSTO IN: INTERNET COOR.BENEF.: IT00 X000 CRO: ABC NOTE: CENA',
      'ANNA BIANCHI',
    ],
    [
      'SEPA transfer out',
      'BONIFICO SEPA TEST USER BONIFICO DISPOSTO IN: INTERNET COOR.BENEF.: LT00 0000 CRO: 0000 NOTE: TOP UP',
      'TEST USER',
    ],
    [
      'standing order to a person',
      'VOSTRA DISPOSIZIONE A FAV. LUIGI VERDI BONIFICO DISPOSTO IN: INTERNET COOR.BENEF.: IT00 X000 CRO: 0000 NOTE: REGALO',
      'LUIGI VERDI',
    ],
    [
      'standing order to a company',
      'VOSTRA DISPOSIZIONE ACME SIM S.P.A. C-TERZI - BANCA ACME BONIFICO DISPOSTO IN: INTERNET CRO: 0000 NOTE: CODICE CLIENTE',
      'ACME SIM S.P.A. C-TERZI - BANCA ACME',
    ],
  ])('%s', (_, description, expected) => {
    expect(counterparty(description)).toBe(expected)
  })

  test('joint holders in either order are one merchant', () => {
    const a = parseOne({
      in: '100.00 €',
      description:
        'DISPOSIZIONE VS. FAVORE ROSSI MARIO, BIANCHI ANNA VAL. ACCREDITO: 07/07/25 CRO: 1',
    })
    const b = parseOne({
      in: '100.00 €',
      description:
        'DISPOSIZIONE VS. FAVORE BIANCHI ANNA, ROSSI MARIO VAL. ACCREDITO: 23/05/25 CRO: 2',
    })
    expect(a.merchant).toBe(b.merchant)
  })

  test('the same transfer every month is one merchant', () => {
    const june = parseOne({
      description:
        'BONIFICO SEPA JOHN SMITH BONIFICO DISPOSTO IN: INTERNET CRO: 0001 NOTE: JUNE RENT',
    })
    const july = parseOne({
      description:
        'BONIFICO SEPA JOHN SMITH BONIFICO DISPOSTO IN: INTERNET CRO: 0002 NOTE: JULY RENT',
    })
    expect(june.merchant).toBe('john smith')
    expect(july.merchant).toBe(june.merchant)
  })

  // A new shape shows up as a one-off merchant, which is visible, instead of
  // being folded into some other merchant by a loose guess.
  test('an unknown shape keeps the whole description', () => {
    expect(counterparty('IMPOSTA DI BOLLO')).toBe('IMPOSTA DI BOLLO')
  })
})

describe('ids', () => {
  test('two identical payments on one day are two transactions', () => {
    const { transactions } = mediolanumAdapter.parse(csv(row(), row()))
    expect(new Set(transactions.map((t) => t.id)).size).toBe(2)
  })

  test('re-importing the same file gives the same ids', () => {
    const file = csv(row(), row(), row({ out: '-5.00 €' }))
    expect(mediolanumAdapter.parse(file).transactions.map((t) => t.id)).toEqual(
      mediolanumAdapter.parse(file).transactions.map((t) => t.id),
    )
  })

  // An export of a longer period holds the same rows, so they must hash the same.
  test('the same rows in a wider export keep their ids', () => {
    const narrow = mediolanumAdapter.parse(csv(row(), row()))
    const wide = mediolanumAdapter.parse(
      csv(row({ value: '20/06/2025', out: '-9.00 €' }), row(), row()),
    )
    expect(wide.transactions.slice(1).map((t) => t.id)).toEqual(
      narrow.transactions.map((t) => t.id),
    )
  })
})
