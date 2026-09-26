import type { BankId, Transaction } from './transaction'

export type SkipReason = 'not_completed' | 'not_eur' | 'unparsable'

export type SkippedRow = {
  reason: SkipReason
  detail: string // the bank's own wording
  rawDescription: string
}

export type ParseResult = {
  transactions: Transaction[]
  skipped: SkippedRow[]
}

export type BankAdapter = {
  id: BankId
  label: string
  detect(headers: string[]): boolean
  parse(csv: string): ParseResult
}
