import type { CareerPhase } from './save'

export type MatchPhase = 'setup' | 'ready' | 'live' | 'paused' | 'resolving' | 'terminal'

export const CAREER_TRANSITIONS: Readonly<Record<CareerPhase, readonly CareerPhase[]>> = {
  creation: ['hub'],
  hub: ['action-resolution'],
  'action-resolution': ['hub', 'pregame', 'draft'],
  pregame: ['in-game'],
  'in-game': ['postgame'],
  postgame: ['hub', 'draft'],
  draft: ['completed'],
  completed: [],
}

export const MATCH_TRANSITIONS: Readonly<Record<MatchPhase, readonly MatchPhase[]>> = {
  setup: ['ready'],
  ready: ['live'],
  live: ['paused', 'resolving'],
  paused: ['live'],
  resolving: ['live', 'terminal'],
  terminal: [],
}

export function canTransition<T extends string>(
  graph: Readonly<Record<T, readonly T[]>>,
  from: T,
  to: T,
): boolean {
  return graph[from].includes(to)
}
