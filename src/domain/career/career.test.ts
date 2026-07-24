import { describe, expect, it } from 'vitest'
import { CAREER_EVENTS, getCareerEvent } from '../../content/events'
import {
  ACTIONS_PER_MONTH,
  CAREER_MONTHS,
  advanceCareerMonth,
  applyCareerEventChoice,
  calendarMonth,
  chooseCareerAction,
  createCareer,
  createCareerSchedule,
  enterDraft,
  recordScheduledGame,
  resolveIneligibleMonthGames,
  resolveIneligibleScheduledGame,
} from './index'

const creation = {
  seed: 20260724,
  name: '윤태오',
  schoolId: 'seorin',
  role: 'hitter' as const,
  position: 'SS' as const,
  archetypeId: 'five-tool',
}

describe('career calendar and schedule', () => {
  it('maps exactly 36 months across three school years', () => {
    const months = Array.from({ length: CAREER_MONTHS }, (_, index) => calendarMonth(index))
    expect(months[0]).toMatchObject({ index: 0, year: 1, month: 3, actionsRemaining: ACTIONS_PER_MONTH, competition: 'practice' })
    expect(months[11]).toMatchObject({ year: 1, month: 2 })
    expect(months[35]).toMatchObject({ index: 35, year: 3, month: 2 })
    expect(() => calendarMonth(36)).toThrow(/between 0 and 35/)
  })

  it('creates deterministic seasonal schedules without self-opponents', () => {
    const first = createCareerSchedule(77, 'seorin')
    const second = createCareerSchedule(77, 'seorin')
    expect(first).toEqual(second)
    expect(first).toHaveLength(87)
    expect(first.every((game) => game.opponentId !== 'seorin')).toBe(true)
    expect(first.some((game) => game.importance === 3)).toBe(true)
    expect(createCareerSchedule(78, 'seorin')).not.toEqual(first)
  })
})

