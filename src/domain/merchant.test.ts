import { describe, expect, test } from 'vitest'
import { normaliseMerchant } from './merchant'

describe('grouping variants of one merchant', () => {
  test.each([
    ['Albert Heijn', 'albert heijn'],
    ['ALBERT HEIJN', 'albert heijn'],
    ['  Albert   Heijn  ', 'albert heijn'],
    ['Albert Heijn.', 'albert heijn'],
  ])('%j -> %j', (raw, expected) => {
    expect(normaliseMerchant(raw)).toBe(expected)
  })

  test('every variant produces the same key', () => {
    const keys = ['Albert Heijn', 'ALBERT HEIJN', 'albert  heijn!'].map(
      normaliseMerchant,
    )
    expect(new Set(keys).size).toBe(1)
  })
})

describe('payment terminal prefixes', () => {
  test.each([
    ['SumUp *Bar Centrale', 'bar centrale'],
    ['CCV*Cafe CA centrale', 'cafe ca centrale'],
    ['iZ *Firenze IJs', 'firenze ijs'],
    ['ZTL*Amazon', 'amazon'],
  ])('%j -> %j', (raw, expected) => {
    expect(normaliseMerchant(raw)).toBe(expected)
  })

  test('PayPal keeps the tail, because the tail is the merchant', () => {
    expect(normaliseMerchant('PayPal *Spotify')).toBe('spotify')
  })
})

describe('punctuation and symbols', () => {
  test.each([
    ['H&M', 'h&m'],
    ['H & M', 'h & m'],
    ["McDonald's", 'mcdonald s'],
    ['Caffè Nero', 'caffè nero'],
    ['OVpay', 'ovpay'],
    ['iliad', 'iliad'],
  ])('%j -> %j', (raw, expected) => {
    expect(normaliseMerchant(raw)).toBe(expected)
  })
})

describe('nothing usable', () => {
  test.each(['', '   ', '***', '...'])('%j -> null', (raw) => {
    expect(normaliseMerchant(raw)).toBeNull()
  })
})

describe('what it deliberately does not do', () => {
  test('city names survive, because merchants are named after cities', () => {
    expect(normaliseMerchant('Firenze IJs')).toBe('firenze ijs')
  })

  test('digits survive, because merchants are named after numbers', () => {
    expect(normaliseMerchant('Cafe 3000')).toBe('cafe 3000')
  })
})
