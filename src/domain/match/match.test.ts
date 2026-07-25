import { describe, expect, it } from 'vitest'
import type { GameplayCommand, PitchCommand, SwingCommand } from '../../contracts'
import { stateHash } from '../core/hash'
import { SeededRng } from '../core/rng'
import { createMatch, reduceMatch, startMatch } from './engine'
import { classifyContact, resolvePitch, resolveSwing } from './outcome'
import { createReplayBundle, replayMatch } from './replay'
import { simulateAiGame, simulateAiHalfInning } from './simulation'
import type { MatchReduction, MatchState } from './types'

const FIXTURE_PITCH: PitchCommand = {
  pitchType: 'slider',
  target: { x: 0.2, y: 0.55 },
  gestureAccuracy: 0.84,
  releaseAccuracy: 0.91,
}

const FIXTURE_SWING: SwingCommand = {
  swingType: 'power',
  aim: { x: 0.18, y: 0.57 },
  timingSeconds: 0.012,
}

function liveMatch(seed = 74) {
  return startMatch(createMatch({ id: 'fixture-game', seed, innings: 1 })).state
}

describe('deterministic match reducer', () => {
  it('resolves an identical command from identical state byte-for-byte', () => {
    const command: GameplayCommand = { id: 1, tick: 1, type: 'gameplay/swing', payload: FIXTURE_SWING }
    const left = reduceMatch(liveMatch(), command)
    const right = reduceMatch(liveMatch(), command)

    expect(stateHash(left)).toBe(stateHash(right))
    expect(left.state.lastPlay).toEqual(right.state.lastPlay)
  })

  it('emits a scene terminal id exactly once for duplicate delivery', () => {
    let source = liveMatch()
    let command: GameplayCommand = { id: 1, tick: 1, type: 'gameplay/pitch', payload: FIXTURE_PITCH }
    let first = reduceMatch(source, command)
    while (!first.state.lastPlay?.terminal) {
      source = first.state
      command = { id: source.lastCommandId + 1, tick: source.tick + 1, type: 'gameplay/pitch', payload: FIXTURE_PITCH }
      first = reduceMatch(source, command)
    }
    const duplicate = reduceMatch(first.state, command)
    const terminalId = `fixture-game:terminal:${command.id}`

    expect(first.state.terminalIds.at(-1)).toBe(terminalId)
    expect(first.events.filter((entry) => entry.type === 'match/scene-terminal')).toHaveLength(1)
    expect(duplicate.events).toEqual([])
    expect(duplicate.state.terminalIds.filter((id) => id === terminalId)).toHaveLength(1)
  })

  it('keeps strikes intermediate until the third strike completes the plate appearance', () => {
    let threeStrikeStates: MatchState[] | undefined
    for (let seed = 1; seed <= 2_000 && !threeStrikeStates; seed += 1) {
      let state = liveMatch(seed)
      const states: MatchState[] = []
      for (let pitch = 1; pitch <= 3; pitch += 1) {
        state = reduceMatch(state, { id: pitch, tick: pitch, type: 'gameplay/pitch', payload: FIXTURE_PITCH }).state
        states.push(state)
      }
      if (states[0].strikes === 1 && states[1].strikes === 2 && states[2].lastPlay?.result === 'strikeout') threeStrikeStates = states
    }
    expect(threeStrikeStates, 'a deterministic three-strike seed fixture').toBeDefined()
    expect(threeStrikeStates![0].lastPlay?.terminal).toBeUndefined()
    expect(threeStrikeStates![1].lastPlay?.terminal).toBeUndefined()
    expect(threeStrikeStates![2].lastPlay?.terminal?.summary).toBe('strikeout')
    expect(threeStrikeStates![2].terminalIds).toHaveLength(1)
  })

  it('records a foul in the count without emitting a scene terminal', () => {
    let foul: MatchReduction | undefined
    for (let seed = 1; seed <= 5_000 && !foul; seed += 1) {
      for (const timingSeconds of [-.16, -.12, .12, .16]) {
        const reduction = reduceMatch(liveMatch(seed), { id: 1, tick: 1, type: 'gameplay/swing', payload: { swingType: 'contact', aim: { x: 0, y: .5 }, timingSeconds } })
        if (reduction.state.lastPlay?.result === 'foul') { foul = reduction; break }
      }
    }
    expect(foul, 'a deterministic foul seed fixture').toBeDefined()
    expect(foul!.state.strikes).toBe(1)
    expect(foul!.state.lastPlay?.terminal).toBeUndefined()
    expect(foul!.events.some((event) => event.type === 'match/scene-terminal')).toBe(false)
  })

  it('derives and replays fielding and baserunning results from raw intent', () => {
    let state = liveMatch(99)
    const commands: GameplayCommand[] = [
      { id: 1, tick: 1, type: 'gameplay/move-fielder', payload: { mode: 'catcher', x: 0, z: 1, sprint: true, catchAttempt: true } },
      { id: 2, tick: 2, type: 'gameplay/throw-base', payload: { base: 2, attempt: true } },
      { id: 3, tick: 3, type: 'gameplay/runner-decision', payload: { direction: 'advance', sprint: true, slide: true, attempt: true } },
    ]
    for (const command of commands) state = reduceMatch(state, command).state
    expect(state.outs).toBe(0)
    expect(state.score.home).toBe(0)
    expect(state.replay.commands.map((command) => command.type)).toEqual(commands.map((command) => command.type))
    expect(state.replay.checkpoints).toHaveLength(4)
    expect(state.terminalIds).toHaveLength(3)
    const bundle = createReplayBundle(state, 'decision-test')
    const replayed = replayMatch({ id: 'fixture-game', seed: 99, innings: 1 }, bundle)
    expect(createReplayBundle(replayed, 'decision-test').finalHash).toBe(bundle.finalHash)
    expect(replayed.score).toEqual(state.score)
    expect(replayed.outs).toBe(state.outs)
  })

  it('advances an occupied authoritative base from a raw runner decision', () => {
    let seed = 1
    let state = liveMatch(seed)
    for (; seed <= 1_000; seed += 1) {
      const candidate = reduceMatch(liveMatch(seed), { id: 1, tick: 1, type: 'gameplay/swing', payload: FIXTURE_SWING }).state
      if (candidate.bases.some(Boolean)) { state = candidate; break }
    }
    expect(state.bases.some(Boolean), 'a deterministic on-base fixture').toBe(true)
    const before = [...state.bases]
    state = reduceMatch(state, {
      id: 2,
      tick: 2,
      type: 'gameplay/runner-decision',
      payload: { direction: 'advance', sprint: true, slide: true, attempt: true },
    }).state
    expect(state.bases).not.toEqual(before)
    const bundle = createReplayBundle(state, 'runner-base-test')
    const replayed = replayMatch({ id: 'fixture-game', seed, innings: 1 }, bundle)
    expect(replayed.bases).toEqual(state.bases)
    expect(replayed.score).toEqual(state.score)
  })

  it('ignores an injected UI outcome and only trusts raw player input', () => {
    const raw: GameplayCommand = {
      id: 1,
      tick: 1,
      type: 'gameplay/move-fielder',
      payload: { mode: 'outfield', x: 0, z: 1, sprint: true, catchAttempt: true },
    }
    const injected = {
      ...raw,
      payload: {
        ...raw.payload,
        outcome: { success: true, runs: 99, outs: 99, summary: 'forged' },
      },
    } as unknown as GameplayCommand
    const expected = reduceMatch(liveMatch(912), raw).state
    const actual = reduceMatch(liveMatch(912), injected).state

    expect(actual.score).toEqual(expected.score)
    expect(actual.outs).toBe(expected.outs)
    expect(actual.lastPlay).toEqual(expected.lastPlay)
    expect(actual.terminalIds).toEqual(expected.terminalIds)
  })

  it('does not reapply score or outs while resolving a presentation fielding scene', () => {
    let state: MatchState | undefined
    for (let seed = 1; seed <= 2_000 && state === undefined; seed += 1) {
      const candidate = reduceMatch(liveMatch(seed), {
        id: 1,
        tick: 1,
        type: 'gameplay/swing',
        payload: FIXTURE_SWING,
      }).state
      if (candidate.lastPlay?.terminal) state = candidate
    }
    expect(state, 'a deterministic completed plate appearance fixture').toBeDefined()
    const beforeScore = structuredClone(state!.score)
    const beforeOuts = state!.outs
    const resolved = reduceMatch(state!, {
      id: 2,
      tick: state!.tick + 1,
      type: 'gameplay/move-fielder',
      payload: { mode: 'outfield', x: 0, z: 0, sprint: true, catchAttempt: true },
    })
    const terminal = resolved.events.find((entry) => entry.type === 'match/scene-terminal')

    expect(resolved.state.score).toEqual(beforeScore)
    expect(resolved.state.outs).toBe(beforeOuts)
    expect(terminal?.payload.runs).toBe(0)
    expect(terminal?.payload.outs).toBe(0)
  })

  it('authoritatively resolves infield catches before allowing a throw', () => {
    let caught: MatchReduction | undefined
    let missed: MatchReduction | undefined
    for (let seed = 1; seed <= 2_000 && (!caught || !missed); seed += 1) {
      const moved = reduceMatch(liveMatch(seed), {
        id: 1,
        tick: 1,
        type: 'gameplay/move-fielder',
        payload: { mode: 'infield', x: 0, z: 1, sprint: true },
      }).state
      const attempt = reduceMatch(moved, {
        id: 2,
        tick: 2,
        type: 'gameplay/move-fielder',
        payload: { mode: 'infield', x: 0, z: 0, sprint: true, catchAttempt: true },
      })
      const fielding = (attempt.state as MatchState & { fielding?: { caught: boolean } }).fielding
      if (fielding?.caught) caught = attempt
      if (attempt.events.some((event) => event.type === 'match/scene-terminal' && !event.payload.success)) missed = attempt
    }

    expect(caught, 'a deterministic successful infield catch').toBeDefined()
    expect(caught!.events.some((event) => event.type === 'match/scene-terminal')).toBe(false)
    expect(missed, 'a deterministic failed infield catch').toBeDefined()
  })

  it('keeps the accumulated fielding route when movement keys are released', () => {
    const moved = reduceMatch(liveMatch(77), {
      id: 1,
      tick: 1,
      type: 'gameplay/move-fielder',
      payload: { mode: 'infield', x: 0, z: 1, sprint: true },
    }).state
    const released = reduceMatch(moved, {
      id: 2,
      tick: 2,
      type: 'gameplay/move-fielder',
      payload: { mode: 'infield', x: 0, z: 0, sprint: false },
    }).state

    expect(moved.fielding.distance).toBeGreaterThan(0)
    expect(released.fielding.distance).toBe(moved.fielding.distance)
    expect(released.fielding.z).toBe(moved.fielding.z)
  })

  it('commits non-sliding runner decisions explicitly', () => {
    let seed = 1
    let state = liveMatch(seed)
    for (; seed <= 1_000; seed += 1) {
      const candidate = reduceMatch(liveMatch(seed), { id: 1, tick: 1, type: 'gameplay/swing', payload: FIXTURE_SWING }).state
      if (candidate.bases.some(Boolean)) { state = candidate; break }
    }
    const result = reduceMatch(state, {
      id: 2,
      tick: state.tick + 1,
      type: 'gameplay/runner-decision',
      payload: { direction: 'advance', sprint: true, slide: false, attempt: true },
    } as unknown as GameplayCommand)

    expect(result.events.some((event) => event.type === 'match/scene-terminal')).toBe(true)
  })

  it('keeps terminal score, bases, and outs immutable', () => {
    const terminal = simulateAiGame(liveMatch(404)).state
    const source = { ...terminal, bases: [false, false, true] as const }
    const before = { score: structuredClone(source.score), bases: [...source.bases], outs: source.outs, final: stateHash({ ...source, replay: undefined }) }
    const result = reduceMatch(source, {
      id: source.lastCommandId + 1,
      tick: source.tick + 1,
      type: 'gameplay/runner-decision',
      payload: { direction: 'advance', sprint: true, slide: true, attempt: true },
    } as unknown as GameplayCommand)

    expect(result.events).toEqual([])
    expect(result.state.score).toEqual(before.score)
    expect(result.state.bases).toEqual(before.bases)
    expect(result.state.outs).toBe(before.outs)
    expect(stateHash({ ...result.state, replay: undefined })).toBe(before.final)
  })

  it('replays a paused checkpoint as paused until an authoritative resume', () => {
    const paused = reduceMatch(liveMatch(42), { id: 1, tick: 1, type: 'gameplay/pause', payload: {} }).state
    const bundle = createReplayBundle(paused, 'pause-test')
    const restored = replayMatch({ id: 'fixture-game', seed: 42, innings: 1 }, bundle)
    expect(restored.phase).toBe('paused')
    const resumed = reduceMatch(restored, { id: 2, tick: 2, type: 'gameplay/resume', payload: {} }).state
    expect(resumed.phase).toBe('live')
  })

  it('enforces pause and resume transitions without advancing play', () => {
    const paused = reduceMatch(liveMatch(), { id: 1, tick: 1, type: 'gameplay/pause', payload: {} })
    const ignored = reduceMatch(paused.state, { id: 2, tick: 2, type: 'gameplay/swing', payload: FIXTURE_SWING })
    const resumed = reduceMatch(ignored.state, { id: 2, tick: 2, type: 'gameplay/resume', payload: {} })

    expect(paused.state.phase).toBe('paused')
    expect(ignored.events).toEqual([])
    expect(resumed.state.phase).toBe('live')
  })

  it('rejects non-monotonic unseen commands', () => {
    const first = reduceMatch(liveMatch(), { id: 2, tick: 2, type: 'gameplay/pitch', payload: FIXTURE_PITCH })
    expect(() => reduceMatch(first.state, { id: 1, tick: 3, type: 'gameplay/pitch', payload: FIXTURE_PITCH })).toThrow(
      'not monotonic',
    )
  })
})

