import type { PlayerRatings, ScoutingReport } from '../../contracts'
import type { CareerSimulation, DraftEnding } from './types'

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value))

export function playerOverall(ratings: PlayerRatings, role: 'hitter' | 'pitcher'): number {
  const values = role === 'hitter'
    ? [ratings.contact, ratings.power, ratings.speed, ratings.fielding]
    : [ratings.stamina, ratings.velocity, ratings.command, ratings.movement]
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function createScoutingReport(career: CareerSimulation): ScoutingReport {
  const { player } = career.save
  const overall = playerOverall(player.ratings, player.role)
  const games = Math.max(1, career.save.record.games)
  const production = player.role === 'hitter'
    ? (career.save.record.hits * 1.4 + career.save.record.homeRuns * 4 + career.save.record.runsBattedIn) / games
    : (career.save.record.strikeouts * 1.2 - career.save.record.earnedRuns * 1.5) / games
  const healthPenalty = player.injurySeverity * 7
  const score = clamp(
    overall * 0.52
      + player.scouting * 0.24
      + player.coachTrust * 0.09
      + clamp(production * 3, 0, 100) * 0.15
      - healthPenalty,
  )
  const projectedRound = score >= 88 ? 1 : score >= 81 ? 2 : score >= 74 ? 3 : score >= 68 ? 4 : score >= 62 ? 5 : score >= 57 ? 6 : score >= 52 ? 7 : null
  const strengths: string[] = []
  const development: string[] = []
  const ratingEntries = Object.entries(player.ratings) as [keyof PlayerRatings, number][]
  ratingEntries.sort((left, right) => right[1] - left[1])
  strengths.push(...ratingEntries.slice(0, 2).map(([rating]) => rating))
  development.push(...ratingEntries.slice(-2).map(([rating]) => rating))
  if (player.coachTrust >= 75) strengths.push('coach trust')
  if (player.injurySeverity > 0) development.push('durability')
  return {
    overall: Math.round(score),
    projectedRound,
    headline: projectedRound === 1
      ? '첫날 밤 이름이 불릴 완성형 유망주'
      : projectedRound
        ? `${projectedRound}라운드 가치의 성장형 유망주`
        : '지명 밖에서도 길을 이어 갈 도전자',
    strengths,
    development,
  }
}

export function draftEnding(career: CareerSimulation): DraftEnding {
  const report = createScoutingReport(career)
  let ending: DraftEnding['ending']
  if (career.save.player.injurySeverity >= 2) ending = 'rehab-and-return'
  else if (report.projectedRound === 1) ending = 'first-round-dream'
  else if (report.projectedRound !== null) ending = 'drafted-prospect'
  else ending = 'independent-road'
  return { report, ending }
}
