import type { CareerRecord, PlayerRatings } from '../../contracts'
import { SAVE_SCHEMA_VERSION } from '../../contracts'
import { PLAYER_ARCHETYPES, ROSTERS, getSchool } from '../../content'
import { CAREER_EVENTS, getCareerEvent } from '../../content/events'
import { SeededRng, createRngStreams, deriveSeed } from '../core/rng'
import { calendarMonth, createCareerSchedule } from './schedule'
import { draftEnding, playerOverall } from './scouting'
import {
  ACTIONS_PER_MONTH,
  CAREER_MONTHS,
  type CareerAction,
  type CareerCreation,
  type CareerSimulation,
  type DraftEnding,
  type GamePerformance,
  type IneligibleGameResolution,
  type LineupStatus,
  type MutableRecord,
} from './types'

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value))
const fixedDate = (seed: number): string => new Date(Date.UTC(2020, 0, 1, 0, 0, seed % 60)).toISOString()

const EMPTY_RECORD: CareerRecord = {
  games: 0,
  wins: 0,
  losses: 0,
  plateAppearances: 0,
  hits: 0,
  homeRuns: 0,
  runsBattedIn: 0,
  inningsPitched: 0,
  strikeouts: 0,
  earnedRuns: 0,
}

function initialRatings(role: CareerCreation['role'], archetypeId: string): PlayerRatings {
  const ratings: PlayerRatings = {
    contact: role === 'hitter' ? 54 : 25,
    power: role === 'hitter' ? 50 : 25,
    speed: role === 'hitter' ? 52 : 35,
    fielding: role === 'hitter' ? 53 : 40,
    stamina: role === 'pitcher' ? 53 : 45,
    velocity: role === 'pitcher' ? 52 : 25,
    command: role === 'pitcher' ? 50 : 25,
    movement: role === 'pitcher' ? 51 : 25,
  }
  const archetype = PLAYER_ARCHETYPES.find((entry) => entry.id === archetypeId && entry.role === role)
  if (!archetype) throw new Error(`Archetype ${archetypeId} is not valid for role ${role}`)
  const keys = archetype.growthBias.split(',')
  for (const key of keys) {
    if (key === 'balanced') {
      const relevant = role === 'hitter' ? ['contact', 'power', 'speed', 'fielding'] : ['stamina', 'velocity', 'command', 'movement']
      for (const rating of relevant) ratings[rating as keyof PlayerRatings] += 2
    } else if (key in ratings) ratings[key as keyof PlayerRatings] += 5
  }
  return ratings
}

function competitorEvaluation(career: CareerSimulation): { status: LineupStatus; rank: number } {
  if (career.progress.academics < 45) return { status: 'ineligible', rank: 99 }
  const player = career.save.player
  const ownScore = playerOverall(player.ratings, player.role) + player.coachTrust * 0.12 - player.injurySeverity * 8
  const competitors = (ROSTERS[player.schoolId] ?? [])
    .filter((entry) => entry.role === player.role && entry.position === player.position)
    .map((entry) => entry.overall)
    .sort((left, right) => right - left)
  const rank = competitors.filter((overall) => overall > ownScore).length + 1
  const best = competitors[0] ?? 50
  return { status: ownScore >= best ? 'starter' : ownScore >= best - 7 ? 'rotation' : 'reserve', rank }
}

function refreshed(career: CareerSimulation): CareerSimulation {
  const evaluation = competitorEvaluation(career)
  return { ...career, progress: { ...career.progress, lineupStatus: evaluation.status, depthRank: evaluation.rank } }
}

