import type { GameplayCommand, GameplayDecisionOutcome, MatchEvent, MatchPhase, SceneTerminalResult } from '../../contracts'
import { canTransition, MATCH_TRANSITIONS } from '../../contracts'
import { stateHash } from '../core/hash'
import { deriveSeed, SeededRng } from '../core/rng'
import { createAiSwing, createAiPitch, resolvePitch, resolveSwing } from './outcome'
import type {
  BaseState,
  MatchConfig,
  MatchReduction,
  MatchState,
  PlateResult,
  PlayResolution,
  StartedMatch,
  TeamSide,
} from './types'

function transition(state: MatchState, to: MatchPhase, commandId: number): MatchEvent {
  if (!canTransition(MATCH_TRANSITIONS, state.phase, to)) {
    throw new Error(`Illegal match transition: ${state.phase} -> ${to}`)
  }
  const from = state.phase
  state.phase = to
  return event(state, commandId, 'match/transitioned', { from, to })
}

function event<T extends MatchEvent['type']>(
  state: MatchState,
  commandId: number,
  type: T,
  payload: Extract<MatchEvent, { type: T }>['payload'],
): Extract<MatchEvent, { type: T }> {
  const value = {
    id: `${state.id}:event:${state.eventSequence}`,
    commandId,
    tick: state.tick,
    type,
    payload,
  } as Extract<MatchEvent, { type: T }>
  state.eventSequence += 1
  return value
}

function battingSide(state: MatchState): TeamSide {
  return state.half === 'top' ? 'away' : 'home'
}

function opposingSide(side: TeamSide): TeamSide {
  return side === 'home' ? 'away' : 'home'
}

function basesAdvancedBy(result: PlateResult): number {
  switch (result) {
    case 'single':
      return 1
    case 'double':
      return 2
    case 'triple':
      return 3
    default:
      return 0
  }
}

function advanceRunners(bases: BaseState, result: PlateResult): { bases: BaseState; runs: number } {
  if (result === 'home-run') return { bases: [false, false, false], runs: bases.filter(Boolean).length + 1 }
  if (result === 'walk') {
    const [first, second, third] = bases
    return {
      bases: [true, second || first, third || (first && second)],
      runs: first && second && third ? 1 : 0,
    }
  }
  const advances = basesAdvancedBy(result)
  if (advances === 0) return { bases, runs: 0 }
  const occupied = [0, ...bases.map((isOccupied, index) => (isOccupied ? index + 1 : -1))].filter((base) => base >= 0)
  const next: boolean[] = [false, false, false]
  let runs = 0
  for (const base of occupied) {
    const destination = base + advances
    if (destination >= 4) runs += 1
    else next[destination - 1] = true
  }
  return { bases: next as unknown as BaseState, runs }
}

function finishPlateAppearance(state: MatchState, result: PlateResult): { runs: number; outs: number } {
  let runs = 0
  let outs = 0
  if (result === 'out' || result === 'strikeout') {
    state.outs += 1
    outs = 1
  } else {
    const runners = advanceRunners(state.bases, result)
    state.bases = runners.bases
    runs = runners.runs
    state.score[battingSide(state)] += runs
  }
  state.balls = 0
  state.strikes = 0
  return { runs, outs }
}

function applyPitchResult(state: MatchState, rawResult: PlateResult): { result: PlateResult; runs: number; outs: number; plateAppearanceComplete: boolean } {
  if (rawResult === 'ball') {
    state.balls += 1
    if (state.balls < 4) return { result: rawResult, runs: 0, outs: 0, plateAppearanceComplete: false }
    return { result: 'walk', ...finishPlateAppearance(state, 'walk'), plateAppearanceComplete: true }
  }
  if (rawResult === 'called-strike' || rawResult === 'swinging-strike') {
    state.strikes += 1
    if (state.strikes < 3) return { result: rawResult, runs: 0, outs: 0, plateAppearanceComplete: false }
    return { result: 'strikeout', ...finishPlateAppearance(state, 'strikeout'), plateAppearanceComplete: true }
  }
  if (rawResult === 'foul') {
    state.strikes = Math.min(2, state.strikes + 1)
    return { result: rawResult, runs: 0, outs: 0, plateAppearanceComplete: false }
  }
  return { result: rawResult, ...finishPlateAppearance(state, rawResult), plateAppearanceComplete: true }
}

function gameIsOver(state: MatchState): boolean {
  if (state.playerPlateAppearances > 0 && state.playerPlateAppearances < 3) return false
  if (state.inning < state.innings) return false
  if (state.half === 'bottom') {
    if (state.score.home > state.score.away) return true
    return state.outs >= 3 && state.score.away > state.score.home
  }
  return state.half === 'top' && state.outs >= 3 && state.score.home > state.score.away
}

