import type { FieldingMode, PitchCommand, RunnerDecision, SceneTerminalResult, SwingCommand } from './gameplay'

export interface CommandEnvelope<TType extends string, TPayload> {
  id: number
  tick: number
  type: TType
  payload: TPayload
}

export interface GameplayDecisionOutcome {
  success: boolean
  runs: number
  outs: number
  summary: string
}

export type CareerCommand =
  | CommandEnvelope<'career/choose-action', { action: string }>
  | CommandEnvelope<'career/start-game', { opponentId: string }>
  | CommandEnvelope<'career/commit-scene', SceneTerminalResult>
  | CommandEnvelope<'career/advance-month', Record<string, never>>
  | CommandEnvelope<'career/enter-draft', Record<string, never>>

export type GameplayCommand =
  | CommandEnvelope<'gameplay/pitch', PitchCommand>
  | CommandEnvelope<'gameplay/swing', SwingCommand>
  | CommandEnvelope<'gameplay/move-fielder', { mode: FieldingMode; x: number; z: number; sprint: boolean; outcome?: GameplayDecisionOutcome }>
  | CommandEnvelope<'gameplay/throw-base', { base: 1 | 2 | 3 | 4; accuracy: number; outcome?: GameplayDecisionOutcome }>
  | CommandEnvelope<'gameplay/runner-decision', RunnerDecision & { outcome?: GameplayDecisionOutcome }>
  | CommandEnvelope<'gameplay/pause', Record<string, never>>
  | CommandEnvelope<'gameplay/resume', Record<string, never>>

export type DomainCommand = CareerCommand | GameplayCommand
