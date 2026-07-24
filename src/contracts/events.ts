import type { BallFlightResult, SceneTerminalResult } from './gameplay'
import type { CareerPhase } from './save'
import type { MatchPhase } from './state-machines'

export interface DomainEvent<TType extends string, TPayload> {
  id: string
  commandId: number
  tick: number
  type: TType
  payload: TPayload
}

export type CareerEvent =
  | DomainEvent<'career/transitioned', { from: CareerPhase; to: CareerPhase }>
  | DomainEvent<'career/action-resolved', { action: string; summary: string }>
  | DomainEvent<'career/month-advanced', { monthIndex: number }>
  | DomainEvent<'career/scene-committed', SceneTerminalResult>
  | DomainEvent<'career/draft-completed', { projectedRound: number | null }>

export type MatchEvent =
  | DomainEvent<'match/transitioned', { from: MatchPhase; to: MatchPhase }>
  | DomainEvent<'match/ball-updated', BallFlightResult>
  | DomainEvent<'match/scene-terminal', SceneTerminalResult>

export type AnyDomainEvent = CareerEvent | MatchEvent