export function createCareer(input: CareerCreation): CareerSimulation {
  const school = getSchool(input.schoolId)
  if (!school.playable) throw new Error(`${school.name} is not a playable school`)
  if (input.role === 'hitter' && (input.position === 'starter' || input.position === 'reliever')) throw new Error('A hitter needs a field position')
  if (input.role === 'pitcher' && input.position !== 'starter' && input.position !== 'reliever') throw new Error('A pitcher needs a pitching role')
  const streams = createRngStreams(input.seed)
  const createdAt = fixedDate(input.seed)
  const career: CareerSimulation = {
    save: {
      schemaVersion: SAVE_SCHEMA_VERSION,
      id: `career-${input.seed.toString(36)}`,
      createdAt,
      updatedAt: createdAt,
      seed: input.seed,
      rngState: {
        career: streams.career.snapshot().state,
        schedule: streams.schedule.snapshot().state,
        match: streams.match.snapshot().state,
        ai: streams.ai.snapshot().state,
      },
      phase: 'hub',
      player: {
        id: `player-${input.seed.toString(36)}`,
        name: input.name,
        role: input.role,
        position: input.position,
        schoolId: input.schoolId,
        year: 1,
        ratings: initialRatings(input.role, input.archetypeId),
        condition: 85,
        morale: 70,
        coachTrust: 45,
        scouting: 15,
        relationship: 50,
        injurySeverity: 0,
      },
      month: calendarMonth(0, ACTIONS_PER_MONTH),
      record: { ...EMPTY_RECORD },
      schoolStanding: 50,
      lastAppliedCommandId: 0,
      lastTerminalEventId: null,
      appliedTerminalEventIds: [],
      resolvedGames: [],
      replayCheckpoint: null,
      eventHistory: [],
      scoutingReport: null,
    },
    progress: {
      academics: 70,
      growthPoints: 0,
      actionsCompleted: 0,
      lineupStatus: 'reserve',
      depthRank: 99,
      latestEventId: null,
    },
    schedule: createCareerSchedule(input.seed, input.schoolId),
  }
  return refreshed(career)
}

function careerRng(career: CareerSimulation): SeededRng {
  return new SeededRng(deriveSeed(career.save.seed, 'career'), career.save.rngState.career)
}

function growRating(ratings: PlayerRatings, role: 'hitter' | 'pitcher', actionNumber: number, amount: number): PlayerRatings {
  const keys: readonly (keyof PlayerRatings)[] = role === 'hitter'
    ? ['contact', 'power', 'speed', 'fielding']
    : ['velocity', 'command', 'movement', 'stamina']
  const key = keys[actionNumber % keys.length]
  return { ...ratings, [key]: clamp(ratings[key] + amount, 0, 99) }
}

export function chooseCareerAction(career: CareerSimulation, action: CareerAction): CareerSimulation {
  if (career.save.phase !== 'hub') throw new Error('Career actions are only available from the hub')
  if (career.save.month.actionsRemaining <= 0) throw new Error('Exactly three actions are allowed each month')
  const rng = careerRng(career)
  const player = { ...career.save.player, ratings: { ...career.save.player.ratings } }
  let academics = career.progress.academics
  let growthPoints = career.progress.growthPoints
  let summary: string

  if (action === 'growth') {
    const gain = player.injurySeverity >= 2 ? 1 : rng.integer(2, 4)
    player.ratings = growRating(player.ratings, player.role, career.progress.actionsCompleted, gain)
    player.condition = clamp(player.condition - rng.integer(9, 14))
    player.coachTrust = clamp(player.coachTrust + 2)
    growthPoints += gain
    const injuryChance = 0.04 + Math.max(0, 55 - player.condition) / 100 + player.injurySeverity * 0.05
    if (rng.next() < injuryChance) player.injurySeverity = Math.min(3, player.injurySeverity + 1) as 0 | 1 | 2 | 3
    summary = `기량 +${gain}, 컨디션을 소모했다.`
  } else if (action === 'recovery') {
    const recovery = rng.integer(15, 22)
    player.condition = clamp(player.condition + recovery)
    player.morale = clamp(player.morale + 3)
    if (player.injurySeverity > 0 && rng.next() < 0.7) player.injurySeverity = (player.injurySeverity - 1) as 0 | 1 | 2
    summary = `컨디션 +${recovery}, 부상 회복에 집중했다.`
  } else if (action === 'study') {
    const gain = rng.integer(7, 11)
    academics = clamp(academics + gain)
    player.condition = clamp(player.condition - 3)
    player.coachTrust = clamp(player.coachTrust + (academics >= 75 ? 2 : 1))
    summary = `학업 +${gain}, 출전 자격을 다졌다.`
  } else {
    const gain = rng.integer(7, 12)
    player.relationship = clamp(player.relationship + gain)
    player.morale = clamp(player.morale + 5)
    player.coachTrust = clamp(player.coachTrust + 3)
    summary = `관계 +${gain}, 팀의 신뢰를 얻었다.`
  }

  const next: CareerSimulation = {
    ...career,
    save: {
      ...career.save,
      player,
      month: { ...career.save.month, actionsRemaining: career.save.month.actionsRemaining - 1 },
      rngState: { ...career.save.rngState, career: rng.snapshot().state },
      eventHistory: [...career.save.eventHistory, `action:${career.save.month.index}:${action}:${summary}`],
    },
    progress: {
      ...career.progress,
      academics,
      growthPoints,
      actionsCompleted: career.progress.actionsCompleted + 1,
    },
  }
  return refreshed(next)
}

