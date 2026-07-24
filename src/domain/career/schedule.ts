import type { CalendarMonth, ResolvedCareerGame } from '../../contracts'
import { SeededRng, deriveSeed } from '../core/rng'
import { SCHOOLS } from '../../content/schools'
import { CAREER_MONTHS, type ScheduledGame } from './types'

export function calendarMonth(monthIndex: number, actionsRemaining = 3): CalendarMonth {
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex >= CAREER_MONTHS) {
    throw new Error(`Career month must be between 0 and ${CAREER_MONTHS - 1}`)
  }
  const month = ((monthIndex + 2) % 12) + 1
  const year = (Math.floor(monthIndex / 12) + 1) as 1 | 2 | 3
  let competition: CalendarMonth['competition']
  if (month === 3) competition = 'practice'
  else if (month >= 4 && month <= 5) competition = 'spring'
  else if (month >= 6 && month <= 8) competition = 'summer'
  else if (month >= 9 && month <= 11) competition = 'autumn'
  else competition = 'offseason'
  return { index: monthIndex, year, month, actionsRemaining, competition }
}

function gameCount(competition: CalendarMonth['competition']): number {
  if (competition === 'practice') return 2
  if (competition === 'spring') return 3
  if (competition === 'summer') return 4
  if (competition === 'autumn') return 3
  return 0
}

export function createCareerSchedule(
  seed: number,
  schoolId: string,
  resolvedGames: readonly ResolvedCareerGame[] = [],
): readonly ScheduledGame[] {
  const rng = new SeededRng(deriveSeed(seed, 'schedule'))
  const opponents = SCHOOLS.filter((school) => school.id !== schoolId)
  const games: ScheduledGame[] = []

  for (let monthIndex = 0; monthIndex < CAREER_MONTHS; monthIndex += 1) {
    const calendar = calendarMonth(monthIndex)
    for (let sequence = 0; sequence < gameCount(calendar.competition); sequence += 1) {
      const opponent = rng.pick(opponents)
      const importance = calendar.competition === 'summer' ? 3 : calendar.competition === 'autumn' ? 2 : 1
      games.push({
        id: `y${calendar.year}-m${String(calendar.month).padStart(2, '0')}-g${sequence + 1}`,
        monthIndex,
        opponentId: opponent.id,
        competition: calendar.competition,
        home: rng.next() >= 0.5,
        importance,
        resolved: false,
      })
    }
  }
  if (resolvedGames.length === 0) return games
  const results = new Map(resolvedGames.map((result) => [result.id, result]))
  return games.map((game) => {
    const result = results.get(game.id)
    return result === undefined
      ? game
      : { ...game, resolved: true, won: result.won, performance: result.performance }
  })
}
