import { REPLAY_SCHEMA_VERSION, type ReplayBundle } from '../contracts/replay'
import type { CareerSave, SaveSlotEnvelope, SaveValidationError } from '../contracts/save'
import { SAVE_SCHEMA_VERSION } from '../contracts/save'
import { PLAYABLE_SCHOOLS } from '../content/schools'
import { calendarMonth, createCareerSchedule } from '../domain/career/schedule'
import { stateHash } from '../domain/core/hash'
import { replayMatch } from '../domain/match'

export const SAVE_SLOT_COUNT = 3 as const
export const MAX_SAVE_BYTES = 1024 * 1024

export type SaveSlot = 1 | 2 | 3

type EnvelopeBody = Omit<SaveSlotEnvelope, 'checksum'>
type EarlyCurrentEnvelopeBody = Omit<EnvelopeBody, 'backupChecksum'>

interface LegacyReplayBundle extends Omit<ReplayBundle, 'schemaVersion' | 'initialCommandId'> {
  schemaVersion: 1
  initialCommandId?: number
}

interface LegacyV2CareerSave extends Omit<CareerSave, 'schemaVersion' | 'replayCheckpoint'> {
  schemaVersion: 2
  replayCheckpoint: LegacyReplayBundle | ReplayBundle | null
}

interface LegacyCareerSave extends Omit<CareerSave, 'schemaVersion' | 'lastAppliedCommandId' | 'lastTerminalEventId' | 'appliedTerminalEventIds' | 'resolvedGames'> {
  schemaVersion: 0 | 1
  lastAppliedCommandId?: number
  lastTerminalEventId?: string | null
}

interface LegacyEnvelope {
  schemaVersion: 0 | 1
  current: LegacyCareerSave
  backup: LegacyCareerSave | null
  checksum: string
}

export class SaveRepositoryError extends Error {
  readonly code: SaveValidationError

  constructor(code: SaveValidationError, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SaveRepositoryError'
    this.code = code
  }
}

export interface SaveRepositoryOptions {
  keyPrefix?: string
  maxBytes?: number
}

export class SaveRepository {
  readonly #storage: Storage
  readonly #keyPrefix: string
  readonly #maxBytes: number

  constructor(storage: Storage, options: SaveRepositoryOptions = {}) {
    this.#storage = storage
    this.#keyPrefix = options.keyPrefix ?? 'diamond-road:save'
    this.#maxBytes = options.maxBytes ?? MAX_SAVE_BYTES
  }

  load(slot: SaveSlot): SaveSlotEnvelope {
    const key = this.#slotKey(slot)
    const raw = this.#storage.getItem(key)

    if (raw !== null) {
      try {
        const envelope = this.#decode(raw)
        this.#removeQuietly(this.#temporaryKey(slot))
        return envelope
      } catch (error) {
        const recovered = this.#recoverTemporary(slot)
        if (recovered) return recovered
        throw error
      }
    }

    const recovered = this.#recoverTemporary(slot)
    if (recovered) return recovered
    throw new SaveRepositoryError('missing-slot', `Save slot ${slot} is empty`)
  }

  save(slot: SaveSlot, current: CareerSave): SaveSlotEnvelope {
    const existing = this.#loadOptional(slot)
    return this.#write(slot, current, existing?.backup ?? null)
  }

  autosave(slot: SaveSlot, current: CareerSave): SaveSlotEnvelope {
    const existing = this.#loadOptional(slot)
    return this.#write(slot, current, existing?.current ?? null)
  }

  export(slot: SaveSlot): string {
    return this.#encode(this.load(slot))
  }

  import(slot: SaveSlot, serialized: string): SaveSlotEnvelope {
    const envelope = this.#decode(serialized)
    this.#commit(slot, this.#encode(envelope))
    return envelope
  }

