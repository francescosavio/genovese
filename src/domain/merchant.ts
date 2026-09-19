// Payment terminals prefix the real merchant: 'SumUp *Bar Centrale', 'CCV*ALBERT'.
const TERMINAL_PREFIX = /^[\p{L}\p{N}]{1,8}\s*\*\s*/u
const NON_WORD = /[^\p{L}\p{N}&]+/gu

// Grouping key
export function normaliseMerchant(rawDescription: string): string | null {
  const key = rawDescription
    .toLowerCase()
    .replace(TERMINAL_PREFIX, '')
    .replace(NON_WORD, ' ')
    .trim()
  return key === '' ? null : key
}
