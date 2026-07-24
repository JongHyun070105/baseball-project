import type { GameplayCommand } from '../../contracts'
import { SeededRng } from '../core/rng'
import { createAiPitch } from './outcome'
import { reduceMatch } from './engine'
import type { AiSimulationResult, MatchState } from './types'

export function simulateAiHalfInning(source: MatchState, maximumCommands = 200): AiSimulationResult {
  let state = structuredClone(source)
  const events: AiSimulationResult['events'] = []
  const commands: GameplayCommand[] = []
  if (state.phase !== 'live') return { state, events, commands }
  const startingInning = state.inning
  const startingHalf = state.half

  for (let index = 0; index < maximumCommands; index += 1) {
    if (state.phase === 'terminal' || state.inning !== startingInning || state.half !== startingHalf) break
    const aiRng = new SeededRng(state.rng.ai.seed, state.rng.ai.state)
    const command: GameplayCommand = {
      id: state.lastCommandId + 1,
      tick: state.tick + 1,
      type: 'gameplay/pitch',
      payload: createAiPitch(aiRng),
    }
    const reduction = reduceMatch(state, command)
    state = reduction.state
    events.push(...reduction.events)
    commands.push(command)
  }
  if (state.phase !== 'terminal' && state.inning === startingInning && state.half === startingHalf) {
    throw new Error(`AI half inning exceeded ${maximumCommands} commands`)
  }
  return { state, events, commands }
}

export function simulateAiPlateAppearance(source: MatchState, maximumCommands = 30): AiSimulationResult {
  let state = structuredClone(source)
  const events: AiSimulationResult['events'] = []
  const commands: GameplayCommand[] = []
  const terminalCount = state.terminalIds.length
  for (let index = 0; index < maximumCommands && state.phase === 'live' && state.terminalIds.length === terminalCount; index += 1) {
    const aiRng = new SeededRng(state.rng.ai.seed, state.rng.ai.state)
    const command: GameplayCommand = {
      id: state.lastCommandId + 1,
      tick: state.tick + 1,
      type: 'gameplay/pitch',
      payload: createAiPitch(aiRng),
    }
    const reduction = reduceMatch(state, command)
    state = reduction.state
    events.push(...reduction.events)
    commands.push(command)
  }
  if (state.phase === 'live' && state.terminalIds.length === terminalCount) throw new Error(`AI plate appearance exceeded ${maximumCommands} commands`)
  return { state, events, commands }
}

export function simulateAiGame(source: MatchState, maximumHalfInnings = 100): AiSimulationResult {
  let state = structuredClone(source)
  const events: AiSimulationResult['events'] = []
  const commands: GameplayCommand[] = []
  for (let index = 0; index < maximumHalfInnings && state.phase !== 'terminal'; index += 1) {
    const half = simulateAiHalfInning(state)
    state = half.state
    events.push(...half.events)
    commands.push(...half.commands)
  }
  if (state.phase !== 'terminal') throw new Error(`AI game exceeded ${maximumHalfInnings} half innings`)
  return { state, events, commands }
}