  /** Loads only an independently authenticated backup without trusting the current payload. */
  loadBackup(slot: SaveSlot): CareerSave {
    const serialized = this.#storage.getItem(this.#slotKey(slot))
    if (serialized === null) throw new SaveRepositoryError('missing-slot', `Save slot ${slot} is empty`)
    this.#assertSize(serialized)
    const parsed = parseJson(serialized)
    if (!isRecord(parsed) || !Number.isInteger(parsed.schemaVersion)) malformed('Save envelope is malformed')

    if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION || !('backupChecksum' in parsed)) {
      const envelope = this.#decode(serialized)
      if (envelope.backup === null) throw new SaveRepositoryError('missing-slot', `Save slot ${slot} has no backup`)
      return envelope.backup
    }
    if (!isRecord(parsed.backup)) throw new SaveRepositoryError('missing-slot', `Save slot ${slot} has no backup`)
    if (typeof parsed.backupChecksum !== 'string' || saveChecksum(parsed.backup) !== parsed.backupChecksum) {
      throw new SaveRepositoryError('checksum-mismatch', 'Backup checksum does not match its contents')
    }
    assertCareerSave(parsed.backup)
    return parsed.backup
  }

  /** Replaces a corrupt current save only after independently authenticating its backup. */
  restoreBackup(slot: SaveSlot): SaveSlotEnvelope {
    return this.#write(slot, this.loadBackup(slot), null)
  }

  remove(slot: SaveSlot): void {
    this.#storage.removeItem(this.#slotKey(slot))
    this.#removeQuietly(this.#temporaryKey(slot))
  }

  #write(slot: SaveSlot, current: CareerSave, backup: CareerSave | null): SaveSlotEnvelope {
    assertCareerSave(current)
    if (backup !== null) assertCareerSave(backup)
    const body: EnvelopeBody = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      current,
      backup,
      backupChecksum: backup === null ? null : saveChecksum(backup),
    }
    const envelope: SaveSlotEnvelope = { ...body, checksum: checksum(body) }
    this.#commit(slot, this.#encode(envelope))
    return envelope
  }

  #loadOptional(slot: SaveSlot): SaveSlotEnvelope | null {
    try {
      return this.load(slot)
    } catch (error) {
      if (error instanceof SaveRepositoryError && error.code === 'missing-slot') return null
      throw error
    }
  }

  #commit(slot: SaveSlot, serialized: string): void {
    this.#assertSize(serialized)
    const temporaryKey = this.#temporaryKey(slot)
    try {
      this.#storage.setItem(temporaryKey, serialized)
      this.#storage.setItem(this.#slotKey(slot), serialized)
      this.#storage.removeItem(temporaryKey)
    } catch (error) {
      this.#removeQuietly(temporaryKey)
      if (isQuotaExceeded(error)) {
        throw new SaveRepositoryError('quota-exceeded', 'Storage quota was exceeded', { cause: error })
      }
      throw error
    }
  }

  #recoverTemporary(slot: SaveSlot): SaveSlotEnvelope | null {
    const temporaryKey = this.#temporaryKey(slot)
    const temporary = this.#storage.getItem(temporaryKey)
    if (temporary === null) return null

    try {
      const envelope = this.#decode(temporary)
      this.#storage.setItem(this.#slotKey(slot), this.#encode(envelope))
      this.#storage.removeItem(temporaryKey)
      return envelope
    } catch {
      this.#removeQuietly(temporaryKey)
      return null
    }
  }

  #decode(serialized: string): SaveSlotEnvelope {
    this.#assertSize(serialized)
    const parsed = parseJson(serialized)

    if (!isRecord(parsed) || !Number.isInteger(parsed.schemaVersion)) {
      throw new SaveRepositoryError('malformed', 'Save envelope is malformed')
    }
    if (parsed.schemaVersion === 0 || parsed.schemaVersion === 1) return migrateLegacyEnvelope(parsed)
    if (parsed.schemaVersion === 2) return migrateV2Envelope(parsed)
    if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION) {
      throw new SaveRepositoryError('unsupported-version', `Unsupported save version: ${String(parsed.schemaVersion)}`)
    }

    if (typeof parsed.checksum !== 'string') malformed('Save envelope is malformed')
    const hasBackupChecksum = 'backupChecksum' in parsed
    const body: EnvelopeBody | EarlyCurrentEnvelopeBody = hasBackupChecksum
      ? {
          schemaVersion: SAVE_SCHEMA_VERSION,
          current: parsed.current as CareerSave,
          backup: parsed.backup as CareerSave | null,
          backupChecksum: parsed.backupChecksum as string | null,
        }
      : {
          schemaVersion: SAVE_SCHEMA_VERSION,
          current: parsed.current as CareerSave,
          backup: parsed.backup as CareerSave | null,
        }
    if (checksum(body) !== parsed.checksum) {
      throw new SaveRepositoryError('checksum-mismatch', 'Save checksum does not match its contents')
    }
    const envelope: SaveSlotEnvelope = hasBackupChecksum
      ? parsed as unknown as SaveSlotEnvelope
      : {
          ...body,
          backupChecksum: body.backup === null ? null : saveChecksum(body.backup),
          checksum: '',
        } as SaveSlotEnvelope
    if (!hasBackupChecksum) envelope.checksum = checksum({
      schemaVersion: envelope.schemaVersion,
      current: envelope.current,
      backup: envelope.backup,
      backupChecksum: envelope.backupChecksum,
    })
    assertEnvelopeShape(envelope)
    return envelope
  }

  #encode(envelope: SaveSlotEnvelope): string {
    const serialized = JSON.stringify(envelope)
    this.#assertSize(serialized)
    return serialized
  }

  #assertSize(serialized: string): void {
    if (new TextEncoder().encode(serialized).byteLength > this.#maxBytes) {
      throw new SaveRepositoryError('oversized', `Save data exceeds ${this.#maxBytes} bytes`)
    }
  }

  #slotKey(slot: SaveSlot): string {
    if (!(SAVE_SLOTS as readonly number[]).includes(slot)) malformed(`Invalid save slot: ${String(slot)}`)
    return `${this.#keyPrefix}:${slot}`
  }

  #temporaryKey(slot: SaveSlot): string {
    return `${this.#slotKey(slot)}:pending`
  }

  #removeQuietly(key: string): void {
    try {
      this.#storage.removeItem(key)
    } catch {
      // Cleanup is best-effort; the committed slot remains authoritative.
    }
  }
}

