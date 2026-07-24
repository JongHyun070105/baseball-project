import { describe, expect, it } from 'vitest'
import type { CareerSave } from '../contracts/save'
import { createCareerSchedule } from '../domain/career'
import { stateHash } from '../domain/core/hash'
import { createMatch, createReplayBundle, reduceMatch, simulateAiGame, startMatch } from '../domain/match'
import { MemoryStorage } from './memory-storage'
import { MAX_SAVE_BYTES, SaveRepository, SaveRepositoryError } from './save-repository'

function career(overrides: Partial<CareerSave> = {}): CareerSave {
  return {
    schemaVersion: 3,
    id: 'career-16',
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
    seed: 42,
    rngState: { career: 1, schedule: 2, match: 3, ai: 4 },
    phase: 'hub',
    player: {
      id: 'player-16',
      name: '김다이아',
      role: 'hitter',
      position: 'SS',
      schoolId: 'seorin',
      year: 1,
      ratings: { contact: 60, power: 50, speed: 70, fielding: 65, stamina: 55, velocity: 30, command: 40, movement: 35 },
      condition: 90,
      morale: 80,
      coachTrust: 25,
      scouting: 10,
      relationship: 20,
      injurySeverity: 0,
    },
    month: { index: 0, year: 1, month: 3, actionsRemaining: 3, competition: 'practice' },
    record: {
      games: 0,
      wins: 0,
      losses: 0,
      plateAppearances: 0,
      hits: 0,
      homeRuns: 0,
      runsBattedIn: 0,
      inningsPitched: 0,
      strikeouts: 0,
      earnedRuns: 0,
    },
    schoolStanding: 50,
    lastAppliedCommandId: 0,
    lastTerminalEventId: null,
    appliedTerminalEventIds: [],
    resolvedGames: [],
    replayCheckpoint: null,
    eventHistory: [],
    scoutingReport: null,
    ...overrides,
  }
}

function expectCode(action: () => unknown, code: SaveRepositoryError['code']): void {
  expect(action).toThrowError(SaveRepositoryError)
  try {
    action()
  } catch (error) {
    expect((error as SaveRepositoryError).code).toBe(code)
  }
}

function serializedEnvelope(current: CareerSave, backup: CareerSave | null = null): string {
  const body = {
    schemaVersion: 3,
    current,
    backup,
    backupChecksum: backup === null ? null : stateHash(backup),
  }
  return JSON.stringify({ ...body, checksum: stateHash(body) })
}

function completedReplayCareer(): CareerSave {
  const started = startMatch(createMatch({ id: 'y1-m03-g1', seed: 42, innings: 1 })).state
  const decision = reduceMatch(started, {
    id: 1,
    tick: 1,
    type: 'gameplay/runner-decision',
    payload: { direction: 'hold', sprint: false, slide: false, outcome: { success: true, runs: 0, outs: 0, summary: 'Runner holds the base' } },
  }).state
  const match = simulateAiGame(decision).state
  const replay = createReplayBundle(match, 'test')
  const terminalIds = replay.events
    .filter((event) => event.type === 'match/scene-terminal' && typeof event.payload === 'object' && event.payload !== null && 'id' in event.payload)
    .map((event) => String((event.payload as { id: string }).id))
  const won = match.score.home > match.score.away
  return career({
    phase: 'postgame',
    record: { ...career().record, games: 1, wins: won ? 1 : 0, losses: won ? 0 : 1 },
    resolvedGames: [{ id: 'y1-m03-g1', won, performance: 75 }],
    lastAppliedCommandId: match.lastCommandId,
    lastTerminalEventId: terminalIds.at(-1) ?? null,
    appliedTerminalEventIds: terminalIds,
    replayCheckpoint: replay,
  })
}

