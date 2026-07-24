import { describe, expect, it } from 'vitest'
import { canonicalJson, stateHash } from './hash'

describe('canonical state hash', () => {
  it('ignores object key insertion order', () => {
    expect(stateHash({ a: 1, b: 2 })).toBe(stateHash({ b: 2, a: 1 }))
  })

  it('quantizes authoritative floats to 1e-6', () => {
    expect(canonicalJson({ value: 1.00000001 })).toBe(canonicalJson({ value: 1.00000002 }))
  })
})