function checksum(body: unknown): string {
  return stateHash(body)
}

function saveChecksum(save: CareerSave | Record<string, unknown>): string {
  return stateHash(save)
}

function migrateLegacyEnvelope(value: Record<string, unknown>): SaveSlotEnvelope {
  if (!isRecord(value.current) || !(value.backup === null || isRecord(value.backup)) || typeof value.checksum !== 'string') {
    throw new SaveRepositoryError('malformed', 'Legacy save envelope is malformed')
  }
  const legacy = value as unknown as LegacyEnvelope
  const legacyBody = { schemaVersion: legacy.schemaVersion, current: legacy.current, backup: legacy.backup }
  if (checksum(legacyBody) !== legacy.checksum) {
    throw new SaveRepositoryError('checksum-mismatch', 'Legacy save checksum does not match its contents')
  }

  const current = migrateLegacyCareer(legacy.current)
  const backup = legacy.backup === null ? null : migrateLegacyCareer(legacy.backup)
  assertCareerSave(current)
  if (backup !== null) assertCareerSave(backup)
  const body: EnvelopeBody = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    current,
    backup,
    backupChecksum: backup === null ? null : saveChecksum(backup),
  }
  return { ...body, checksum: checksum(body) }
}

function migrateV2Envelope(value: Record<string, unknown>): SaveSlotEnvelope {
  if (!isRecord(value.current) || !(value.backup === null || isRecord(value.backup)) || typeof value.checksum !== 'string') {
    throw new SaveRepositoryError('malformed', 'Version 2 save envelope is malformed')
  }
  const hasBackupChecksum = 'backupChecksum' in value
  const originalBody = hasBackupChecksum
    ? { schemaVersion: 2, current: value.current, backup: value.backup, backupChecksum: value.backupChecksum }
    : { schemaVersion: 2, current: value.current, backup: value.backup }
  if (checksum(originalBody) !== value.checksum) {
    throw new SaveRepositoryError('checksum-mismatch', 'Version 2 save checksum does not match its contents')
  }
  if (hasBackupChecksum) {
    if (value.backup === null) {
      if (value.backupChecksum !== null) malformed('backupChecksum must be null without a backup')
    } else if (typeof value.backupChecksum !== 'string' || saveChecksum(value.backup) !== value.backupChecksum) {
      throw new SaveRepositoryError('checksum-mismatch', 'Version 2 backup checksum does not match its contents')
    }
  }

  const current = migrateV2Career(value.current as unknown as LegacyV2CareerSave)
  const backup = value.backup === null ? null : migrateV2Career(value.backup as unknown as LegacyV2CareerSave)
  assertCareerSave(current)
  if (backup !== null) assertCareerSave(backup)
  const body: EnvelopeBody = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    current,
    backup,
    backupChecksum: backup === null ? null : saveChecksum(backup),
  }
  return { ...body, checksum: checksum(body) }
}