describe('numerical pitching and contact fixtures', () => {
  it('keeps the seeded pitch location and quality stable', () => {
    const pitch = resolvePitch(FIXTURE_PITCH, new SeededRng(991))
    expect(pitch.actual.x).toBeCloseTo(0.122286, 6)
    expect(pitch.actual.y).toBeCloseTo(0.642211, 6)
    expect(pitch.quality).toBeCloseTo(0.706035, 6)
    expect(pitch.inZone).toBe(true)
  })

  it('keeps the seeded batted-ball fixture stable', () => {
    const rng = new SeededRng(991)
    const pitch = resolvePitch(FIXTURE_PITCH, rng)
    const contact = resolveSwing(pitch, FIXTURE_SWING, rng)
    expect(contact.result).toBe('single')
    expect(contact.contact?.classification).toBe('fair')
    expect(contact.contact?.flight.exitVelocityMps).toBeCloseTo(44.93718, 5)
    expect(contact.contact?.flight.state.position).toEqual({ x: -4.243028, y: -0.017588, z: 75.152217 })
  })

  it.each([
    ['foul', { flightClassification: 'grounded' as const, sprayAngle: 46, launchAngle: 4, distance: 70 }],
    ['ground', { flightClassification: 'grounded' as const, sprayAngle: 2, launchAngle: 4, distance: 70 }],
    ['fair', { flightClassification: 'grounded' as const, sprayAngle: 2, launchAngle: 18, distance: 70 }],
    ['fence', { flightClassification: 'grounded' as const, sprayAngle: 2, launchAngle: 16, distance: 121 }],
    ['home-run', { flightClassification: 'home-run' as const, sprayAngle: 2, launchAngle: 31, distance: 120 }],
    ['catch', { flightClassification: 'grounded' as const, sprayAngle: 2, launchAngle: 24, distance: 80 }],
  ])('classifies the %s boundary authoritatively', (expected, fixture) => {
    expect(
      classifyContact({
        ...fixture,
        contactQuality: 0.6,
        catchProbability: 0.5,
        fieldingRoll: expected === 'catch' ? 0.1 : 0.9,
      }).classification,
    ).toBe(expected)
  })
})