describe('career simulation', () => {
  it('is identical for the same seed and input', () => {
    expect(createCareer(creation)).toEqual(createCareer(creation))
    expect(createCareer({ ...creation, seed: creation.seed + 1 })).not.toEqual(createCareer(creation))
  })

  it('enforces exactly three actions before month advancement', () => {
    let career = createCareer(creation)
    expect(() => advanceCareerMonth(career)).toThrow(/all three/)
    career = chooseCareerAction(career, 'growth')
    career = chooseCareerAction(career, 'study')
    career = chooseCareerAction(career, 'relationship')
    expect(career.save.month.actionsRemaining).toBe(0)
    expect(career.progress.actionsCompleted).toBe(3)
    expect(() => chooseCareerAction(career, 'recovery')).toThrow(/Exactly three/)
    career = advanceCareerMonth(career)
    expect(career.save.month).toMatchObject({ index: 1, actionsRemaining: 3 })
    expect(career.progress.latestEventId).not.toBeNull()
  })

  it('applies distinct growth, recovery, study, and relationship tradeoffs', () => {
    const base = createCareer(creation)
    const grown = chooseCareerAction(base, 'growth')
    expect(grown.progress.growthPoints).toBeGreaterThan(0)
    expect(grown.save.player.condition).toBeLessThan(base.save.player.condition)

    const recovered = chooseCareerAction(grown, 'recovery')
    expect(recovered.save.player.condition).toBeGreaterThan(grown.save.player.condition)

    const studied = chooseCareerAction(base, 'study')
    expect(studied.progress.academics).toBeGreaterThan(base.progress.academics)

    const bonded = chooseCareerAction(base, 'relationship')
    expect(bonded.save.player.relationship).toBeGreaterThan(base.save.player.relationship)
    expect(bonded.save.player.coachTrust).toBeGreaterThan(base.save.player.coachTrust)
  })

  it('models deterministic injury risk under repeated workload', () => {
    const overload = () => {
      let career = createCareer({ ...creation, seed: 9 })
      for (let month = 0; month < 5; month += 1) {
        career = chooseCareerAction(career, 'growth')
        career = chooseCareerAction(career, 'growth')
        career = chooseCareerAction(career, 'growth')
        career = advanceCareerMonth(career)
      }
      return career
    }
    expect(overload().save.player.injurySeverity).toBeGreaterThan(0)
    expect(overload()).toEqual(overload())
  })

  it('removes a player from competition when academics fall below eligibility', () => {
    let career = createCareer(creation)
    for (let month = 0; month < 26; month += 1) {
      career = chooseCareerAction(career, 'relationship')
      career = chooseCareerAction(career, 'recovery')
      career = chooseCareerAction(career, 'relationship')
      career = advanceCareerMonth(career)
    }
    expect(career.progress.academics).toBeLessThan(45)
    expect(career.progress.lineupStatus).toBe('ineligible')
    const game = career.schedule.find((entry) => entry.monthIndex === career.save.month.index)
    expect(game).toBeDefined()
    expect(() => recordScheduledGame(career, game!.id, { won: true, performance: 70 })).toThrow(/ineligible/)
  })

  it('deterministically benches an ineligible player and persists every skipped game exactly once', () => {
    const reachIneligibleMonth = () => {
      let career = createCareer(creation)
      for (let month = 0; month < 26; month += 1) {
        career = chooseCareerAction(career, 'relationship')
        career = chooseCareerAction(career, 'recovery')
        career = chooseCareerAction(career, 'relationship')
        career = advanceCareerMonth(career)
      }
      return career
    }
    const before = reachIneligibleMonth()
    const games = before.schedule.filter((game) => game.monthIndex === before.save.month.index)
    expect(games.length).toBeGreaterThan(0)

    const resolved = resolveIneligibleMonthGames(before)
    expect(resolved.schedule.filter((game) => game.monthIndex === resolved.save.month.index).every((game) => game.resolved)).toBe(true)
    expect(resolved.save.resolvedGames).toHaveLength(games.length)
    expect(resolved.save.resolvedGames.every((game) => game.performance === 0)).toBe(true)
    expect(resolved.save.record.games).toBe(games.length)
    expect(resolved.save.eventHistory.filter((entry) => entry.includes(':academic-benched:'))).toHaveLength(games.length)
    expect(createCareerSchedule(resolved.save.seed, resolved.save.player.schoolId, resolved.save.resolvedGames)
      .filter((game) => game.monthIndex === resolved.save.month.index)
      .every((game) => game.resolved)).toBe(true)
    expect(() => resolveIneligibleScheduledGame(resolved, games[0]!.id)).toThrow(/already resolved/)
    expect(resolveIneligibleMonthGames(reachIneligibleMonth())).toEqual(resolved)
  })

  it('does not allow the ineligible skip path for an eligible player', () => {
    const career = createCareer(creation)
    const game = career.schedule.find((entry) => entry.monthIndex === 0)
    expect(game).toBeDefined()
    expect(() => resolveIneligibleScheduledGame(career, game!.id)).toThrow(/Only academically ineligible/)
    expect(() => resolveIneligibleMonthGames(career)).toThrow(/Only academically ineligible/)
  })

  it('records a deterministic forfeit for severe academic disqualification', () => {
    const base = createCareer(creation)
    const disqualified = {
      ...base,
      progress: { ...base.progress, academics: 20, lineupStatus: 'ineligible' as const },
    }
    const game = disqualified.schedule.find((entry) => entry.monthIndex === 0)
    expect(game).toBeDefined()
    const resolved = resolveIneligibleScheduledGame(disqualified, game!.id)
    expect(resolved.save.resolvedGames).toEqual([{ id: game!.id, won: false, performance: 0 }])
    expect(resolved.save.record).toMatchObject({ games: 1, wins: 0, losses: 1 })
    expect(resolved.save.eventHistory.at(-1)).toBe(`game:${game!.id}:academic-forfeit:loss`)
  })

  it('lets game performance change the record, trust, standing, and scouting', () => {
    const career = createCareer(creation)
    const game = career.schedule.find((entry) => entry.monthIndex === 0)
    expect(game).toBeDefined()
    const updated = recordScheduledGame(career, game!.id, {
      won: true,
      performance: 92,
      plateAppearances: 4,
      hits: 3,
      homeRuns: 1,
      runsBattedIn: 4,
    })
    expect(updated.save.record).toMatchObject({ games: 1, wins: 1, hits: 3, homeRuns: 1, runsBattedIn: 4 })
    expect(updated.save.resolvedGames).toEqual([{ id: game!.id, won: true, performance: 92 }])
    expect(updated.save.player.scouting).toBeGreaterThan(career.save.player.scouting)
    expect(updated.save.player.coachTrust).toBeGreaterThan(career.save.player.coachTrust)
    expect(updated.save.schoolStanding).toBeGreaterThan(career.save.schoolStanding)
    expect(() => recordScheduledGame(updated, game!.id, { won: true, performance: 80 })).toThrow(/already resolved/)
  })

  it('applies typed career event choices once with deterministic effects', () => {
    const pendingEvent = () => {
      let career = createCareer(creation)
      career = chooseCareerAction(career, 'growth')
      career = chooseCareerAction(career, 'study')
      career = chooseCareerAction(career, 'relationship')
      return advanceCareerMonth(career)
    }
    const pending = pendingEvent()
    const eventId = pending.progress.latestEventId
    expect(eventId).not.toBeNull()
    const choiceId = getCareerEvent(eventId!).choices[0]!.id
    const chosen = applyCareerEventChoice(pending, eventId!, choiceId)
    expect(chosen.progress.latestEventId).toBeNull()
    expect(chosen.save.eventHistory.at(-1)).toMatch(new RegExp(`^choice:1:${eventId}:`))
    expect(() => applyCareerEventChoice({ ...chosen, progress: { ...chosen.progress, latestEventId: eventId } }, eventId!, choiceId)).toThrow(/already resolved/)
    expect(chosen).toEqual(chosen)
  })

  it('parses every authored event effect and resolves every choice deterministically', () => {
    const base = createCareer(creation)
    for (const event of CAREER_EVENTS) {
      for (const choice of event.choices) {
        const pending = {
          ...base,
          save: { ...base.save, eventHistory: [event.id] },
          progress: { ...base.progress, latestEventId: event.id },
        }
        expect(applyCareerEventChoice(pending, event.id, choice.id)).toEqual(applyCareerEventChoice(pending, event.id, choice.id))
      }
    }
  })

  it('completes all 108 actions before producing a deterministic draft ending', () => {
    const run = () => {
      let career = createCareer(creation)
      for (let month = 0; month < CAREER_MONTHS; month += 1) {
        career = chooseCareerAction(career, month % 4 === 0 ? 'growth' : 'relationship')
        career = chooseCareerAction(career, month % 3 === 0 ? 'study' : 'recovery')
        career = chooseCareerAction(career, 'growth')
        career = advanceCareerMonth(career)
      }
      expect(career.progress.actionsCompleted).toBe(108)
      expect(career.save.phase).toBe('draft')
      expect(career.save.month).toMatchObject({ index: 35, actionsRemaining: 0 })
      const drafted = enterDraft(career)
      expect(drafted.career.save.phase).toBe('completed')
      expect(drafted.result.report.strengths.length).toBeGreaterThanOrEqual(2)
      return drafted
    }
    expect(run()).toEqual(run())
  })

  it('rejects invalid school, role-position, and early draft combinations', () => {
    expect(() => createCareer({ ...creation, schoolId: 'gwangjin' })).toThrow(/not a playable school/)
    expect(() => createCareer({ ...creation, role: 'pitcher', position: 'SS', archetypeId: 'power-ace' })).toThrow(/pitching role/)
    expect(() => enterDraft(createCareer(creation))).toThrow(/only after all 36 months/)
  })
})
