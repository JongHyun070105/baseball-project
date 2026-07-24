import { describe, expect, it } from 'vitest'
import { canTransition, CAREER_TRANSITIONS, MATCH_TRANSITIONS } from './state-machines'

describe('state machine contracts', () => {
  it('allows the career loop and blocks terminal escape', () => {
    expect(canTransition(CAREER_TRANSITIONS, 'postgame', 'hub')).toBe(true)
    expect(canTransition(CAREER_TRANSITIONS, 'completed', 'hub')).toBe(false)
  })

  it('supports pause/resume without making pause linear', () => {
    expect(canTransition(MATCH_TRANSITIONS, 'live', 'paused')).toBe(true)
    expect(canTransition(MATCH_TRANSITIONS, 'paused', 'live')).toBe(true)
    expect(canTransition(MATCH_TRANSITIONS, 'paused', 'terminal')).toBe(false)
  })
})