type CareerEffect =
  | 'academics'
  | 'growth'
  | 'condition'
  | 'morale'
  | 'coachTrust'
  | 'relationship'
  | 'scouting'
  | 'stamina'
  | 'movement'
  | 'injury'
  | 'injuryRisk'

const CAREER_EFFECTS = new Set<CareerEffect>([
  'academics', 'growth', 'condition', 'morale', 'coachTrust', 'relationship',
  'scouting', 'stamina', 'movement', 'injury', 'injuryRisk',
])

function parseCareerEffects(encoded: string): readonly { stat: CareerEffect; amount: number }[] {
  return encoded.split(',').map((token) => {
    const match = /^(\w+)([+-])(\d+)$/.exec(token)
    if (!match || !CAREER_EFFECTS.has(match[1] as CareerEffect)) throw new Error(`Invalid career effect: ${token}`)
    return { stat: match[1] as CareerEffect, amount: Number(match[3]) * (match[2] === '+' ? 1 : -1) }
  })
}

/** Resolves a content-authored choice once and applies its typed effects deterministically. */
export function applyCareerEventChoice(career: CareerSimulation, eventId: string, choiceId: string): CareerSimulation {
  if (career.save.phase !== 'hub') throw new Error('Career events are only resolved from the hub')
  if (career.progress.latestEventId !== eventId) throw new Error(`Career event is not pending: ${eventId}`)
  const historyId = `choice:${career.save.month.index}:${eventId}:`
  if (career.save.eventHistory.some((entry) => entry.startsWith(historyId))) throw new Error(`Career event already resolved: ${eventId}`)
  const event = getCareerEvent(eventId)
  const choice = event.choices.find((entry) => entry.id === choiceId)
  if (!choice) throw new Error(`Unknown choice ${choiceId} for career event ${eventId}`)

  const rng = careerRng(career)
  const player = { ...career.save.player, ratings: { ...career.save.player.ratings } }
  let academics = career.progress.academics
  let growthPoints = career.progress.growthPoints
  for (const effect of parseCareerEffects(choice.effect)) {
    if (effect.stat === 'academics') academics = clamp(academics + effect.amount)
    else if (effect.stat === 'growth') growthPoints = Math.max(0, growthPoints + effect.amount)
    else if (effect.stat === 'condition' || effect.stat === 'morale' || effect.stat === 'coachTrust' || effect.stat === 'relationship' || effect.stat === 'scouting') {
      player[effect.stat] = clamp(player[effect.stat] + effect.amount)
    } else if (effect.stat === 'stamina' || effect.stat === 'movement') {
      player.ratings[effect.stat] = clamp(player.ratings[effect.stat] + effect.amount)
    } else if (effect.stat === 'injury') {
      player.injurySeverity = clamp(player.injurySeverity + effect.amount, 0, 3) as 0 | 1 | 2 | 3
    } else if (rng.next() < Math.max(0, effect.amount) / 100) {
      player.injurySeverity = Math.min(3, player.injurySeverity + 1) as 0 | 1 | 2 | 3
    }
  }

  return refreshed({
    ...career,
    save: {
      ...career.save,
      player,
      rngState: { ...career.save.rngState, career: rng.snapshot().state },
      eventHistory: [...career.save.eventHistory, `${historyId}${choiceId}`],
    },
    progress: { ...career.progress, academics, growthPoints, latestEventId: null },
  })
}

