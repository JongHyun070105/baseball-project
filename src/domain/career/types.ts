import type { CalendarMonth, CareerRecord, CareerSave, PlayerProfile, ScoutingReport } from '../../contracts'

export const CAREER_MONTHS = 36
export const ACTIONS_PER_MONTH = 3

export type CareerAction = 'growth' | 'recovery' | 'study' | 'relationship'
export type LineupStatus = 'starter' | 'rotation' | 'reserve' | 'ineligible'

export interface ScheduledGame {
  id: string
  monthIndex: number
  opponentId: string
  competition: CalendarMonth['competition']
  home: boolean
  importance: 1 | 2 | 3
  resolved: boolean
  won?: boolean
  performance?: number
}

export interface CareerProgress {
  academics: number
  growthPoints: number
  actionsCompleted: number
  lineupStatus: LineupStatus
  depthRank: number
  latestEventId: string | null
}

export interface CareerSimulation {
  save: CareerSave
  progress: CareerProgress
  schedule: readonly ScheduledGame[]
}

export interface CareerCreation {
  seed: number
  name: string
  schoolId: string
  role: PlayerProfile['role']
  position: PlayerProfile['position']
  archetypeId: string
}

export interface GamePerformance {
  won: boolean
  performance: number
  plateAppearances?: number
  hits?: number
  homeRuns?: number
  runsBattedIn?: number
  inningsPitched?: number
  strikeouts?: number
  earnedRuns?: number
}

export type IneligibleGameDisposition = 'benched' | 'forfeit'

export interface IneligibleGameResolution {
  gameId: string
  disposition: IneligibleGameDisposition
  won: boolean
  performance: 0
}

export interface DraftEnding {
  report: ScoutingReport
  ending: 'first-round-dream' | 'drafted-prospect' | 'independent-road' | 'rehab-and-return'
}

export type MutableRecord = { -readonly [Key in keyof CareerRecord]: CareerRecord[Key] }
