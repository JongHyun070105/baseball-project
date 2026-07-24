import { REPLAY_SCHEMA_VERSION, type ReplayBundle } from '../../contracts'
import { stateHash } from '../core/hash'
import { createMatch, reduceMatch, startMatch } from './engine'
import type { MatchConfig, MatchState } from './types'

export function createReplayBundle(state: MatchState, buildVersion = 'dev'): ReplayBundle {
  const finalHash = stateHash({ ...state, replay: undefined })
  return {
    buildVersion,
    schemaVersion: REPLAY_SCHEMA_VERSION,
    initialCommandId: state.replay.initialCommandId,
    seeds: {
      career: state.seed,
      schedule: state.seed,
      match: state.rng.match.seed,
      ai: state.rng.ai.seed,
    },
    commands: state.replay.commands,
    events: state.replay.events,
    checkpoints: state.replay.checkpoints,
    finalHash,
  }
}

export function replayMatch(config: MatchConfig, bundle: ReplayBundle): MatchState {
  let state = startMatch(createMatch({ ...config, initialCommandId: bundle.initialCommandId })).state
  for (const recorded of bundle.commands) {
    const command = recorded as Parameters<typeof reduceMatch>[1]
    state = reduceMatch(state, command).state
  }
  const actual = createReplayBundle(state, bundle.buildVersion)
  if (actual.finalHash !== bundle.finalHash) {
    throw new Error(`Replay hash mismatch: expected ${bundle.finalHash}, received ${actual.finalHash}`)
  }
  assertRecordedBytes('events', bundle.events, actual.events)
  assertRecordedBytes('checkpoints', bundle.checkpoints, actual.checkpoints)
  return state
}

function assertRecordedBytes(label: 'events' | 'checkpoints', expected: unknown, actual: unknown): void {
  const expectedBytes = JSON.stringify(expected)
  const actualBytes = JSON.stringify(actual)
  if (actualBytes !== expectedBytes) {
    throw new Error(`Replay ${label} mismatch`)
  }
}
