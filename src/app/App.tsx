import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useUiStore, type UiPlayer } from './ui-store'
import { applyCareerEventChoice, createCareer, chooseCareerAction, advanceCareerMonth, enterDraft, recordScheduledGame, resolveIneligibleMonthGames, resolveIneligibleScheduledGame, type CareerAction, type CareerSimulation, type GamePerformance } from '../domain/career'
import { MAX_SAVE_BYTES, SaveRepository, SaveRepositoryError, type SaveSlot } from '../persistence'
import { canTransition, CAREER_TRANSITIONS, type CareerPhase, type SceneTerminalResult } from '../contracts'
import { createMatch, createReplayBundle, replayMatch, simulateAiHalfInning, startMatch, type MatchConfig, type MatchState } from '../domain/match'
import { stateHash } from '../domain/core/hash'
import { hydrateCareer } from './career-session'
import { CareerHub } from '../ui/CareerHub'
import { getSchool } from '../content'
import { CreationScreen } from '../ui/CreationScreen'
import { DraftScreen, ResultScreen, type CareerGameSummary } from '../ui/ResultScreens'
import type { GameSceneResult } from '../ui/GameScene'
import { TitleScreen } from '../ui/TitleScreen'
import { RecordsScreen, SavesScreen, SettingsScreen, type SaveSlotSummary } from '../ui/UtilityScreens'

const GameScene = lazy(() => import('../ui/GameScene').then((module) => ({ default: module.GameScene })))

function screenForPhase(phase: CareerPhase): 'hub' | 'game' | 'result' | 'draft' {
  if (phase === 'draft' || phase === 'completed') return 'draft'
  if (phase === 'pregame' || phase === 'in-game') return 'game'
  if (phase === 'postgame') return 'result'
  return 'hub'
}

export function performanceFromGameplay(role: UiPlayer['role'], result: GameSceneResult): GamePerformance {
  const won = result.matchState.score.home > result.matchState.score.away
  if (role === 'hitter') {
    const plateAppearances = result.completedScenes.filter((scene) => scene.scene === 'batting')
    const hitResults = new Set(['single', 'double', 'triple', 'home-run'])
    return {
      won,
      performance: result.performance,
      plateAppearances: plateAppearances.length,
      hits: plateAppearances.filter((scene) => hitResults.has(scene.summary)).length,
      homeRuns: plateAppearances.filter((scene) => scene.summary === 'home-run').length,
      runsBattedIn: plateAppearances.reduce((total, scene) => total + scene.runs, 0),
    }
  }
  const pitching = result.completedScenes.filter((scene) => scene.scene === 'pitching')
  const outs = pitching.reduce((total, scene) => total + scene.outs, 0)
  return {
    won,
    performance: result.performance,
    inningsPitched: Math.floor(outs / 3) + (outs % 3) / 10,
    strikeouts: pitching.filter((scene) => scene.summary === 'strikeout').length,
    earnedRuns: pitching.reduce((total, scene) => total + scene.runs, 0),
  }
}

function transitionCareer(career: CareerSimulation, phase: CareerPhase): CareerSimulation {
  if (!canTransition(CAREER_TRANSITIONS, career.save.phase, phase)) throw new Error(`Illegal career transition: ${career.save.phase} -> ${phase}`)
  return { ...career, save: { ...career.save, phase } }
}

function matchConfig(career: CareerSimulation, gameId: string): MatchConfig {
  return { id: gameId, seed: Number.parseInt(stateHash({ seed: career.save.seed, gameId }), 16), initialCommandId: career.save.lastAppliedCommandId, innings: 1, playerTeam: 'home' as const }
}

export function createCareerMatch(career: CareerSimulation, gameId: string): MatchState {
  const started = startMatch(createMatch(matchConfig(career, gameId))).state
  return career.save.player.role === 'hitter' ? simulateAiHalfInning(started).state : started
}