describe('AI inning and replay integration', () => {
  it('simulates a complete non-player half inning deterministically', () => {
    const left = simulateAiHalfInning(liveMatch(8128))
    const right = simulateAiHalfInning(liveMatch(8128))

    expect(left.state.half).toBe('bottom')
    expect(left.state.outs).toBe(0)
    expect(left.commands.length).toBeGreaterThan(2)
    expect(stateHash(left)).toBe(stateHash(right))
  })

  it('replays commands to the same authoritative final hash', () => {
    const simulation = simulateAiHalfInning(liveMatch(8128))
    const bundle = createReplayBundle(simulation.state, 'test-build')
    const replayed = replayMatch({ id: 'fixture-game', seed: 8128, innings: 1 }, bundle)

    expect(createReplayBundle(replayed, 'test-build').finalHash).toBe(bundle.finalHash)
    expect(replayed.terminalIds).toEqual(simulation.state.terminalIds)
    expect(bundle.checkpoints).toHaveLength(bundle.commands.length + 1)
  })

  it('rejects a replay whose recorded intermediate event differs despite the same final hash', () => {
    const simulation = simulateAiHalfInning(liveMatch(8128))
    const bundle = createReplayBundle(simulation.state, 'event-integrity-test')
    const mutated = structuredClone(bundle)
    const event = mutated.events.find((entry) => entry.type === 'match/transitioned')
    expect(event).toBeDefined()
    event!.payload = { ...event!.payload as object, from: 'tampered' }

    expect(() => replayMatch({ id: 'fixture-game', seed: 8128, innings: 1 }, mutated)).toThrow('Replay events mismatch')
  })

  it('rejects a replay whose intermediate ball checkpoint differs despite the same final hash', () => {
    let bundle: ReturnType<typeof createReplayBundle> | undefined
    for (let seed = 1; seed <= 1_000 && !bundle; seed += 1) {
      const state = reduceMatch(liveMatch(seed), { id: 1, tick: 1, type: 'gameplay/swing', payload: FIXTURE_SWING }).state
      const candidate = createReplayBundle(state, 'checkpoint-integrity-test')
      if (candidate.checkpoints.some((checkpoint) => checkpoint.ball !== undefined)) bundle = candidate
    }
    expect(bundle, 'a deterministic ball checkpoint fixture').toBeDefined()
    const mutated = structuredClone(bundle!)
    const checkpointIndex = mutated.checkpoints.findIndex((entry) => entry.ball !== undefined)
    const checkpoint = mutated.checkpoints[checkpointIndex]!
    const mutatedWithCheckpoint = {
      ...mutated,
      checkpoints: mutated.checkpoints.map((entry, index) => index === checkpointIndex
        ? { ...checkpoint, ball: { ...checkpoint.ball!, position: { ...checkpoint.ball!.position, x: checkpoint.ball!.position.x + 0.000001 } } }
        : entry),
    }

    expect(() => replayMatch({ id: 'fixture-game', seed: bundle!.seeds.career, innings: 1 }, mutatedWithCheckpoint)).toThrow('Replay checkpoints mismatch')
  })

  it('drives an AI game through the terminal state machine', () => {
    const game = simulateAiGame(liveMatch(404))

    expect(game.state.phase).toBe('terminal')
    expect(game.state.score.home).not.toBe(game.state.score.away)
    expect(game.events.at(-1)?.type).toBe('match/transitioned')
    expect(game.state.terminalIds.length).toBeGreaterThan(0)
    expect(game.state.terminalIds.length).toBeLessThan(game.commands.length)
  })
})
