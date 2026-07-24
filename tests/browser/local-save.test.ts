import { beforeEach, describe, expect, it } from 'vitest'
import { createCareer } from '../../src/domain/career'
import { SaveRepository } from '../../src/persistence'

describe('real browser local career persistence', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips three independent slots in Chromium localStorage', () => {
    const repository = new SaveRepository(localStorage)
    for (const slot of [1, 2, 3] as const) {
      const career = createCareer({
        seed: 7000 + slot,
        name: `브라우저 선수 ${slot}`,
        schoolId: 'seorin',
        role: 'hitter',
        position: 'SS',
        archetypeId: 'field-general',
      })
      repository.autosave(slot, career.save)
    }

    expect(repository.load(1).current.player.name).toBe('브라우저 선수 1')
    expect(repository.load(2).current.player.name).toBe('브라우저 선수 2')
    expect(repository.load(3).current.player.name).toBe('브라우저 선수 3')
  })
})