describe('SaveRepository', () => {
  it('persists independently across exactly three typed slots', () => {
    const storage = new MemoryStorage()
    const repository = new SaveRepository(storage)

    repository.save(1, career({ player: { ...career().player, name: 'one' } }))
    repository.save(2, career({ player: { ...career().player, name: 'two' } }))
    repository.save(3, career({ player: { ...career().player, name: 'three' } }))

    expect(repository.load(1).current.player.name).toBe('one')
    expect(repository.load(2).current.player.name).toBe('two')
    expect(repository.load(3).current.player.name).toBe('three')
    expect(storage.length).toBe(3)
  })

  it('backs up the previous current save on autosave and preserves exact-once fields', () => {
    const repository = new SaveRepository(new MemoryStorage())
    const previous = career({ lastAppliedCommandId: 7, lastTerminalEventId: 'terminal-7', appliedTerminalEventIds: ['terminal-7'] })
    const next = career({ updatedAt: '2026-07-24T01:00:00.000Z', lastAppliedCommandId: 8, lastTerminalEventId: 'terminal-8', appliedTerminalEventIds: ['terminal-8'] })

    repository.save(1, previous)
    const envelope = repository.autosave(1, next)

    expect(envelope.current.lastAppliedCommandId).toBe(8)
    expect(envelope.current.lastTerminalEventId).toBe('terminal-8')
    expect(envelope.backup?.lastAppliedCommandId).toBe(7)
    expect(envelope.backupChecksum).toBe(stateHash(previous))
    expect(repository.load(1)).toEqual(envelope)
  })

  it('exports and imports a verified versioned envelope', () => {
    const source = new SaveRepository(new MemoryStorage())
    source.autosave(1, career({ player: { ...career().player, name: 'portable' }, lastAppliedCommandId: 11 }))
    const serialized = source.export(1)

    const target = new SaveRepository(new MemoryStorage())
    const imported = target.import(3, serialized)

    expect(imported.schemaVersion).toBe(3)
    expect(imported.current.player.name).toBe('portable')
    expect(target.export(3)).toBe(serialized)
  })

  it('rejects malformed, unsupported, corrupt, missing, and oversized saves', () => {
    const storage = new MemoryStorage()
    const repository = new SaveRepository(storage)

    expectCode(() => repository.import(1, '{broken'), 'malformed')
    expectCode(() => repository.import(1, JSON.stringify({ schemaVersion: 99 })), 'unsupported-version')
    expectCode(() => repository.load(1), 'missing-slot')

    repository.save(1, career())
    const corrupt = JSON.parse(repository.export(1)) as { current: { seed: number } }
    corrupt.current.seed = 99
    expectCode(() => repository.import(2, JSON.stringify(corrupt)), 'checksum-mismatch')

    const oversized = JSON.stringify({ schemaVersion: 3, padding: 'x'.repeat(MAX_SAVE_BYTES) })
    expectCode(() => repository.import(2, oversized), 'oversized')
  })

  it('migrates a checksummed v0 envelope and initializes exact-once fields', () => {
    const withoutExactOnce: Record<string, unknown> = { ...career(), schemaVersion: 0 }
    delete withoutExactOnce.lastAppliedCommandId
    delete withoutExactOnce.lastTerminalEventId
    delete withoutExactOnce.appliedTerminalEventIds
    delete withoutExactOnce.resolvedGames
    const body = { schemaVersion: 0, current: withoutExactOnce, backup: null }
    const legacy = JSON.stringify({ ...body, checksum: stateHash(body) })
    const repository = new SaveRepository(new MemoryStorage())

    const migrated = repository.import(1, legacy)

    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.current.schemaVersion).toBe(3)
    expect(migrated.current.lastAppliedCommandId).toBe(0)
    expect(migrated.current.lastTerminalEventId).toBeNull()
    expect(migrated.current.appliedTerminalEventIds).toEqual([])
    expect(migrated.current.resolvedGames).toEqual([])
    expect(repository.load(1)).toEqual(migrated)
  })

  it('keeps the previous slot when the primary commit fails and clears staging', () => {
    class FailingStorage extends MemoryStorage {
      failPrimary = false

      override setItem(key: string, value: string): void {
        if (this.failPrimary && key === 'diamond-road:save:1') throw new DOMException('full', 'QuotaExceededError')
        super.setItem(key, value)
      }
    }

    const storage = new FailingStorage()
    const repository = new SaveRepository(storage)
    repository.save(1, career({ player: { ...career().player, name: 'safe' } }))
    storage.failPrimary = true

    expectCode(() => repository.save(1, career({ player: { ...career().player, name: 'new-save' } })), 'quota-exceeded')
    expect(storage.getItem('diamond-road:save:1:pending')).toBeNull()
    expect(repository.load(1).current.player.name).toBe('safe')
  })

  it('recovers a valid staged write when the primary slot is absent', () => {
    const storage = new MemoryStorage()
    const repository = new SaveRepository(storage)
    repository.save(1, career({ player: { ...career().player, name: 'recover-me' } }))
    const committed = storage.getItem('diamond-road:save:1')
    storage.removeItem('diamond-road:save:1')
    storage.setItem('diamond-road:save:1:pending', committed as string)

    expect(repository.load(1).current.player.name).toBe('recover-me')
    expect(storage.getItem('diamond-road:save:1')).toBe(committed)
    expect(storage.getItem('diamond-road:save:1:pending')).toBeNull()
  })

  it('persists resolved results so a hydrated schedule still rejects a duplicate game', () => {
    const game = createCareerSchedule(42, 'seorin')[0]
    const resolved = career({
      record: { ...career().record, games: 1, wins: 1 },
      resolvedGames: [{ id: game.id, won: true, performance: 88 }],
    })
    const repository = new SaveRepository(new MemoryStorage())

    repository.autosave(1, resolved)
    const loaded = repository.load(1).current
    const hydrated = createCareerSchedule(loaded.seed, loaded.player.schoolId, loaded.resolvedGames)

    expect(hydrated.find((entry) => entry.id === game.id)).toMatchObject({ resolved: true, won: true, performance: 88 })
  })

  it('migrates v1 game records and terminal ids into v2 exact-once state', () => {
    const legacyCurrent: Record<string, unknown> = {
      ...career({
        record: { ...career().record, games: 1, wins: 1 },
        lastTerminalEventId: 'terminal-4',
        appliedTerminalEventIds: ['terminal-4'],
      }),
      schemaVersion: 1,
    }
    delete legacyCurrent.appliedTerminalEventIds
    delete legacyCurrent.resolvedGames
    const body = { schemaVersion: 1, current: legacyCurrent, backup: null }
    const repository = new SaveRepository(new MemoryStorage())

    const migrated = repository.import(1, JSON.stringify({ ...body, checksum: stateHash(body) }))

    expect(migrated.current.appliedTerminalEventIds).toEqual(['terminal-4'])
    expect(migrated.current.resolvedGames).toHaveLength(1)
    expect(migrated.current.resolvedGames[0]?.won).toBe(true)
  })

  it('strictly rejects invalid ranges, cross-fields, identities, and game ids', () => {
    const invalidSaves: CareerSave[] = [
      career({ month: { ...career().month, index: 36 } }),
      career({ month: { ...career().month, actionsRemaining: 4 } }),
      career({ player: { ...career().player, condition: 101 } }),
      career({ player: { ...career().player, ratings: { ...career().player.ratings, contact: -1 } } }),
      career({ player: { ...career().player, role: 'pitcher', position: 'SS' } }),
      career({ player: { ...career().player, schoolId: 'gwangjin' } }),
      career({ id: 'wrong-id' }),
      career({ record: { ...career().record, inningsPitched: Number.NaN } }),
      career({ phase: 'draft' }),
      career({ lastTerminalEventId: 'terminal-1', appliedTerminalEventIds: [] }),
      career({ player: { ...career().player, name: '' } }),
      career({ player: { ...career().player, name: ' trailing ' } }),
      career({ createdAt: 'not-a-date' }),
      career({ createdAt: '2026-07-25T00:00:00.000Z' }),
      career({ phase: 'creation', eventHistory: ['already-started'] }),
      career({ record: { ...career().record, games: 1, wins: 1 }, resolvedGames: [{ id: 'not-a-game', won: true, performance: 50 }] }),
    ]
    const repository = new SaveRepository(new MemoryStorage())

    invalidSaves.forEach((save) => expectCode(() => repository.save(1, save), 'malformed'))
  })

  it('explicitly restores a valid backup even when the current payload is corrupt', () => {
    const storage = new MemoryStorage()
    const repository = new SaveRepository(storage)
    repository.save(1, career({ player: { ...career().player, name: 'backup' } }))
    repository.autosave(1, career({ player: { ...career().player, name: 'current' } }))
    const corrupt = JSON.parse(storage.getItem('diamond-road:save:1') as string) as { current: { month: { index: number } } }
    corrupt.current.month.index = 99
    storage.setItem('diamond-road:save:1', JSON.stringify(corrupt))

    expect(repository.loadBackup(1).player.name).toBe('backup')
    const restored = repository.restoreBackup(1)

    expect(restored.current.player.name).toBe('backup')
    expect(restored.backup).toBeNull()
    expect(repository.load(1)).toEqual(restored)
  })

  it('rejects a modified embedded backup instead of re-signing it during restore', () => {
    const storage = new MemoryStorage()
    const repository = new SaveRepository(storage)
    repository.save(1, career({ player: { ...career().player, name: 'trusted' } }))
    repository.autosave(1, career({ player: { ...career().player, name: 'current' } }))
    const corrupt = JSON.parse(storage.getItem('diamond-road:save:1') as string) as {
      current: { month: { index: number } }
      backup: { player: { name: string } }
    }
    corrupt.current.month.index = 99
    corrupt.backup.player.name = 'attacker'
    storage.setItem('diamond-road:save:1', JSON.stringify(corrupt))

    expectCode(() => repository.loadBackup(1), 'checksum-mismatch')
    expectCode(() => repository.restoreBackup(1), 'checksum-mismatch')
  })

  it('normalizes a valid early-v2 envelope without an independent backup checksum', () => {
    const current = { ...career({ player: { ...career().player, name: 'old-v2' } }), schemaVersion: 2 }
    const backup = { ...career({ player: { ...career().player, name: 'old-backup' } }), schemaVersion: 2 }
    const body = { schemaVersion: 2, current, backup }
    const repository = new SaveRepository(new MemoryStorage())

    const migrated = repository.import(1, JSON.stringify({ ...body, checksum: stateHash(body) }))

    expect(migrated.schemaVersion).toBe(3)
    expect(migrated.current.schemaVersion).toBe(3)
    expect(migrated.backupChecksum).toBe(stateHash(migrated.backup))
    expect(repository.loadBackup(1).player.name).toBe('old-backup')
  })

  it('imports and loads a checksummed v2 export carrying a schema-v1 replay without initialCommandId', () => {
    const current = completedReplayCareer()
    const legacyReplay = { ...current.replayCheckpoint, schemaVersion: 1 } as Record<string, unknown>
    delete legacyReplay.initialCommandId
    const legacyCurrent = { ...current, schemaVersion: 2, replayCheckpoint: legacyReplay }
    const legacyBackup = { ...legacyCurrent, updatedAt: '2026-07-24T00:00:01.000Z' }
    const body = {
      schemaVersion: 2,
      current: legacyCurrent,
      backup: legacyBackup,
      backupChecksum: stateHash(legacyBackup),
    }
    const repository = new SaveRepository(new MemoryStorage())

    const imported = repository.import(2, JSON.stringify({ ...body, checksum: stateHash(body) }))

    expect(imported.schemaVersion).toBe(3)
    expect(imported.current.schemaVersion).toBe(3)
    expect(imported.current.replayCheckpoint?.schemaVersion).toBe(2)
    expect(imported.current.replayCheckpoint?.initialCommandId).toBe(0)
    expect(imported.backup?.replayCheckpoint?.schemaVersion).toBe(2)
    expect(repository.load(2)).toEqual(imported)
  })

  it('rejects replay hash and exact-once cross-field mismatches on import', () => {
    const valid = completedReplayCareer()
    const replay = valid.replayCheckpoint!
    const matchLastCommandId = valid.lastAppliedCommandId
    const intermediateEventIndex = replay.events.findIndex((event) => event.type === 'match/transitioned')
    const intermediateCheckpointIndex = replay.checkpoints.findIndex((_, index) => index > 0 && index < replay.checkpoints.length - 1)
    const ballCheckpointIndex = replay.checkpoints.findIndex((checkpoint) => checkpoint.ball !== undefined)
    expect(intermediateEventIndex).toBeGreaterThanOrEqual(0)
    expect(intermediateCheckpointIndex).toBeGreaterThanOrEqual(0)
    expect(ballCheckpointIndex).toBeGreaterThanOrEqual(0)
    const invalid = [
      { ...valid, lastAppliedCommandId: matchLastCommandId + 1 },
      { ...valid, appliedTerminalEventIds: ['y1-m03-g1:terminal:99'], lastTerminalEventId: 'y1-m03-g1:terminal:99' },
      { ...valid, replayCheckpoint: { ...replay, finalHash: 'not-a-hash' } },
      { ...valid, replayCheckpoint: { ...replay, checkpoints: [{ tick: 1, stateHash: 'deadbeef' }] } },
      {
        ...valid,
        replayCheckpoint: {
          ...replay,
          events: replay.events.map((event, index) => index === intermediateEventIndex
            ? { ...event, payload: { ...event.payload as object, from: 'tampered' } }
            : event),
        },
      },
      {
        ...valid,
        replayCheckpoint: {
          ...replay,
          checkpoints: replay.checkpoints.map((checkpoint, index) => index === intermediateCheckpointIndex
            ? { ...checkpoint, stateHash: 'deadbeef' }
            : checkpoint),
        },
      },
      {
        ...valid,
        replayCheckpoint: {
          ...replay,
          checkpoints: replay.checkpoints.map((checkpoint, index) => index === ballCheckpointIndex
            ? { ...checkpoint, ball: { ...checkpoint.ball!, position: { ...checkpoint.ball!.position, x: checkpoint.ball!.position.x + 0.000001 } } }
            : checkpoint),
        },
      },
      {
        ...valid,
        replayCheckpoint: {
          ...replay,
          commands: replay.commands.map((command, index) => index === 0 ? { ...command, payload: {} } : command),
        },
      },
      {
        ...valid,
        replayCheckpoint: {
          ...replay,
          commands: replay.commands.map((command) => command.type === 'gameplay/runner-decision' ? { ...command, payload: { ...(command.payload as object), outcome: { success: true, runs: 'bad', outs: 0, summary: 'invalid' } } } : command),
        },
      },
    ] as CareerSave[]
    const repository = new SaveRepository(new MemoryStorage())

    expect(repository.import(1, serializedEnvelope(valid)).current).toEqual(valid)
    invalid.forEach((save) => expectCode(() => repository.import(2, serializedEnvelope(save)), 'malformed'))
  })
})