export function restoreCareerMatch(career: CareerSimulation, gameId: string): MatchState {
  if (!career.save.replayCheckpoint) throw new Error('Career has no match checkpoint')
  return replayMatch(matchConfig(career, gameId), career.save.replayCheckpoint)
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function readCareer(repository: SaveRepository, slot: SaveSlot = 1): { career: CareerSimulation | null; error: string | null } {
  try {
    return { career: hydrateCareer(repository.load(slot).current), error: null }
  } catch (error) {
    if (error instanceof SaveRepositoryError && error.code === 'missing-slot') return { career: null, error: null }
    return { career: null, error: errorMessage(error, '세이브 검증에 실패했습니다.') }
  }
}

function readSlotSummary(repository: SaveRepository, slot: SaveSlot): SaveSlotSummary {
  try {
    const envelope = repository.load(slot)
    return { slot, save: envelope.current, backup: envelope.backup }
  } catch (error) {
    if (error instanceof SaveRepositoryError && error.code === 'missing-slot') {
      return { slot, save: null, backup: null }
    }
    const message = errorMessage(error, '검증 실패')
    try {
      return { slot, save: null, backup: repository.loadBackup(slot), error: message }
    } catch {
      return { slot, save: null, backup: null, error: message }
    }
  }
}

export function App() {
  const { screen, player, settings, setScreen, updatePlayer, updateSettings } = useUiStore()
  const repository = useMemo(() => new SaveRepository(localStorage), [])
  const initialCareer = useMemo(() => readCareer(repository), [repository])
  const [activeSlot, setActiveSlot] = useState<SaveSlot>(1)
  const [career, setCareer] = useState<CareerSimulation | null>(initialCareer.career)
  const [saveRevision, setSaveRevision] = useState(0)
  const [importSuccess, setImportSuccess] = useState(false)
  const [lastGame, setLastGame] = useState<CareerGameSummary | null>(null)
  const [saveError, setSaveError] = useState<string | null>(initialCareer.error)
  useEffect(() => {
    const onEnter = (event: KeyboardEvent) => { if (event.key === 'Enter' && screen === 'title' && career) setScreen(screenForPhase(career.save.phase)) }
    window.addEventListener('keydown', onEnter)
    return () => window.removeEventListener('keydown', onEnter)
  }, [career, screen, setScreen])
  const persist = (value: CareerSimulation): boolean => {
    try {
      repository.autosave(activeSlot, { ...value.save, updatedAt: new Date().toISOString() })
      setCareer(value)
      setSaveRevision((revision) => revision + 1)
      setSaveError(null)
      return true
    } catch (error) {
      setSaveError(error instanceof SaveRepositoryError ? error.message : '저장할 수 없습니다.')
      return false
    }
  }
  useEffect(() => {
    if (career?.save.phase !== 'pregame') return
    try {
      persist(transitionCareer(career, 'in-game'))
    } catch (error) {
      setSaveError(errorMessage(error, '경기 체크포인트를 재개할 수 없습니다.'))
    }
  }, [career?.save.phase])
  useEffect(() => {
    if (career?.save.phase === 'draft') persist(enterDraft(career).career)
  }, [career?.save.phase])
  const startCareer = () => {
    const value = createCareer({
      seed: Date.now() >>> 0,
      name: player.name.trim(),
      schoolId: player.schoolId,
      role: player.role,
      position: player.position,
      archetypeId: player.role === 'hitter' ? 'field-general' : 'power-ace',
    })
    if (persist(value)) setScreen('hub')
  }
  const takeAction = (action: CareerAction) => {
    if (!career || career.save.month.actionsRemaining === 0) return
    persist(chooseCareerAction(career, action))
  }
  const chooseEvent = (eventId: string, choiceId: string) => {
    if (!career) return
    try {
      persist(applyCareerEventChoice(career, eventId, choiceId))
    } catch (error) {
      setSaveError(errorMessage(error, '이벤트 선택을 적용할 수 없습니다.'))
    }
  }
  const advanceMonth = () => {
    if (!career) return
    if (career.save.month.actionsRemaining !== 0) {
      setSaveError('이달의 행동 세 번을 직접 선택해야 다음 달로 진행할 수 있습니다.')
      return
    }
    let source = career
    if (source.progress.lineupStatus === 'ineligible') {
      const resolved = resolveIneligibleMonthGames(source)
      if (!persist(resolved)) return
      source = resolved
    }
    const unresolvedGame = source.schedule.find((game) => game.monthIndex === source.save.month.index && !game.resolved)
    if (unresolvedGame) {
      setSaveError('이번 달 예정 경기를 완료해야 다음 달로 진행할 수 있습니다.')
      return
    }
    let value = advanceCareerMonth(source)
    if (value.save.phase === 'draft') value = enterDraft(value).career
    if (persist(value) && value.save.phase === 'completed') setScreen('draft')
  }
  const exportCareer = () => {
    if (!career) return
    const url = URL.createObjectURL(new Blob([repository.export(activeSlot)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'diamond-road-save.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const importCareer = async (file: File) => {
    try {
      if (file.size > MAX_SAVE_BYTES) throw new SaveRepositoryError('oversized', `Save data exceeds ${MAX_SAVE_BYTES} bytes`)
      const envelope = repository.import(activeSlot, await file.text())
      const restored = hydrateCareer(envelope.current)
      setCareer(restored)
      updatePlayer({ name: restored.save.player.name, role: restored.save.player.role, position: restored.save.player.position, schoolId: restored.save.player.schoolId })
      setImportSuccess(true)
      setSaveRevision((revision) => revision + 1)
      setSaveError(null)
      setScreen(screenForPhase(restored.save.phase))
    } catch (error) {
      setImportSuccess(false)
      setSaveError(errorMessage(error, '가져온 세이브를 검증할 수 없습니다.'))
    }
  }
  const beginGame = () => {
    if (!career || career.save.phase !== 'hub') return
    const nextGame = career.schedule.find((game) => game.monthIndex === career.save.month.index && !game.resolved)
    if (!nextGame) {
      setSaveError('시작할 예정 경기가 없습니다.')
      return
    }
    if (career.progress.lineupStatus === 'ineligible') {
      if (persist(resolveIneligibleScheduledGame(career, nextGame.id))) setSaveError('학업 출전 자격 미달로 이번 경기는 벤치 처리되었습니다.')
      return
    }
    try {
      const matchState = createCareerMatch(career, nextGame.id)
      const actionResolution = transitionCareer(career, 'action-resolution')
      if (!persist(actionResolution)) return
      const pregame = transitionCareer(actionResolution, 'pregame')
      const withPregameCheckpoint = {
        ...pregame,
        save: {
          ...pregame.save,
          lastAppliedCommandId: matchState.lastCommandId,
          rngState: { ...pregame.save.rngState, match: matchState.rng.match.state, ai: matchState.rng.ai.state },
          replayCheckpoint: createReplayBundle(matchState, 'career-match-v1'),
        },
      }
      if (!persist(withPregameCheckpoint)) return
      const inGame = transitionCareer(withPregameCheckpoint, 'in-game')
      if (persist(inGame)) setScreen('game')
    } catch (error) {
      setSaveError(errorMessage(error, '경기를 시작할 수 없습니다.'))
    }
  }
  const checkpointMatch = (state: MatchState): boolean => {
    if (!career || career.save.phase !== 'in-game') return false
    const checkpointed: CareerSimulation = {
      ...career,
      save: {
        ...career.save,
        rngState: { ...career.save.rngState, match: state.rng.match.state, ai: state.rng.ai.state },
        lastAppliedCommandId: state.lastCommandId,
        replayCheckpoint: createReplayBundle(state, 'career-match-v1'),
      },
    }
    return persist(checkpointed)
  }
  const finishGame = (result: GameSceneResult) => {
    if (!career) return
    const nextGame = career.schedule.find((game) => game.monthIndex === career.save.month.index && !game.resolved)
    if (!nextGame) {
      setSaveError('기록할 예정 경기가 없습니다.')
      setScreen('hub')
      return
    }
    const performance = performanceFromGameplay(career.save.player.role, result)
    if (result.matchState.phase !== 'terminal') {
      setSaveError('권위 경기 상태가 종료되지 않았습니다.')
      return
    }
    const terminalEventIds = result.matchState.terminalIds
    const alreadyApplied = terminalEventIds.some((id) => career.save.appliedTerminalEventIds.includes(id))
    if (alreadyApplied) {
      setSaveError('이미 반영된 경기 결과입니다.')
      setScreen('hub')
      return
    }
    const recorded = recordScheduledGame(career, nextGame.id, performance)
    const postgame = transitionCareer(recorded, 'postgame')
    const persistedSummary = {
      score: result.matchState.score,
      replayHash: result.replay.finalHash,
      terminalId: terminalEventIds.at(-1) ?? result.terminal.id,
      plateAppearances: performance.plateAppearances,
      hits: performance.hits,
      homeRuns: performance.homeRuns,
      runsBattedIn: performance.runsBattedIn,
      inningsPitched: performance.inningsPitched,
      strikeouts: performance.strikeouts,
      earnedRuns: performance.earnedRuns,
    }
    const completed: CareerSimulation = {
      ...postgame,
      save: {
        ...postgame.save,
        resolvedGames: postgame.save.resolvedGames.map((game) => game.id === nextGame.id ? { ...game, summary: persistedSummary } : game),
        lastAppliedCommandId: result.matchState.lastCommandId,
        lastTerminalEventId: terminalEventIds.at(-1) ?? null,
        appliedTerminalEventIds: [...career.save.appliedTerminalEventIds, ...terminalEventIds],
        replayCheckpoint: result.replay,
      },
    }
    if (!persist(completed)) return
    setLastGame({ opponentName: getSchool(nextGame.opponentId).name, performance, score: result.matchState.score, replayHash: result.replay.finalHash, terminalId: terminalEventIds.at(-1) ?? result.terminal.id })
    setScreen('result')
  }
  const returnFromResult = () => {
    if (!career || career.save.phase !== 'postgame') return
    try {
      const hub = transitionCareer(career, 'hub')
      if (persist(hub)) setScreen('hub')
    } catch (error) {
      setSaveError(errorMessage(error, '경기 결과를 마칠 수 없습니다.'))
    }
  }
  const currentPlayer: UiPlayer = career ? { name: career.save.player.name, role: career.save.player.role, position: career.save.player.position, schoolId: career.save.player.schoolId } : player
  const slots = useMemo<readonly SaveSlotSummary[]>(
    () => ([1, 2, 3] as const).map((slot) => readSlotSummary(repository, slot)),
    [repository, saveRevision],
  )
  const beginNew = () => {
    const empty = slots.find((entry) => !entry.save && !entry.error)
    if (!empty) {
      setScreen('saves')
      setSaveError('저장 슬롯이 모두 찼습니다. 덮어쓸 슬롯을 직접 선택하세요.')
      return
    }
    setActiveSlot(empty.slot)
    setScreen('creation')
  }
  const selectSlot = (slot: 1 | 2 | 3, exists: boolean) => {
    setActiveSlot(slot)
    if (exists) {
      const restored = hydrateCareer(repository.load(slot).current)
      setCareer(restored)
      updatePlayer({ name: restored.save.player.name, role: restored.save.player.role, position: restored.save.player.position, schoolId: restored.save.player.schoolId })
      setScreen(screenForPhase(restored.save.phase))
    } else setScreen('creation')
  }
  const overwriteSlot = (slot: 1 | 2 | 3) => {
    setActiveSlot(slot)
    setSaveError(null)
    setScreen('creation')
  }
  const deleteSlot = (slot: 1 | 2 | 3) => {
    repository.remove(slot)
    if (slot === activeSlot) setCareer(null)
    setSaveRevision((revision) => revision + 1)
    setSaveError(null)
  }
  const restoreSlot = (slot: 1 | 2 | 3) => {
    try {
      const envelope = repository.restoreBackup(slot)
      const restored = hydrateCareer(envelope.current)
      setActiveSlot(slot)
      setCareer(restored)
      updatePlayer({ name: restored.save.player.name, role: restored.save.player.role, position: restored.save.player.position, schoolId: restored.save.player.schoolId })
      setSaveRevision((revision) => revision + 1)
      setSaveError(null)
      setScreen(screenForPhase(restored.save.phase))
    } catch (error) {
      setSaveError(errorMessage(error, '백업을 복원할 수 없습니다.'))
    }
  }
  const activeGame = useMemo(() => {
    if (!career || (career.save.phase !== 'pregame' && career.save.phase !== 'in-game')) return null
    const game = career.schedule.find((entry) => entry.monthIndex === career.save.month.index && !entry.resolved)
    if (!game || !career.save.replayCheckpoint) return null
    try {
      return restoreCareerMatch(career, game.id)
    } catch {
      return null
    }
  }, [career])
  const recoveredLastGame = useMemo<CareerGameSummary | null>(() => {
    if (!career || career.save.phase !== 'postgame' || !career.save.replayCheckpoint) return null
    const resolved = career.save.resolvedGames.at(-1)
    const scheduled = resolved ? career.schedule.find((game) => game.id === resolved.id) : undefined
    if (!resolved || !scheduled) return null
    if (resolved.summary) {
      const summary = resolved.summary
      const performance: GamePerformance = career.save.player.role === 'hitter'
        ? { won: resolved.won, performance: resolved.performance, plateAppearances: summary.plateAppearances, hits: summary.hits, homeRuns: summary.homeRuns, runsBattedIn: summary.runsBattedIn }
        : { won: resolved.won, performance: resolved.performance, inningsPitched: summary.inningsPitched, strikeouts: summary.strikeouts, earnedRuns: summary.earnedRuns }
      return { opponentName: getSchool(scheduled.opponentId).name, performance, score: summary.score, replayHash: summary.replayHash, terminalId: summary.terminalId }
    }
    try {
      const state = restoreCareerMatch(career, resolved.id)
      const replayEvent = state.replay.events.find((event) => event.id === career.save.lastTerminalEventId)
      const terminal = replayEvent?.type === 'match/scene-terminal' ? replayEvent.payload as SceneTerminalResult : undefined
      const performance: GamePerformance = career.save.player.role === 'hitter'
        ? { won: resolved.won, performance: resolved.performance, plateAppearances: terminal ? 1 : 0, hits: terminal?.success ? 1 : 0, homeRuns: terminal?.summary === 'home-run' ? 1 : 0, runsBattedIn: terminal?.runs ?? 0 }
        : { won: resolved.won, performance: resolved.performance, inningsPitched: Math.floor((terminal?.outs ?? 0) / 3) + ((terminal?.outs ?? 0) % 3) / 10, strikeouts: terminal?.summary === 'strikeout' ? 1 : 0, earnedRuns: terminal?.runs ?? 0 }
      return { opponentName: getSchool(scheduled.opponentId).name, performance, score: state.score, replayHash: career.save.replayCheckpoint.finalHash, terminalId: terminal?.id ?? career.save.lastTerminalEventId ?? '' }
    } catch {
      return null
    }
  }, [career])
  return <div className="app-shell" data-testid="app-shell">
    {saveError && <div className="save-error" role="alert">{saveError}</div>}
    {screen === 'title' && <TitleScreen canResume={Boolean(career)} onNew={beginNew} onContinue={() => { if (career) setScreen(screenForPhase(career.save.phase)) }} onSaves={() => setScreen('saves')} />}
    {screen === 'creation' && <CreationScreen player={player} onChange={updatePlayer} onBack={() => setScreen('title')} onComplete={startCareer} />}
    {screen === 'hub' && career && <CareerHub player={currentPlayer} career={career} importSuccess={importSuccess} onNavigate={setScreen} onPlay={beginGame} onTitle={() => setScreen('title')} onAction={takeAction} onEventChoice={chooseEvent} onAdvance={advanceMonth} onExport={exportCareer} onImport={importCareer} />}
    {screen === 'records' && career && <RecordsScreen save={career.save} onBack={() => setScreen('hub')} />}
    {screen === 'settings' && <SettingsScreen settings={settings} onChange={updateSettings} onBack={() => setScreen('hub')} />}
    {screen === 'saves' && <SavesScreen slots={slots} activeSlot={activeSlot} onBack={() => setScreen(career ? screenForPhase(career.save.phase) : 'title')} onSelect={selectSlot} onOverwrite={overwriteSlot} onDelete={deleteSlot} onRestore={restoreSlot} />}
    {screen === 'game' && activeGame && <Suspense fallback={<div className="game-loading">경기장을 준비하는 중…</div>}><GameScene role={currentPlayer.role} position={currentPlayer.position} settings={settings} match={activeGame} onCheckpoint={checkpointMatch} onFinish={finishGame} onExit={() => setSaveError('진행 중인 경기는 완료 후 나갈 수 있습니다.')} /></Suspense>}
    {screen === 'game' && !activeGame && <div className="game-loading" role="alert">저장된 경기 체크포인트를 복구할 수 없습니다.</div>}
    {screen === 'result' && career && <ResultScreen save={career.save} result={lastGame ?? recoveredLastGame} onHub={returnFromResult} />}
    {screen === 'draft' && career && <DraftScreen save={career.save} onTitle={() => setScreen('title')} />}
  </div>
}