function migrateLegacyCareer(value: LegacyCareerSave): CareerSave {
  if (!isRecord(value)) malformed('Legacy career save is malformed')
  const lastTerminalEventId = value.lastTerminalEventId ?? null
  const resolvedGames = inferLegacyResolvedGames(value)
  return {
    ...value,
    schemaVersion: SAVE_SCHEMA_VERSION,
    lastAppliedCommandId: value.lastAppliedCommandId ?? 0,
    lastTerminalEventId,
    appliedTerminalEventIds: lastTerminalEventId === null ? [] : [lastTerminalEventId],
    resolvedGames,
    replayCheckpoint: migrateReplayBundle(value.replayCheckpoint),
  }
}

function migrateV2Career(value: LegacyV2CareerSave): CareerSave {
  if (!isRecord(value) || value.schemaVersion !== 2) malformed('Version 2 career save is malformed')
  return {
    ...value,
    schemaVersion: SAVE_SCHEMA_VERSION,
    replayCheckpoint: migrateReplayBundle(value.replayCheckpoint),
  }
}

function migrateReplayBundle(value: unknown): ReplayBundle | null {
  if (value === null) return null
  if (!isRecord(value)) malformed('Legacy replayCheckpoint is invalid')
  if (value.schemaVersion === 1) {
    const initialCommandId = Number.isInteger(value.initialCommandId) && (value.initialCommandId as number) >= 0
      ? value.initialCommandId as number
      : 0
    return { ...value, schemaVersion: REPLAY_SCHEMA_VERSION, initialCommandId } as unknown as ReplayBundle
  }
  if (value.schemaVersion === REPLAY_SCHEMA_VERSION) return value as unknown as ReplayBundle
  malformed('Legacy replayCheckpoint schemaVersion is unsupported')
}

function inferLegacyResolvedGames(value: LegacyCareerSave): CareerSave['resolvedGames'] {
  if (!isRecord(value.record) || !Number.isInteger(value.record.games) || !Number.isInteger(value.record.wins)) return []
  if (!isRecord(value.player) || typeof value.player.schoolId !== 'string' || !isRecord(value.month) || !Number.isInteger(value.month.index)) return []
  if (!isFiniteNumber(value.seed)) return []
  const games = createCareerSchedule(value.seed, value.player.schoolId)
    .filter((game) => game.monthIndex <= (value.month as { index: number }).index)
    .slice(0, value.record.games as number)
  return games.map((game, index) => ({ id: game.id, won: index < (value.record as { wins: number }).wins, performance: 50 }))
}

function assertEnvelopeShape(value: SaveSlotEnvelope): void {
  if (!isRecord(value) || typeof value.checksum !== 'string' || value.schemaVersion !== SAVE_SCHEMA_VERSION) {
    throw new SaveRepositoryError('malformed', 'Save envelope is malformed')
  }
  assertCareerSave(value.current)
  if (value.backup === null) {
    if (value.backupChecksum !== null) malformed('backupChecksum must be null without a backup')
  } else {
    if (typeof value.backupChecksum !== 'string' || saveChecksum(value.backup) !== value.backupChecksum) {
      throw new SaveRepositoryError('checksum-mismatch', 'Backup checksum does not match its contents')
    }
    assertCareerSave(value.backup)
  }
}