function advanceHalfIfNeeded(state: MatchState): void {
  if (state.outs < 3 || gameIsOver(state)) return
  state.outs = 0
  state.balls = 0
  state.strikes = 0
  state.bases = [false, false, false]
  if (state.half === 'top') state.half = 'bottom'
  else {
    state.half = 'top'
    state.inning += 1
  }
}

function makeTerminal(
  state: MatchState,
  commandId: number,
  scene: 'batting' | 'pitching',
  result: PlateResult,
  runs: number,
  outs: number,
  replayHash: string,
): SceneTerminalResult {
  return {
    id: `${state.id}:terminal:${commandId}`,
    scene,
    success: isSuccessfulSceneResult(scene, result),
    runs,
    outs,
    summary: result,
    replayHash,
  }
}

function isSuccessfulSceneResult(scene: 'batting' | 'pitching', result: PlateResult): boolean {
  if (scene === 'pitching') return result === 'strikeout' || result === 'out'
  return result === 'single' || result === 'double' || result === 'triple' || result === 'home-run' || result === 'walk'
}

function sceneForDecisionCommand(
  command: Extract<GameplayCommand, { type: 'gameplay/move-fielder' | 'gameplay/throw-base' | 'gameplay/runner-decision' }>,
): SceneTerminalResult['scene'] {
  if (command.type === 'gameplay/runner-decision') return 'baserunning'
  if (command.type === 'gameplay/move-fielder') return command.payload.mode
  return 'infield'
}

function applyDecisionOutcome(state: MatchState, command: Extract<GameplayCommand, { type: 'gameplay/move-fielder' | 'gameplay/throw-base' | 'gameplay/runner-decision' }>, outcome: GameplayDecisionOutcome): MatchEvent[] {
  const scene = sceneForDecisionCommand(command)
  if (command.type === 'gameplay/runner-decision') {
    const occupied = state.bases.map((value, index) => value ? index : -1).filter((index) => index >= 0)
    const lead = occupied.at(-1)
    if (!outcome.success && lead !== undefined) {
      const bases = [...state.bases] as boolean[]
      bases[lead] = false
      state.bases = bases as unknown as BaseState
    } else if (outcome.success && command.payload.direction === 'advance' && lead !== undefined) {
      const bases = [...state.bases] as boolean[]
      bases[lead] = false
      if (lead === 2) state.score[state.playerTeam] += 1
      else bases[lead + 1] = true
      state.bases = bases as unknown as BaseState
    }
    state.score[state.playerTeam] += outcome.runs
  } else {
    state.score[opposingSide(state.playerTeam)] += outcome.runs
  }
  state.outs += outcome.outs
  state.tick = Math.max(state.tick + 1, command.tick)
  const payload = { id: `${state.id}:terminal:${command.id}`, scene, success: outcome.success, runs: outcome.runs, outs: outcome.outs, summary: outcome.summary }
  const terminal: SceneTerminalResult = { ...payload, replayHash: stateHash({ ...payload, score: state.score, bases: state.bases, inning: state.inning, half: state.half }) }
  state.terminalIds.push(terminal.id)
  return [event(state, command.id, 'match/scene-terminal', terminal)]
}

export function createMatch(config: MatchConfig): MatchState {
  if (!config.id.trim()) throw new Error('Match id cannot be empty')
  const innings = config.innings ?? 9
  const initialCommandId = config.initialCommandId ?? 0
  if (!Number.isInteger(innings) || innings < 1) {
    throw new Error('Innings must be a positive integer')
  }
  const seed = config.seed >>> 0 || 1
  return {
    id: config.id,
    seed,
    innings,
    playerTeam: config.playerTeam ?? 'home',
    phase: 'setup',
    tick: 0,
    inning: 1,
    half: 'top',
    balls: 0,
    strikes: 0,
    outs: 0,
    bases: [false, false, false],
    score: { away: 0, home: 0 },
    rng: {
      match: { seed: deriveSeed(seed, 'match'), state: deriveSeed(seed, 'match') },
      ai: { seed: deriveSeed(seed, 'ai'), state: deriveSeed(seed, 'ai') },
    },
    lastCommandId: initialCommandId,
    processedCommandIds: [],
    terminalIds: [],
    playerPlateAppearances: 0,
    eventSequence: 0,
    replay: { initialCommandId, commands: [], events: [], checkpoints: [] },
  }
}

export function startMatch(source: MatchState): StartedMatch {
  const state = structuredClone(source)
  if (state.phase !== 'setup' && state.phase !== 'ready') return { state, events: [] }
  const events: MatchEvent[] = []
  if (state.phase === 'setup') events.push(transition(state, 'ready', 0))
  events.push(transition(state, 'live', 0))
  recordEvents(state, events)
  checkpoint(state)
  return { state, events }
}

function recordEvents(state: MatchState, events: MatchEvent[]): void {
  state.replay.events.push(...events.map(({ id, tick, type, payload }) => ({ id, tick, type, payload })))
}