export function advanceCareerMonth(career: CareerSimulation): CareerSimulation {
  if (career.save.phase !== 'hub') throw new Error('Only an active career can advance')
  if (career.save.month.actionsRemaining !== 0) throw new Error('Use all three monthly actions before advancing')
  const nextIndex = career.save.month.index + 1
  if (nextIndex >= CAREER_MONTHS) {
    const ending = draftEnding(career)
    return {
      ...career,
      save: { ...career.save, phase: 'draft', scoutingReport: ending.report },
    }
  }
  const rng = careerRng(career)
  const event = CAREER_EVENTS[rng.integer(0, CAREER_EVENTS.length - 1)]
  const player = {
    ...career.save.player,
    year: (Math.floor(nextIndex / 12) + 1) as 1 | 2 | 3,
    condition: clamp(career.save.player.condition + 5),
    morale: clamp(career.save.player.morale - 1),
  }
  const next: CareerSimulation = {
    ...career,
    save: {
      ...career.save,
      player,
      month: calendarMonth(nextIndex, ACTIONS_PER_MONTH),
      rngState: { ...career.save.rngState, career: rng.snapshot().state },
      eventHistory: [...career.save.eventHistory, event.id],
    },
    progress: {
      ...career.progress,
      academics: clamp(career.progress.academics - 1),
      latestEventId: event.id,
    },
  }
  return refreshed(next)
}

const add = (value: number | undefined): number => value ?? 0

function textSeed(value: string): number {
  let hash = 0x811c9dc5
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
  return hash >>> 0 || 1
}

function academicGameResolution(career: CareerSimulation, gameId: string): IneligibleGameResolution {
  const game = career.schedule.find((entry) => entry.id === gameId)
  if (!game) throw new Error(`Unknown scheduled game: ${gameId}`)
  const disposition = career.progress.academics < 30 ? 'forfeit' : 'benched'
  if (disposition === 'forfeit') return { gameId, disposition, won: false, performance: 0 }

  const school = getSchool(career.save.player.schoolId)
  const opponent = getSchool(game.opponentId)
  const rng = new SeededRng(deriveSeed((career.save.seed ^ textSeed(game.id)) >>> 0, 'schedule'))
  const homeBonus = game.home ? 3 : 0
  const winProbability = clamp(50 + (school.teamPower - opponent.teamPower) * 1.5 + homeBonus, 15, 85) / 100
  return { gameId, disposition, won: rng.next() < winProbability, performance: 0 }
}

/**
 * Authoritatively resolves one current-month game that the player must miss for
 * academic ineligibility. The zero-performance result and disposition marker
 * are persisted in CareerSave, so hydration cannot reopen the game.
 */