function assertCareerSave(value: unknown): asserts value is CareerSave {
  if (!isRecord(value)) malformed('Career save must be an object')
  if (value.schemaVersion !== SAVE_SCHEMA_VERSION) {
    if (typeof value.schemaVersion === 'number') {
      throw new SaveRepositoryError('unsupported-version', `Unsupported career save version: ${String(value.schemaVersion)}`)
    }
    malformed('Career save version is missing')
  }

  assertNonEmptyString(value.id, 'id')
  assertIsoDate(value.createdAt, 'createdAt')
  assertIsoDate(value.updatedAt, 'updatedAt')
  if (Date.parse(value.createdAt as string) > Date.parse(value.updatedAt as string)) malformed('createdAt cannot be after updatedAt')
  assertNonNegativeInteger(value.seed, 'seed')
  if (value.id !== `career-${(value.seed as number).toString(36)}`) malformed('id does not match the career seed')
  assertNumberRecord(value.rngState, ['career', 'schedule', 'match', 'ai'], 'rngState')
  assertOneOf(value.phase, ['creation', 'hub', 'action-resolution', 'pregame', 'in-game', 'postgame', 'draft', 'completed'], 'phase')
  assertPlayer(value.player)
  assertMonth(value.month)
  assertRecordStats(value.record)
  assertRange(value.schoolStanding, 0, 100, 'schoolStanding')
  assertNonNegativeInteger(value.lastAppliedCommandId, 'lastAppliedCommandId')
  if (!(value.lastTerminalEventId === null || typeof value.lastTerminalEventId === 'string')) malformed('lastTerminalEventId is invalid')
  assertTerminalEventIds(value.appliedTerminalEventIds, value.lastTerminalEventId)
  assertResolvedGames(value.resolvedGames, value as unknown as CareerSave)
  if (value.replayCheckpoint !== null && !isReplayBundle(value.replayCheckpoint)) malformed('replayCheckpoint is invalid')
  if (!Array.isArray(value.eventHistory) || !value.eventHistory.every((entry) => typeof entry === 'string' && entry.length > 0)) malformed('eventHistory is invalid')
  if (value.scoutingReport !== null && !isRecord(value.scoutingReport)) malformed('scoutingReport is invalid')
  if (isRecord(value.scoutingReport) && !isScoutingReport(value.scoutingReport)) malformed('scoutingReport is invalid')
  assertPhaseConsistency(value as unknown as CareerSave)
  assertReplayConsistency(value as unknown as CareerSave)
}

function assertPlayer(value: unknown): void {
  if (!isRecord(value)) malformed('player is invalid')
  for (const key of ['id', 'schoolId'] as const) assertNonEmptyString(value[key], `player.${key}`)
  assertNonEmptyString(value.name, 'player.name')
  if ((value.name as string).trim() !== value.name || (value.name as string).length > 12) malformed('player.name must be trimmed and at most 12 characters')
  assertOneOf(value.role, ['hitter', 'pitcher'], 'player.role')
  assertOneOf(value.position, ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'starter', 'reliever'], 'player.position')
  if (value.role === 'hitter' && (value.position === 'starter' || value.position === 'reliever')) malformed('player role and position are incoherent')
  if (value.role === 'pitcher' && value.position !== 'starter' && value.position !== 'reliever') malformed('player role and position are incoherent')
  if (!PLAYABLE_SCHOOLS.some((school) => school.id === value.schoolId)) malformed('player.schoolId must be a playable school')
  assertOneOf(value.year, [1, 2, 3], 'player.year')
  assertRangeRecord(value.ratings, ['contact', 'power', 'speed', 'fielding', 'stamina', 'velocity', 'command', 'movement'], 'player.ratings')
  for (const key of ['condition', 'morale', 'coachTrust', 'scouting', 'relationship'] as const) {
    assertRange(value[key], 0, 100, `player.${key}`)
  }
  assertOneOf(value.injurySeverity, [0, 1, 2, 3], 'player.injurySeverity')
}

function assertMonth(value: unknown): void {
  if (!isRecord(value)) malformed('month is invalid')
  assertIntegerRange(value.index, 0, 35, 'month.index')
  assertOneOf(value.year, [1, 2, 3], 'month.year')
  assertIntegerRange(value.month, 1, 12, 'month.month')
  assertIntegerRange(value.actionsRemaining, 0, 3, 'month.actionsRemaining')
  assertOneOf(value.competition, ['practice', 'spring', 'summer', 'autumn', 'offseason'], 'month.competition')
  const expected = calendarMonth(value.index as number, value.actionsRemaining as number)
  if (value.year !== expected.year || value.month !== expected.month || value.competition !== expected.competition) {
    malformed('month calendar fields are inconsistent')
  }
}

function assertRecordStats(value: unknown): void {
  if (!isRecord(value)) malformed('record is invalid')
  for (const key of ['games', 'wins', 'losses', 'plateAppearances', 'hits', 'homeRuns', 'runsBattedIn', 'strikeouts', 'earnedRuns'] as const) {
    assertNonNegativeInteger(value[key], `record.${key}`)
  }
  assertNonNegativeFinite(value.inningsPitched, 'record.inningsPitched')
  if ((value.wins as number) + (value.losses as number) !== value.games) malformed('record wins and losses must equal games')
  if ((value.hits as number) > (value.plateAppearances as number)) malformed('record hits cannot exceed plate appearances')
  if ((value.homeRuns as number) > (value.hits as number)) malformed('record home runs cannot exceed hits')
}

