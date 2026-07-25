import type { GameplayCommand, MatchEvent, MatchPhase, SceneTerminalResult } from '../../contracts'
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

type DecisionCommand = Extract<GameplayCommand, { type: 'gameplay/move-fielder' | 'gameplay/throw-base' | 'gameplay/runner-decision' }>

interface DecisionResolution {
  success: boolean
  runs: number
  outs: number
  summary: string
}

function sceneForDecisionCommand(command: DecisionCommand): SceneTerminalResult['scene'] {
  if (command.type === 'gameplay/runner-decision') return 'baserunning'
  if (command.type === 'gameplay/move-fielder') return command.payload.mode
  return 'infield'
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function decisionRoll(state: MatchState): number {
  const rng = new SeededRng(state.rng.match.seed, state.rng.match.state)
  const roll = rng.next()
  state.rng.match = rng.snapshot()
  return roll
}

function resetFielding(state: MatchState): void {
  state.fielding = { mode: null, x: 0, z: 0, distance: 0, sprint: false, caught: false }
}

function updateFielderRoute(state: MatchState, command: Extract<DecisionCommand, { type: 'gameplay/move-fielder' }>): void {
  if (state.fielding.mode !== command.payload.mode) resetFielding(state)
  const step = Math.hypot(command.payload.x, command.payload.z) * (command.payload.sprint ? 1.35 : 1)
  state.fielding = {
    mode: command.payload.mode,
    x: Math.max(-4, Math.min(4, state.fielding.x + command.payload.x)),
    z: Math.max(-4, Math.min(4, state.fielding.z + command.payload.z)),
    distance: Math.min(8, state.fielding.distance + step),
    sprint: command.payload.sprint,
    caught: state.fielding.caught,
  }
}

function resolveFielderCatch(state: MatchState, command: Extract<DecisionCommand, { type: 'gameplay/move-fielder' }>): DecisionResolution {
  updateFielderRoute(state, command)
  const sprintBonus = state.fielding.sprint ? .08 : 0
  const baseChance = command.payload.mode === 'catcher' ? .9 : command.payload.mode === 'infield' ? .82 : .76
  const success = decisionRoll(state) <= clampUnit(baseChance - state.fielding.distance * .055 + sprintBonus)
  if (command.payload.mode === 'infield' && success) state.fielding.caught = true
  return {
    success,
    runs: 0,
    outs: 0,
    summary: success
      ? command.payload.mode === 'infield' ? '포구 성공 · 송구 베이스를 선택하세요' : '타구를 안정적으로 처리했습니다'
      : '타구를 놓쳤습니다',
  }
}

function resolveFielderThrow(state: MatchState, command: Extract<DecisionCommand, { type: 'gameplay/throw-base' }>): DecisionResolution {
  if (!state.fielding.caught) {
    return { success: false, runs: 0, outs: 0, summary: '포구하지 못해 송구할 수 없습니다' }
  }
  const expectedBase = state.lastPlay?.contact?.classification === 'ground' ? 1 : 2
  const sprintBonus = state.fielding.sprint ? .04 : 0
  const accurate = command.payload.base === expectedBase && decisionRoll(state) <= clampUnit(.88 - state.fielding.distance * .045 + sprintBonus)
  return {
    success: accurate,
    runs: 0,
    outs: 0,
    summary: accurate ? `${command.payload.base}루 송구가 정확하게 연결됩니다` : `${command.payload.base}루 송구가 빗나갑니다`,
  }
}

function resolveRunnerDecision(state: MatchState, command: Extract<DecisionCommand, { type: 'gameplay/runner-decision' }>): DecisionResolution {
  const occupied = state.bases.map((value, index) => value ? index : -1).filter((index) => index >= 0)
  const lead = occupied.at(-1)
  if (lead === undefined || command.payload.direction === 'hold') {
    return { success: true, runs: 0, outs: 0, summary: '베이스에서 다음 플레이를 기다립니다' }
  }

  const sprintBonus = command.payload.sprint ? .14 : 0
  const slideBonus = command.payload.slide ? .08 : 0
  const retreat = command.payload.direction === 'retreat'
  const chance = clampUnit((retreat ? .78 : .57) + sprintBonus + slideBonus - lead * .035)
  const success = decisionRoll(state) <= chance
  const bases = [...state.bases] as boolean[]
  bases[lead] = false
  if (!success) {
    state.bases = bases as unknown as BaseState
    state.outs += 1
    return { success: false, runs: 0, outs: 1, summary: retreat ? '귀루 중 태그 아웃' : '다음 베이스에서 태그 아웃' }
  }
  if (retreat) {
    bases[Math.max(0, lead - 1)] = true
    state.bases = bases as unknown as BaseState
    return { success: true, runs: 0, outs: 0, summary: '안전하게 귀루했습니다' }
  }
  if (lead === 2) {
    state.score[battingSide(state)] += 1
    state.bases = bases as unknown as BaseState
    return { success: true, runs: 1, outs: 0, summary: '과감한 주루로 득점합니다' }
  }
  bases[lead + 1] = true
  state.bases = bases as unknown as BaseState
  return { success: true, runs: 0, outs: 0, summary: '다음 베이스를 밟았습니다' }
}

function recordDecisionTerminal(state: MatchState, command: DecisionCommand, resolution: DecisionResolution): MatchEvent[] {
  const scene = sceneForDecisionCommand(command)
  state.tick = Math.max(state.tick + 1, command.tick)
  const payload = { id: `${state.id}:terminal:${command.id}`, scene, ...resolution }
  const terminal: SceneTerminalResult = {
    ...payload,
    replayHash: stateHash({ ...payload, score: state.score, bases: state.bases, inning: state.inning, half: state.half, rng: state.rng.match }),
  }
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
    fielding: { mode: null, x: 0, z: 0, distance: 0, sprint: false, caught: false },
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
  if (state.phase === 'terminal') return { state, events: [] }

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
    if (state.phase !== 'live') return { state, events }
    const resolvesCatch = command.type === 'gameplay/move-fielder' && command.payload.catchAttempt === true
    const resolvesThrow = command.type === 'gameplay/throw-base' && command.payload.attempt
    const resolvesRunner = command.type === 'gameplay/runner-decision' && command.payload.attempt
    if (!resolvesCatch && !resolvesThrow && !resolvesRunner) {
      if (command.type === 'gameplay/move-fielder') updateFielderRoute(state, command)
      state.tick = Math.max(state.tick + 1, command.tick)
    } else {
      events.push(transition(state, 'resolving', command.id))
      if (command.type === 'gameplay/move-fielder') {
        const resolution = resolveFielderCatch(state, command)
        if (command.payload.mode === 'infield' && resolution.success) {
          state.tick = Math.max(state.tick + 1, command.tick)
        } else {
          events.push(...recordDecisionTerminal(state, command, resolution))
          resetFielding(state)
        }
      } else if (command.type === 'gameplay/throw-base') {
        events.push(...recordDecisionTerminal(state, command, resolveFielderThrow(state, command)))
        resetFielding(state)
      } else {
        events.push(...recordDecisionTerminal(state, command, resolveRunnerDecision(state, command)))
      }
      advanceHalfIfNeeded(state)
      if (gameIsOver(state)) events.push(transition(state, 'terminal', command.id))
      else events.push(transition(state, 'live', command.id))
    }
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
