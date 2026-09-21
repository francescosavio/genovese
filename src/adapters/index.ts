import Papa from 'papaparse'
import type { BankAdapter } from '@/domain/bank-adapter'
import { ingAdapter } from './ing'
import { revolutAdapter } from './revolut'

export const ADAPTERS: BankAdapter[] = [revolutAdapter, ingAdapter]

export function adapterFor(csv: string): BankAdapter | null {
  // Papa finds the delimiter and unquotes the header itself. Splitting on a
  // comma breaks on ING, whose headers are quoted, and on any bank using ";".
  const { data } = Papa.parse<string[]>(csv, {
    preview: 1,
    skipEmptyLines: true,
  })
  const headers = (data[0] ?? []).map((h) => h.trim())
  return ADAPTERS.find((a) => a.detect(headers)) ?? null
}
