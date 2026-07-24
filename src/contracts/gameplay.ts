export type PlayerRole = 'hitter' | 'pitcher'
export type HitterPosition = 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF'
export type PitcherRole = 'starter' | 'reliever'
export type Difficulty = 'rookie' | 'prospect' | 'legend'
export type SwingType = 'normal' | 'contact' | 'power'
export type PitchType = 'four-seam' | 'two-seam' | 'changeup' | 'slider' | 'curveball'
export type FieldingMode = 'catcher' | 'infield' | 'outfield'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface PitchCommand {
  pitchType: PitchType
  target: { x: number; y: number }
  gestureAccuracy: number
  releaseAccuracy: number
}

export interface SwingCommand {
  swingType: SwingType
  aim: { x: number; y: number }
  timingSeconds: number
}

export interface FieldingOpportunity {
  id: string
  mode: FieldingMode
  kind: string
  origin: Vec3
  target: Vec3
  timeLimitSeconds: number
}

export interface RunnerDecision {
  direction: 'advance' | 'retreat' | 'hold'
  sprint: boolean
  slide: boolean
}

export interface BallState {
  position: Vec3
  velocity: Vec3
  spin: Vec3
  tick: number
}

export type BallClassification =
  | 'in-flight'
  | 'strike'
  | 'ball'
  | 'foul'
  | 'grounded'
  | 'caught'
  | 'home-run'
  | 'dead'

export interface BallFlightResult {
  state: BallState
  classification: BallClassification
  contactQuality: number
  exitVelocityMps: number
  launchAngleDegrees: number
}

export interface PlateAppearance {
  id: string
  balls: number
  strikes: number
  outs: number
  inning: number
  half: 'top' | 'bottom'
  result?: 'single' | 'double' | 'triple' | 'home-run' | 'walk' | 'strikeout' | 'out'
}

export interface SceneTerminalResult {
  id: string
  scene: 'batting' | 'pitching' | 'catcher' | 'infield' | 'outfield' | 'baserunning'
  success: boolean
  runs: number
  outs: number
  summary: string
  replayHash: string
}