function checkpoint(state: MatchState): void {
  const snapshot = { ...state, replay: undefined }
  state.replay.checkpoints.push({ tick: state.tick, stateHash: stateHash(snapshot), ball: state.lastPlay?.contact?.flight.state })
}

function resolveAction(state: MatchState, command: GameplayCommand): { play: PlayResolution; events: MatchEvent[] } {
  const matchRng = new SeededRng(state.rng.match.seed, state.rng.match.state)
  const aiRng = new SeededRng(state.rng.ai.seed, state.rng.ai.state)
  const pitchCommand = command.type === 'gameplay/pitch' ? command.payload : createAiPitch(aiRng)
  const pitch = resolvePitch(pitchCommand, matchRng)
  const swing = command.type === 'gameplay/swing' ? command.payload : createAiSwing(pitch, aiRng)
  const swingResolution = resolveSwing(pitch, swing, matchRng)
  const applied = applyPitchResult(state, swingResolution.result)
  state.rng.match = matchRng.snapshot()
  state.rng.ai = aiRng.snapshot()
  state.tick = Math.max(state.tick + 1, command.tick)

  const replayHash = stateHash({
    matchId: state.id,
    commandId: command.id,
    inning: state.inning,
    half: state.half,
    count: [state.balls, state.strikes, state.outs],
    bases: state.bases,
    score: state.score,
    pitch,
    swing,
    contact: swingResolution.contact,
  })
  const terminal = applied.plateAppearanceComplete ? makeTerminal(
    state, command.id, command.type === 'gameplay/pitch' ? 'pitching' : 'batting',
    applied.result, applied.runs, applied.outs, replayHash,
  ) : undefined
  const play: PlayResolution = {
    result: applied.result,
    pitch,
    swing,
    contact: swingResolution.contact,
    runs: applied.runs,
    outs: applied.outs,
    ...(terminal ? { terminal } : {}),
  }
  state.lastPlay = play
  const events: MatchEvent[] = []
  if (play.contact) events.push(event(state, command.id, 'match/ball-updated', play.contact.flight))
  if (terminal) {
    if (terminal.scene === 'batting') state.playerPlateAppearances += 1
    state.terminalIds.push(terminal.id)
    events.push(event(state, command.id, 'match/scene-terminal', terminal))
    advanceHalfIfNeeded(state)
  }
  return { play, events }
}

export function reduceMatch(source: MatchState, command: GameplayCommand): MatchReduction {
  const state = structuredClone(source)
  if (state.processedCommandIds.includes(command.id)) return { state, events: [] }
  if (command.id <= state.lastCommandId) throw new Error(`Command id ${command.id} is not monotonic`)
  if (command.tick < state.tick) throw new Error(`Command tick ${command.tick} precedes state tick ${state.tick}`)
  const presentationCommand = command.type === 'gameplay/move-fielder' || command.type === 'gameplay/throw-base' || command.type === 'gameplay/runner-decision'
  if (state.phase === 'terminal' && !presentationCommand) return { state, events: [] }

  const events: MatchEvent[] = []
  if (command.type === 'gameplay/pause') {
    if (state.phase !== 'live') return { state, events }
    state.tick = Math.max(state.tick, command.tick)
    events.push(transition(state, 'paused', command.id))
  } else if (command.type === 'gameplay/resume') {
    if (state.phase !== 'paused') return { state, events }
    state.tick = Math.max(state.tick, command.tick)
    events.push(transition(state, 'live', command.id))
  } else if (command.type === 'gameplay/pitch' || command.type === 'gameplay/swing') {
    if (state.phase !== 'live') return { state, events }
    events.push(transition(state, 'resolving', command.id))
    events.push(...resolveAction(state, command).events)
    if (gameIsOver(state)) events.push(transition(state, 'terminal', command.id))
    else events.push(transition(state, 'live', command.id))
  } else if (command.type === 'gameplay/move-fielder' || command.type === 'gameplay/throw-base' || command.type === 'gameplay/runner-decision') {
    if (state.phase !== 'live' && state.phase !== 'terminal') return { state, events }
    if (command.payload.outcome) {
      const wasTerminal = state.phase === 'terminal'
      if (!wasTerminal) events.push(transition(state, 'resolving', command.id))
      events.push(...applyDecisionOutcome(state, command, command.payload.outcome))
      if (!wasTerminal && gameIsOver(state)) events.push(transition(state, 'terminal', command.id))
      else if (!wasTerminal) {
        advanceHalfIfNeeded(state)
        events.push(transition(state, 'live', command.id))
      }
    } else state.tick = Math.max(state.tick + 1, command.tick)
  } else {
    return { state, events }
  }

  state.lastCommandId = command.id
  state.processedCommandIds.push(command.id)
  state.replay.commands.push({ id: command.id, tick: command.tick, type: command.type, payload: command.payload })
  recordEvents(state, events)
  checkpoint(state)
  return { state, events }
}
