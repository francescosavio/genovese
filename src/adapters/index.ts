import type { BankAdapter } from '@/domain/bank-adapter'
import { revolutAdapter } from './revolut'
import {ingAdapter} from "@/adapters/ing.ts";

export const ADAPTERS: BankAdapter[] = [revolutAdapter, ingAdapter]

export function adapterFor(csv: string): BankAdapter | null {
  const headers = (csv.split(/\r?\n/, 1)[0] ?? '')
    .split(',') // need to support ; delimiter
    .map((h) => h.trim())
    .map((h) => h.replaceAll("\"", ''))

  console.info('headers', headers)
  return ADAPTERS.find((a) => a.detect(headers)) ?? null
}
