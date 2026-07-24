import { describe, expect, it } from 'vitest'
import { createRngStreams, SeededRng } from './rng'

describe('SeededRng', () => {
  it('replays a stable sequence', () => {
    const left = new SeededRng(42)
    const right = new SeededRng(42)
    expect(Array.from({ length: 20 }, () => left.next())).toEqual(
      Array.from({ length: 20 }, () => right.next()),
    )
  })

  it('isolates authoritative and presentation streams', () => {
    const baseline = createRngStreams(20260724)
    const withPresentation = createRngStreams(20260724)
    Array.from({ length: 200 }, () => withPresentation.presentation.next())
    expect(withPresentation.career.next()).toBe(baseline.career.next())
    expect(withPresentation.match.next()).toBe(baseline.match.next())
  })
})