function assertTerminalEventIds(value: unknown, last: string | null): void {
  if (!Array.isArray(value) || !value.every((id) => typeof id === 'string' && id.length > 0)) malformed('appliedTerminalEventIds is invalid')
  if (new Set(value).size !== value.length) malformed('appliedTerminalEventIds contains duplicates')
  if (last === null ? value.length !== 0 : value.at(-1) !== last) malformed('lastTerminalEventId is inconsistent')
}

function assertResolvedGames(value: unknown, save: CareerSave): void {
  if (!Array.isArray(value)) malformed('resolvedGames is invalid')
  const scheduled = new Map(createCareerSchedule(save.seed, save.player.schoolId).map((game) => [game.id, game]))
  const ids = new Set<string>()
  let wins = 0
  for (const result of value) {
    if (!isRecord(result) || typeof result.id !== 'string' || typeof result.won !== 'boolean') malformed('resolvedGames entry is invalid')
    assertRange(result.performance, 0, 100, 'resolvedGames.performance')
    if (result.summary !== undefined) assertResolvedGameSummary(result.summary)
    if (ids.has(result.id)) malformed('resolvedGames contains duplicate ids')
    const game = scheduled.get(result.id)
    if (game === undefined || game.monthIndex > save.month.index) malformed('resolvedGames contains an invalid game id')
    ids.add(result.id)
    wins += result.won ? 1 : 0
  }
  if (value.length !== save.record.games || wins !== save.record.wins) malformed('resolvedGames does not match the career record')
}

function assertResolvedGameSummary(value: unknown): void {
  if (!isRecord(value) || !isRecord(value.score)) malformed('resolvedGames.summary is invalid')
  assertNonNegativeInteger(value.score.away, 'resolvedGames.summary.score.away')
  assertNonNegativeInteger(value.score.home, 'resolvedGames.summary.score.home')
  if (!isStateHash(value.replayHash) || typeof value.terminalId !== 'string' || value.terminalId.length === 0) malformed('resolvedGames.summary replay identity is invalid')
  for (const key of ['plateAppearances', 'hits', 'homeRuns', 'runsBattedIn', 'strikeouts', 'earnedRuns'] as const) {
    if (value[key] !== undefined) assertNonNegativeInteger(value[key], `resolvedGames.summary.${key}`)
  }
  if (value.inningsPitched !== undefined) assertNonNegativeFinite(value.inningsPitched, 'resolvedGames.summary.inningsPitched')
}

function assertPhaseConsistency(save: CareerSave): void {
  if (save.player.id !== `player-${save.seed.toString(36)}`) malformed('player.id does not match the career seed')
  if (save.player.year !== save.month.year) malformed('player year does not match the calendar')
  if (save.phase === 'creation') {
    if (save.month.index !== 0 || save.month.actionsRemaining !== 3) malformed('creation phase is inconsistent with the calendar')
    if (save.record.games !== 0 || save.resolvedGames.length !== 0 || save.lastAppliedCommandId !== 0 || save.appliedTerminalEventIds.length !== 0) {
      malformed('creation phase cannot contain gameplay progress')
    }
    if (save.replayCheckpoint !== null || save.scoutingReport !== null || save.eventHistory.length !== 0) malformed('creation phase contains completed career state')
  }
  if ((save.phase === 'draft' || save.phase === 'completed') && (save.month.index !== 35 || save.month.actionsRemaining !== 0)) {
    malformed('terminal career phase is inconsistent with the calendar')
  }
}

