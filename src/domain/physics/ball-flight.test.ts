import { describe, expect, it } from 'vitest'
import { stateHash } from '../core/hash'
import { createBattedBall, FIXED_STEP_SECONDS, simulateBall, stepBall } from './ball-flight'

describe('authoritative ball flight', () => {
  it('uses the fixed 1/120 second tick', () => {
    expect(FIXED_STEP_SECONDS).toBe(1 / 120)
    expect(stepBall(createBattedBall(40, 20, 0)).tick).toBe(1)
  })

  it('is deterministic and finite', () => {
    const initial = createBattedBall(48, 28, 4)
    const left = simulateBall(initial)
    const right = simulateBall(initial)
    expect(stateHash(left)).toBe(stateHash(right))
    expect(Object.values(left.state.position).every(Number.isFinite)).toBe(true)
  })

  it('classifies a deep fair drive', () => {
    const result = simulateBall(createBattedBall(55, 32, 0))
    expect(['home-run', 'grounded']).toContain(result.classification)
    expect(result.exitVelocityMps).toBeCloseTo(55, 5)
  })
})
