import { describe, expect, it } from 'vitest'
import { applyCareerEventChoice, advanceCareerMonth, chooseCareerAction, createCareer, recordScheduledGame } from '../domain/career'
import { getCareerEvent } from '../content'
import { createReplayBundle } from '../domain/match'
import { stateHash } from '../domain/core/hash'
import { createCareerMatch, restoreCareerMatch } from './App'
import { hydrateCareer } from './career-session'

const creation = {
  seed: 7242026,
  name: '세션 테스트',
  schoolId: 'seorin',
  role: 'hitter' as const,
  position: 'SS' as const,
  archetypeId: 'field-general',
}

describe('career session hydration', () => {
  it('restores an untouched later pitcher game from its career command offset', () => {
    const base = createCareer({ ...creation, role: 'pitcher', position: 'starter', archetypeId: 'power-ace' })
    const gameId = base.schedule.find((game) => game.monthIndex === 0)!.id
    const laterCareer = { ...base, save: { ...base.save, lastAppliedCommandId: 35 } }
    const opening = createCareerMatch(laterCareer, gameId)
    const replayCheckpoint = createReplayBundle(opening, 'test')
    const restored = restoreCareerMatch(
      { ...laterCareer, save: { ...laterCareer.save, phase: 'in-game', replayCheckpoint } },
      gameId,
    )

    expect(replayCheckpoint.initialCommandId).toBe(35)
    expect(replayCheckpoint.commands).toHaveLength(0)
    expect(stateHash({ ...restored, replay: undefined })).toBe(replayCheckpoint.finalHash)
  })

  it('reapplies persisted scheduled-game resolutions after reload', () => {
    const career = createCareer(creation)
    const game = career.schedule.find((entry) => entry.monthIndex === career.save.month.index)
    expect(game).toBeDefined()

    const recorded = recordScheduledGame(career, game!.id, {
      won: true,
      performance: 83,
      plateAppearances: 1,
      hits: 1,
      runsBattedIn: 1,
    })
    const hydrated = hydrateCareer(recorded.save)

    expect(hydrated.schedule.find((entry) => entry.id === game!.id)).toMatchObject({ resolved: true, won: true, performance: 83 })
  })

  it('restores only unresolved deterministic career events as pending', () => {
    let career = createCareer(creation)
    career = chooseCareerAction(career, 'growth')
    career = chooseCareerAction(career, 'recovery')
    career = chooseCareerAction(career, 'study')
    career = advanceCareerMonth(career)
    const eventId = career.progress.latestEventId
    expect(eventId).not.toBeNull()
    expect(hydrateCareer(career.save).progress.latestEventId).toBe(eventId)

    const resolved = applyCareerEventChoice(career, eventId!, getCareerEvent(eventId!).choices[0].id)
    expect(hydrateCareer(resolved.save).progress.latestEventId).toBeNull()
  })
})
