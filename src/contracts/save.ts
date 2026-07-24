import type { SchoolProfile } from './content'
import type { Difficulty, HitterPosition, PitcherRole, PlayerRole } from './gameplay'
import type { ReplayBundle } from './replay'

export const SAVE_SCHEMA_VERSION = 3 as const

export interface PlayerRatings {
  contact: number
  power: number
  speed: number
  fielding: number
  stamina: number
  velocity: number
  command: number
  movement: number
}

export interface PlayerProfile {
  id: string
  name: string
  role: PlayerRole
  position: HitterPosition | PitcherRole
  schoolId: SchoolProfile['id']
  year: 1 | 2 | 3
  ratings: PlayerRatings
  condition: number
  morale: number
  coachTrust: number
  scouting: number
  relationship: number
  injurySeverity: 0 | 1 | 2 | 3
}

export type CareerPhase =
  | 'creation'
  | 'hub'
  | 'action-resolution'
  | 'pregame'
  | 'in-game'
  | 'postgame'
  | 'draft'
  | 'completed'

export interface CalendarMonth {
  index: number
  year: 1 | 2 | 3
  month: number
  actionsRemaining: number
  competition: 'practice' | 'spring' | 'summer' | 'autumn' | 'offseason'
}

export interface CareerRecord {
  games: number
  wins: number
  losses: number
  plateAppearances: number
  hits: number
  homeRuns: number
  runsBattedIn: number
  inningsPitched: number
  strikeouts: number
  earnedRuns: number
}

export interface ResolvedCareerGame {
  id: string
  won: boolean
  performance: number
  summary?: {
    score: { away: number; home: number }
    replayHash: string
    terminalId: string
    plateAppearances?: number
    hits?: number
    homeRuns?: number
    runsBattedIn?: number
    inningsPitched?: number
    strikeouts?: number
    earnedRuns?: number
  }
}

export interface ScoutingReport {
  overall: number
  projectedRound: number | null
  headline: string
  strengths: readonly string[]
  development: readonly string[]
}

export interface CareerSave {
  schemaVersion: typeof SAVE_SCHEMA_VERSION
  id: string
  createdAt: string
  updatedAt: string
  seed: number
  rngState: Record<'career' | 'schedule' | 'match' | 'ai', number>
  phase: CareerPhase
  player: PlayerProfile
  month: CalendarMonth
  record: CareerRecord
  schoolStanding: number
  lastAppliedCommandId: number
  lastTerminalEventId: string | null
  appliedTerminalEventIds: readonly string[]
  resolvedGames: readonly ResolvedCareerGame[]
  replayCheckpoint: ReplayBundle | null
  eventHistory: readonly string[]
  scoutingReport: ScoutingReport | null
}

export interface SaveSlotEnvelope {
  schemaVersion: typeof SAVE_SCHEMA_VERSION
  current: CareerSave
  backup: CareerSave | null
  backupChecksum: string | null
  checksum: string
}

export interface GameSettings {
  difficulty: Difficulty
  aimAssist: boolean
  cameraShake: number
  motionEffects: boolean
  graphics: 'low' | 'medium' | 'high'
  masterVolume: number
}

export type SaveValidationError =
  | 'malformed'
  | 'oversized'
  | 'unsupported-version'
  | 'checksum-mismatch'
  | 'quota-exceeded'
  | 'missing-slot'
