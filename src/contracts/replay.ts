import type { BallState } from './gameplay'

export const REPLAY_SCHEMA_VERSION = 3 as const

export interface ReplayCommand {
  id: number
  tick: number
  type: string
  payload: unknown
}

export interface ReplayEvent {
  id: string
  tick: number
  type: string
  payload: unknown
}

export interface ReplayCheckpoint {
  tick: number
  stateHash: string
  ball?: BallState
}

export interface ReplayBundle {
  buildVersion: string
  schemaVersion: typeof REPLAY_SCHEMA_VERSION
  initialCommandId: number
  seeds: Record<'career' | 'schedule' | 'match' | 'ai', number>
  commands: readonly ReplayCommand[]
  events: readonly ReplayEvent[]
  checkpoints: readonly ReplayCheckpoint[]
  finalHash: string
}