function assertReplayConsistency(save: CareerSave): void {
  const replay = save.replayCheckpoint
  if (replay === null) return
  if (replay.schemaVersion !== REPLAY_SCHEMA_VERSION) malformed('replayCheckpoint schemaVersion is unsupported')
  const commandIds = replay.commands.map((command) => command.id)
  if (new Set(commandIds).size !== commandIds.length || commandIds.some((id) => id <= 0)) malformed('replayCheckpoint command ids are invalid')
  const replayLastCommandId = commandIds.at(-1) ?? replay.initialCommandId
  if (replayLastCommandId !== save.lastAppliedCommandId) malformed('lastAppliedCommandId does not match replayCheckpoint')
  const eventIds = replay.events.map((event) => event.id)
  if (new Set(eventIds).size !== eventIds.length) malformed('replayCheckpoint event ids are duplicated')
  if (save.phase === 'postgame') {
    const terminalIds = replay.events
      .filter((event) => event.type === 'match/scene-terminal' && isRecord(event.payload) && typeof event.payload.id === 'string')
      .map((event) => (event.payload as { id: string }).id)
    const applied = save.appliedTerminalEventIds.slice(-terminalIds.length)
    if (terminalIds.length === 0 || applied.length !== terminalIds.length || !terminalIds.every((id, index) => applied[index] === id)) {
      malformed('appliedTerminalEventIds do not match replayCheckpoint terminals')
    }
    const resolvedId = save.resolvedGames.at(-1)?.id
    if (!resolvedId || applied.some((id) => !id.startsWith(`${resolvedId}:terminal:`))) malformed('appliedTerminalEventIds do not belong to the resolved game')
  }
  if (replay.checkpoints.length === 0 || replay.checkpoints.at(-1)?.stateHash !== replay.finalHash) malformed('replayCheckpoint final hash is inconsistent')

  const gameId = replayGameId(save)
  if (gameId === null) malformed('replayCheckpoint does not belong to a career game')
  try {
    replayMatch({ id: gameId, seed: replay.seeds.career, innings: 1, playerTeam: 'home' }, replay)
  } catch (error) {
    throw new SaveRepositoryError('malformed', 'replayCheckpoint cannot be reconstructed', { cause: error })
  }
}

function replayGameId(save: CareerSave): string | null {
  const resolvedId = save.resolvedGames.at(-1)?.id
  if (resolvedId !== undefined) return resolvedId

  const terminal = save.replayCheckpoint?.events.find(
    (event) => event.type === 'match/scene-terminal' && isRecord(event.payload) && typeof event.payload.id === 'string',
  )
  if (terminal !== undefined && isRecord(terminal.payload) && typeof terminal.payload.id === 'string') {
    return terminal.payload.id.split(':terminal:')[0] ?? null
  }

  const resolvedIds = new Set(save.resolvedGames.map((game) => game.id))
  return createCareerSchedule(save.seed, save.player.schoolId)
    .find((game) => game.monthIndex === save.month.index && !resolvedIds.has(game.id))?.id ?? null
}

function isScoutingReport(value: Record<string, unknown>): boolean {
  return (
    isFiniteNumber(value.overall) &&
    (value.projectedRound === null || isFiniteNumber(value.projectedRound)) &&
    typeof value.headline === 'string' &&
    Array.isArray(value.strengths) &&
    value.strengths.every((entry) => typeof entry === 'string') &&
    Array.isArray(value.development) &&
    value.development.every((entry) => typeof entry === 'string')
  )
}

function isReplayBundle(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.buildVersion === 'string' && value.buildVersion.length > 0 &&
    value.schemaVersion === REPLAY_SCHEMA_VERSION &&
    Number.isInteger(value.initialCommandId) && (value.initialCommandId as number) >= 0 &&
    isNumberRecord(value.seeds, ['career', 'schedule', 'match', 'ai']) &&
    Array.isArray(value.commands) &&
    value.commands.every(isReplayCommand) &&
    Array.isArray(value.events) &&
    value.events.every(isReplayEvent) &&
    Array.isArray(value.checkpoints) &&
    value.checkpoints.every(isReplayCheckpoint) &&
    isStateHash(value.finalHash)
  )
}

function isReplayCommand(value: unknown): boolean {
  if (!isRecord(value) || !Number.isInteger(value.id) || !Number.isInteger(value.tick) || (value.tick as number) < 0 || !isRecord(value.payload)) return false
  const payload = value.payload
  if (value.type === 'gameplay/pause' || value.type === 'gameplay/resume') return Object.keys(payload).length === 0
  if (value.type === 'gameplay/swing') {
    return isOneOf(payload.swingType, ['normal', 'contact', 'power']) && isAim(payload.aim) && isFiniteNumber(payload.timingSeconds)
  }
  if (value.type === 'gameplay/pitch') {
    return isOneOf(payload.pitchType, ['four-seam', 'two-seam', 'changeup', 'slider', 'curveball']) && isAim(payload.target) && isUnit(payload.gestureAccuracy) && isUnit(payload.releaseAccuracy)
  }
  if (value.type === 'gameplay/move-fielder') {
    return isOneOf(payload.mode, ['catcher', 'infield', 'outfield']) && isFiniteNumber(payload.x) && isFiniteNumber(payload.z) && typeof payload.sprint === 'boolean' && (payload.outcome === undefined || isDecisionOutcome(payload.outcome))
  }
  if (value.type === 'gameplay/throw-base') return [1, 2, 3, 4].includes(payload.base as number) && isUnit(payload.accuracy) && (payload.outcome === undefined || isDecisionOutcome(payload.outcome))
  if (value.type === 'gameplay/runner-decision') return isOneOf(payload.direction, ['advance', 'retreat', 'hold']) && typeof payload.sprint === 'boolean' && typeof payload.slide === 'boolean' && (payload.outcome === undefined || isDecisionOutcome(payload.outcome))
  return false
}

