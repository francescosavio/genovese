import type { BankId, Transaction } from './transaction'

export type SkipReason = 'pending' | 'reverted' | 'unparsable'

export type SkippedRow = {
  reason: SkipReason
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
