import type { BankAdapter } from '@/domain/bank-adapter'
import { revolutAdapter } from './revolut'

export const ADAPTERS: BankAdapter[] = [revolutAdapter]

export function adapterFor(csv: string): BankAdapter | null {
  const headers = (csv.split(/\r?\n/, 1)[0] ?? '')
    .split(',')
    .map((h) => h.trim())
  return ADAPTERS.find((a) => a.detect(headers)) ?? null
}
