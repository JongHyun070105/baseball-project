import type {
  BallFlightResult,
  GameplayCommand,
  MatchEvent,
  MatchPhase,
  PitchCommand,
  ReplayBundle,
  ReplayCheckpoint,
  ReplayCommand,
  ReplayEvent,
  SceneTerminalResult,
  SwingCommand,
} from '../../contracts'
import type { RngSnapshot } from '../core/rng'

export type TeamSide = 'away' | 'home'
export type HalfInning = 'top' | 'bottom'
export type BaseState = readonly [boolean, boolean, boolean]

export interface MatchConfig {
  id: string
  seed: number
  initialCommandId?: number
  innings?: number
  playerTeam?: TeamSide
}

export type PlateResult =
  | 'ball'
  | 'called-strike'
  | 'swinging-strike'
  | 'foul'
  | 'single'
  | 'double'
  | 'triple'
  | 'home-run'
  | 'walk'
  | 'strikeout'
  | 'out'

export type ContactClassification = 'fair' | 'foul' | 'ground' | 'fence' | 'home-run' | 'catch'

export interface PitchResolution {
  command: PitchCommand
  actual: { x: number; y: number }
  inZone: boolean
  quality: number
}

export interface ContactResolution {
  classification: ContactClassification
  plateResult: Extract<PlateResult, 'foul' | 'single' | 'double' | 'triple' | 'home-run' | 'out'>
  flight: BallFlightResult
  catchProbability: number
  fieldingRoll: number
}

export interface PlayResolution {
  result: PlateResult
  pitch: PitchResolution
  swing?: SwingCommand
  contact?: ContactResolution
  runs: number
  outs: number
  terminal?: SceneTerminalResult
}

export interface MatchReplayState {
  initialCommandId: number
  commands: ReplayCommand[]
  events: ReplayEvent[]
  checkpoints: ReplayCheckpoint[]
}

export interface FieldingDecisionState {
  mode: 'catcher' | 'infield' | 'outfield' | null
  x: number
  z: number
  distance: number
  sprint: boolean
  caught: boolean
}

export interface MatchState {
  id: string
  seed: number
  innings: number
  playerTeam: TeamSide
  phase: MatchPhase
  tick: number
  inning: number
  half: HalfInning
  balls: number
  strikes: number
  outs: number
  bases: BaseState
  score: Record<TeamSide, number>
  rng: { match: RngSnapshot; ai: RngSnapshot }
  lastCommandId: number
  processedCommandIds: number[]
  terminalIds: string[]
  playerPlateAppearances: number
  eventSequence: number
  fielding: FieldingDecisionState
  lastPlay?: PlayResolution
  replay: MatchReplayState
}

export interface MatchReduction {
  state: MatchState
  events: MatchEvent[]
}

export interface StartedMatch {
  state: MatchState
  events: MatchEvent[]
}

export interface AiSimulationResult {
  state: MatchState
  events: MatchEvent[]
  commands: GameplayCommand[]
}

export type MatchReplayBundle = ReplayBundle