export function resolveIneligibleScheduledGame(career: CareerSimulation, gameId: string): CareerSimulation {
  if (career.save.phase !== 'hub') throw new Error('Only an active career can resolve scheduled games')
  if (career.progress.lineupStatus !== 'ineligible') throw new Error('Only academically ineligible players can skip a scheduled game')
  const game = career.schedule.find((entry) => entry.id === gameId)
  if (!game) throw new Error(`Unknown scheduled game: ${gameId}`)
  if (game.resolved || career.save.resolvedGames.some((entry) => entry.id === gameId)) throw new Error(`Game already resolved: ${gameId}`)
  if (game.monthIndex !== career.save.month.index) throw new Error('Only games in the current month can be resolved')

  const resolution = academicGameResolution(career, gameId)
  const record: MutableRecord = { ...career.save.record }
  record.games += 1
  record.wins += resolution.won ? 1 : 0
  record.losses += resolution.won ? 0 : 1
  const schedule = career.schedule.map((entry) => entry.id === gameId
    ? { ...entry, resolved: true, won: resolution.won, performance: resolution.performance }
    : entry)
  return {
    ...career,
    save: {
      ...career.save,
      record,
      resolvedGames: [...career.save.resolvedGames, {
        id: gameId,
        won: resolution.won,
        performance: resolution.performance,
      }],
      schoolStanding: clamp(career.save.schoolStanding + (resolution.won ? game.importance : -game.importance)),
      eventHistory: [
        ...career.save.eventHistory,
        `game:${gameId}:academic-${resolution.disposition}:${resolution.won ? 'win' : 'loss'}`,
      ],
    },
    schedule,
  }
}

/** Resolves every still-open game in an ineligible player's current month. */
export function resolveIneligibleMonthGames(career: CareerSimulation): CareerSimulation {
  if (career.progress.lineupStatus !== 'ineligible') throw new Error('Only academically ineligible players can skip scheduled games')
  return career.schedule
    .filter((game) => game.monthIndex === career.save.month.index && !game.resolved)
    .reduce((current, game) => resolveIneligibleScheduledGame(current, game.id), career)
}

export function recordScheduledGame(career: CareerSimulation, gameId: string, performance: GamePerformance): CareerSimulation {
  if (performance.performance < 0 || performance.performance > 100) throw new Error('Performance must be between 0 and 100')
  const game = career.schedule.find((entry) => entry.id === gameId)
  if (!game) throw new Error(`Unknown scheduled game: ${gameId}`)
  if (game.resolved) throw new Error(`Game already resolved: ${gameId}`)
  if (game.monthIndex !== career.save.month.index) throw new Error('Only games in the current month can be resolved')
  if (career.progress.lineupStatus === 'ineligible') throw new Error('Academically ineligible players cannot appear in games')
  const record: MutableRecord = { ...career.save.record }
  record.games += 1
  record.wins += performance.won ? 1 : 0
  record.losses += performance.won ? 0 : 1
  record.plateAppearances += add(performance.plateAppearances)
  record.hits += add(performance.hits)
  record.homeRuns += add(performance.homeRuns)
  record.runsBattedIn += add(performance.runsBattedIn)
  record.inningsPitched += add(performance.inningsPitched)
  record.strikeouts += add(performance.strikeouts)
  record.earnedRuns += add(performance.earnedRuns)
  const impact = game.importance * (performance.performance - 50) / 20
  const player = {
    ...career.save.player,
    scouting: clamp(career.save.player.scouting + Math.max(0, Math.round(impact))),
    coachTrust: clamp(career.save.player.coachTrust + Math.round(impact / 2)),
    condition: clamp(career.save.player.condition - game.importance * 3),
  }
  const schedule = career.schedule.map((entry) => entry.id === gameId
    ? { ...entry, resolved: true, won: performance.won, performance: performance.performance }
    : entry)
  return refreshed({
    ...career,
    save: {
      ...career.save,
      player,
      record,
      resolvedGames: [...career.save.resolvedGames, {
        id: gameId,
        won: performance.won,
        performance: performance.performance,
      }],
      schoolStanding: clamp(career.save.schoolStanding + (performance.won ? game.importance : -game.importance)),
    },
    schedule,
  })
}

export function enterDraft(career: CareerSimulation): { career: CareerSimulation; result: DraftEnding } {
  if (career.save.phase !== 'draft' || career.save.month.index !== CAREER_MONTHS - 1 || career.save.month.actionsRemaining !== 0) {
    throw new Error('The draft opens only after all 36 months and 108 actions')
  }
  const result = draftEnding(career)
  return {
    result,
    career: {
      ...career,
      save: { ...career.save, phase: 'completed', scoutingReport: result.report },
    },
  }
}