function isDecisionOutcome(value: unknown): boolean {
  return isRecord(value) && typeof value.success === 'boolean' && isFiniteNumber(value.runs) && Number.isInteger(value.runs) && value.runs >= 0 && isFiniteNumber(value.outs) && Number.isInteger(value.outs) && value.outs >= 0 && typeof value.summary === 'string' && value.summary.length > 0
}

function isAim(value: unknown): boolean {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y) && Math.abs(value.x) <= 2 && Math.abs(value.y) <= 2
}

function isUnit(value: unknown): boolean {
  return isFiniteNumber(value) && value >= 0 && value <= 1
}

function isOneOf<T>(value: unknown, values: readonly T[]): value is T {
  return values.includes(value as T)
}

function isReplayEvent(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0 && Number.isInteger(value.tick) && (value.tick as number) >= 0 && typeof value.type === 'string' && value.type.length > 0 && 'payload' in value
}

function isReplayCheckpoint(value: unknown): boolean {
  if (!isRecord(value) || !Number.isInteger(value.tick) || (value.tick as number) < 0 || !isStateHash(value.stateHash)) return false
  return value.ball === undefined || isBallState(value.ball)
}

function isStateHash(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}$/.test(value)
}

function isBallState(value: unknown): boolean {
  return (
    isRecord(value) &&
    isVector(value.position) &&
    isVector(value.velocity) &&
    isVector(value.spin) &&
    Number.isInteger(value.tick)
  )
}

function isVector(value: unknown): boolean {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y) && isFiniteNumber(value.z)
}

function assertNumberRecord(value: unknown, keys: readonly string[], label: string): void {
  if (!isNumberRecord(value, keys)) malformed(`${label} is invalid`)
}

function assertRangeRecord(value: unknown, keys: readonly string[], label: string): void {
  if (!isRecord(value)) malformed(`${label} is invalid`)
  for (const key of keys) assertRange(value[key], 0, 100, `${label}.${key}`)
}

function isNumberRecord(value: unknown, keys: readonly string[]): boolean {
  return isRecord(value) && keys.every((key) => isFiniteNumber(value[key]))
}

function assertNonEmptyString(value: unknown, label: string): void {
  if (typeof value !== 'string' || value.length === 0) malformed(`${label} must be a non-empty string`)
}

function assertIsoDate(value: unknown, label: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    malformed(`${label} must be an ISO timestamp`)
  }
}

function assertRange(value: unknown, min: number, max: number, label: string): void {
  if (!isFiniteNumber(value) || value < min || value > max) malformed(`${label} must be between ${min} and ${max}`)
}

function assertIntegerRange(value: unknown, min: number, max: number, label: string): void {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) malformed(`${label} must be an integer between ${min} and ${max}`)
}

function assertNonNegativeFinite(value: unknown, label: string): void {
  if (!isFiniteNumber(value) || value < 0) malformed(`${label} must be a non-negative finite number`)
}

function assertNonNegativeInteger(value: unknown, label: string): void {
  if (!Number.isInteger(value) || (value as number) < 0) malformed(`${label} must be a non-negative integer`)
}

function assertOneOf<T>(value: unknown, allowed: readonly T[], label: string): void {
  if (!allowed.includes(value as T)) malformed(`${label} is invalid`)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJson(serialized: string): unknown {
  try {
    return JSON.parse(serialized)
  } catch (error) {
    throw new SaveRepositoryError('malformed', 'Save data is not valid JSON', { cause: error })
  }
}

function malformed(message: string): never {
  throw new SaveRepositoryError('malformed', message)
}

function isQuotaExceeded(error: unknown): boolean {
  if (!isRecord(error) && !(error instanceof Error)) return false
  const code = 'code' in error ? error.code : undefined
  return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014
}

const SAVE_SLOTS = [1, 2, 3] as const
