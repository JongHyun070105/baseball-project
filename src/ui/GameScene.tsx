import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { Physics, RigidBody } from '@react-three/rapier'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { BallState, GameSettings, GameplayCommand, HitterPosition, PitcherRole, PlayerRole, ReplayBundle, SceneTerminalResult } from '../contracts'
import { createReplayBundle, reduceMatch, simulateAiGame, simulateAiHalfInning, simulateAiPlateAppearance, type MatchState } from '../domain/match'
import {
  BaserunningController,
  BaserunningInputMapper,
  BattingController,
  CatcherController,
  createSwingCommand,
  FieldingInputMapper,
  InfieldController,
  mapBattingKey,
  mapBattingPointerButton,
  OutfieldController,
  PitchingController,
  PitchingInputMapper,
  type GameplayScene,
  type SceneController,
} from '../gameplay'
import { Button } from './controls'
import { DiamondIcon, PauseIcon, PlayIcon, SoundIcon } from './icons'

function Crowd({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    if (!ref.current) return
    const matrix = new THREE.Matrix4()
    const color = new THREE.Color()
    const palette = ['#e8e1cf', '#c59c5f', '#5c7184', '#891f2a']
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1
      const row = Math.floor(index / 200) % 4
      const lane = (index % 200) / 199
      matrix.makeTranslation(side * (10 + lane * 20), 1.1 + row * .65, 3 + lane * 18)
      ref.current.setMatrixAt(index, matrix)
      ref.current.setColorAt(index, color.set(palette[index % palette.length]))
    }
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [count])
  return <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled><sphereGeometry args={[.14, 5, 4]} /><meshStandardMaterial roughness={.9} /></instancedMesh>
}

function Stadium({ crowdCount }: { crowdCount: number }) {
  return <group>
    <mesh rotation-x={-Math.PI / 2} receiveShadow><circleGeometry args={[55, 64]} /><meshStandardMaterial color="#1c5b39" roughness={0.95} /></mesh>
    <mesh position={[0, .025, 4]} rotation-x={-Math.PI / 2} receiveShadow><circleGeometry args={[12.2, 4]} /><meshStandardMaterial color="#a36b3c" roughness={1} /></mesh>
    <mesh position={[0, .055, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[3.25, 40]} /><meshStandardMaterial color="#b88a59" /></mesh>
    <mesh position={[0, .075, 8]} rotation-x={-Math.PI / 2}><circleGeometry args={[2, 40]} /><meshStandardMaterial color="#b88a59" /></mesh>
    <FieldLine from={[0, .08, 7]} to={[-31, .08, 38]} /><FieldLine from={[0, .08, 7]} to={[31, .08, 38]} />
    {[[-6, .1, 8], [0, .1, 14], [6, .1, 8], [0, .1, 2]].map((position, index) => <Base key={index} position={position as [number, number, number]} />)}
    <OutfieldWall />
    <Crowd count={crowdCount} />
    <LightTower position={[-26, 8, 9]} /><LightTower position={[26, 8, 9]} /><LightTower position={[-20, 8, 32]} /><LightTower position={[20, 8, 32]} />
  </group>
}

function FieldLine({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const dx = to[0] - from[0], dz = to[2] - from[2]
  const length = Math.hypot(dx, dz), angle = Math.atan2(dx, dz)
  return <mesh position={[(from[0] + to[0]) / 2, from[1], (from[2] + to[2]) / 2]} rotation-y={angle}><boxGeometry args={[.12, .03, length]} /><meshStandardMaterial color="#f4e7ce" /></mesh>
}
function Base({ position }: { position: [number, number, number] }) { return <mesh position={position} rotation={[-Math.PI / 2, 0, Math.PI / 4]}><planeGeometry args={[.75, .75]} /><meshStandardMaterial color="#f7f2e9" /></mesh> }
function OutfieldWall() { return <group>{Array.from({ length: 25 }, (_, i) => { const a = -.95 + i * .079; return <mesh key={i} position={[Math.sin(a) * 43, 2.1, 2 + Math.cos(a) * 43]} rotation-y={-a}><boxGeometry args={[3.6, 4, .35]} /><meshStandardMaterial color={i % 5 === 0 ? '#234f45' : '#193e37'} /></mesh> })}</group> }
function LightTower({ position }: { position: [number, number, number] }) { return <group position={position}><mesh><cylinderGeometry args={[.1, .18, 14, 6]} /><meshStandardMaterial color="#7a8588" metalness={.7} /></mesh><mesh position={[0, 7, 0]}><boxGeometry args={[4, 2.2, .35]} /><meshStandardMaterial color="#d9d7c8" emissive="#fff5ce" emissiveIntensity={1.1} /></mesh></group> }

function armAngleForPose(pose: 'ready' | 'batting' | 'pitching'): number {
  if (pose === 'batting') return 1.05
  if (pose === 'pitching') return -.65
  return .15
}

function Athlete({ position, uniform, pose = 'ready', scale = 1, animated = true }: { position: [number, number, number]; uniform: string; pose?: 'ready' | 'batting' | 'pitching'; scale?: number; animated?: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const armAngle = armAngleForPose(pose)
  const motionOffset = Math.abs(position[0] * .37 + position[2] * .19)
  useFrame(({ clock }) => {
    if (!ref.current || !animated) return
    const phase = clock.elapsedTime * 2.2 + motionOffset
    ref.current.position.y = position[1] + Math.sin(phase) * .018
    ref.current.rotation.y = Math.sin(phase * .55) * .018
  })
  return <group ref={ref} position={position} scale={scale}>
    <mesh position={[0, 1.75, 0]} castShadow><sphereGeometry args={[.22, 18, 18]} /><meshStandardMaterial color="#b97e5f" /></mesh>
    <mesh position={[0, 1.95, -.02]} castShadow><sphereGeometry args={[.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={uniform} /></mesh>
    <mesh position={[0, 1.05, 0]} castShadow><capsuleGeometry args={[.32, .68, 8, 12]} /><meshStandardMaterial color={uniform} roughness={.7} /></mesh>
    <Limb position={[-.32, 1.25, 0]} rotation={[armAngle, 0, -.3]} color={uniform} /><Limb position={[.32, 1.25, 0]} rotation={[-armAngle, 0, .3]} color={uniform} />
    <Limb position={[-.18, .4, 0]} rotation={[.08, 0, .05]} color="#f0ece2" /><Limb position={[.18, .4, 0]} rotation={[-.08, 0, -.05]} color="#f0ece2" />
    {pose === 'batting' && <mesh position={[.62, 1.65, .08]} rotation={[0, 0, -.68]}><cylinderGeometry args={[.035, .055, 1.7, 10]} /><meshStandardMaterial color="#d2b887" /></mesh>}
  </group>
}
function Limb({ position, rotation, color }: { position: [number, number, number]; rotation: [number, number, number]; color: string }) { return <mesh position={position} rotation={rotation} castShadow><capsuleGeometry args={[.11, .55, 6, 8]} /><meshStandardMaterial color={color} /></mesh> }

function Baseball({ state }: { state?: BallState }) {
  const position: [number, number, number] = state
    ? [state.position.x * .08, Math.max(.12, state.position.y * .08 + .12), 3 + state.position.z * .08]
    : [0, .12, 3]
  return <mesh position={position} visible={Boolean(state)} castShadow><sphereGeometry args={[.075, 20, 20]} /><meshStandardMaterial color="#fffaf0" roughness={.6} /></mesh>
}

function BroadcastCamera({ motionEnabled, shake }: { motionEnabled: boolean; shake: number }) {
  const { camera } = useThree()
  useFrame(({ clock, pointer }) => {
    const impact = motionEnabled ? Math.sin(clock.elapsedTime * 38) * shake * .08 : 0
    const tx = 7.8 + (motionEnabled ? pointer.x * .25 : 0) + impact
    const ty = 4 + (motionEnabled ? pointer.y * .12 : 0) + impact * .4
    camera.position.x += (tx - camera.position.x) * .025
    camera.position.y += (ty - camera.position.y) * .025
    camera.lookAt(0, 1.5, 3)
  })
  return null
}

function DynamicQuality({ onFactor }: { onFactor: (factor: number) => void }) {
  const sampleRef = useRef({ elapsed: 0, frames: 0, factor: 1 })
  useFrame((_, delta) => {
    const sample = sampleRef.current
    sample.elapsed += Math.min(delta, .1)
    sample.frames += 1
    if (sample.elapsed < 2) return
    const averageFrameMs = sample.elapsed / sample.frames * 1000
    let nextFactor = sample.factor
    if (averageFrameMs > 24) nextFactor = .75
    else if (averageFrameMs < 18) nextFactor = 1
    sample.elapsed = 0
    sample.frames = 0
    if (nextFactor === sample.factor) return
    sample.factor = nextFactor
    onFactor(nextFactor)
  })
  return null
}

const DEFENDERS: readonly [number, number, number][] = [
  [-.8, 0, 1.4], [-6, 0, 8], [6, 0, 8], [0, 0, 14], [-11, 0, 13], [11, 0, 13],
  [-16, 0, 23], [0, 0, 28], [16, 0, 23], [-4, 0, 5], [4, 0, 5], [-8, 0, 17],
  [8, 0, 17], [-22, 0, 29], [22, 0, 29], [0, 0, 35],
]

function crowdCountForGraphics(graphics: GameSettings['graphics']): number {
  switch (graphics) {
    case 'high':
      return 800
    case 'medium':
      return 500
    case 'low':
      return 250
  }
}

function dprForGraphics(graphics: GameSettings['graphics']): number {
  switch (graphics) {
    case 'high':
      return 1.5
    case 'medium':
      return 1.25
    case 'low':
      return 1
  }
}

function GameWorld({ paused, ballState, graphics, motionEnabled, cameraShake }: { paused: boolean; ballState?: BallState; graphics: GameSettings['graphics']; motionEnabled: boolean; cameraShake: number }) {
  const crowdCount = crowdCountForGraphics(graphics)
  return <>
    <color attach="background" args={['#07131f']} /><fog attach="fog" args={['#0b1b29', 35, 86]} />
    <ambientLight color="#87a9c4" intensity={.72} />
    <directionalLight color="#e8f3ff" position={[-12, 24, -8]} intensity={2.8} castShadow shadow-mapSize={[2048, 2048]} />
    <pointLight color="#fff1c8" position={[-22, 17, 12]} intensity={72} distance={62} decay={1.6} />
    <pointLight color="#d9ecff" position={[22, 17, 28]} intensity={65} distance={62} decay={1.6} />
    <Physics gravity={[0, -9.81, 0]} timeStep={1 / 120} paused={paused}>
      <RigidBody type="fixed" colliders="cuboid"><mesh position={[0, -.15, 10]} visible={false}><boxGeometry args={[110, .2, 110]} /><meshBasicMaterial transparent opacity={0} /></mesh></RigidBody>
    </Physics>
    <Stadium crowdCount={crowdCount} /><Athlete position={[0, 0, 1.1]} uniform="#142f4c" pose="batting" scale={1.08} animated={motionEnabled && !paused} /><Athlete position={[0, 0, 8]} uniform="#72202a" pose="pitching" animated={motionEnabled && !paused} />
    {DEFENDERS.map((defender, index) => <Athlete key={index} position={defender} uniform="#72202a" scale={graphics === 'low' && index > 8 ? .82 : 1} animated={motionEnabled && !paused} />)}
    <Baseball state={ballState} /><ContactShadows position={[0, .09, 3]} opacity={.45} scale={18} blur={2.4} far={8} /><BroadcastCamera motionEnabled={motionEnabled} shake={cameraShake} />
  </>
}

type Position = HitterPosition | PitcherRole
type ActiveScene = GameplayScene
type MatchCommit = { state: MatchState; terminal?: SceneTerminalResult }

export interface GameSceneResult {
  terminal: SceneTerminalResult
  completedScenes: readonly SceneTerminalResult[]
  performance: number
  replayHash: string
  matchState: MatchState
  replay: ReplayBundle
  playerTerminalIds: readonly string[]
}

const DIFFICULTY_FACTOR: Record<GameSettings['difficulty'], number> = { rookie: .72, prospect: 1, legend: 1.28 }

function swingTiming(swingType: 'normal' | 'contact' | 'power'): number {
  if (swingType === 'power') return -.04
  if (swingType === 'contact') return .02
  return 0
}

function countFeedback(state: MatchState, includeOuts = false): string {
  const count = `${state.lastPlay?.result ?? '투구'} · ${state.balls}B ${state.strikes}S`
  return includeOuts ? `${count} · ${state.outs}O` : count
}

function runnerFeedback(direction: 'advance' | 'retreat' | 'hold'): string {
  if (direction === 'advance') return '다음 베이스로 질주'
  if (direction === 'retreat') return '귀루 중'
  return '베이스에서 대기'
}

function broadcastLabel(mode: ActiveScene, position: Position): string {
  if (mode === 'pitching') return '내 선수 등판'
  if (mode === 'catcher' || mode === 'infield' || mode === 'outfield') return `${position} ${mode.toUpperCase()} 수비`
  if (mode === 'baserunning') return '주루 플레이'
  return '내 선수 타석'
}

function requiredBaseFor(position: Position): 1 | 2 | 3 {
  if (position === '3B') return 3
  if (position === '2B' || position === 'SS') return 2
  return 1
}

function swingKey(type: 'CONTACT' | 'NORMAL' | 'POWER'): string {
  if (type === 'CONTACT') return 'RMB'
  if (type === 'POWER') return 'SPACE'
  return 'LMB'
}

function controlHints(mode: ActiveScene): { movementInput: string; movementAction: string; playInput: string; playAction: string } {
  if (mode === 'catcher' || mode === 'infield' || mode === 'outfield') {
    return { movementInput: 'WASD · Shift', movementAction: '이동', playInput: 'Space · 1–4', playAction: '포구/송구' }
  }
  if (mode === 'baserunning') {
    return { movementInput: 'W/S · Shift', movementAction: '주루', playInput: 'Space', playAction: '슬라이딩' }
  }
  if (mode === 'pitching') {
    return { movementInput: '마우스', movementAction: '조준', playInput: '클릭 유지·드래그·릴리스', playAction: '투구' }
  }
  return { movementInput: '마우스', movementAction: '조준', playInput: 'LMB/RMB/Space · B/T', playAction: '스윙' }
}

export function fieldingSceneFor(position: HitterPosition): 'catcher' | 'infield' | 'outfield' {
  if (position === 'C') return 'catcher'
  return position === 'LF' || position === 'CF' || position === 'RF' ? 'outfield' : 'infield'
}

export function summarizeGameplay(matchState: MatchState, completedScenes: readonly SceneTerminalResult[]): GameSceneResult {
  if (!completedScenes.length) throw new Error('Cannot summarize gameplay without a terminal scene')
  const total = completedScenes.reduce((value, result) => value + (result.success ? 72 : 34) + result.runs * 12 - result.outs * 8, 0)
  const performance = Math.max(0, Math.min(100, Math.round(total / completedScenes.length)))
  const terminal = completedScenes[completedScenes.length - 1]
  const replay = createReplayBundle(matchState, 'career-match-v1')
  return { terminal, completedScenes: [...completedScenes], performance, replayHash: replay.finalHash, matchState, replay, playerTerminalIds: completedScenes.map((scene) => scene.id) }
}

function playAudioCue(volume: number, success: boolean): void {
  if (volume <= 0 || typeof AudioContext === 'undefined') return
  const context = new AudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = success ? 520 : 180
  gain.gain.setValueAtTime(Math.min(.12, volume * .12), context.currentTime)
  gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .09)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + .1)
  oscillator.addEventListener('ended', () => { void context.close() }, { once: true })
}

function createController(scene: ActiveScene, position: Position, difficulty: GameSettings['difficulty'], sequence: number, paused = false): SceneController {
  const factor = DIFFICULTY_FACTOR[difficulty]
  const id = `gameplay-${String(sequence).padStart(3, '0')}-${scene}`
  let controller: SceneController
  if (scene === 'batting') controller = new BattingController(id, { pitchLocation: { x: .16 * factor, y: -.1 * factor }, perfectTimingSeconds: .5 })
  else if (scene === 'pitching') controller = new PitchingController(id)
  else if (scene === 'baserunning') controller = new BaserunningController(id, { distanceMeters: 20, availableSeconds: 3.15 - factor * .45 })
  else if (scene === 'catcher') controller = new CatcherController(id, .95 - factor * .18)
  else if (scene === 'infield') {
    controller = new InfieldController(id, requiredBaseFor(position))
  } else controller = new OutfieldController(id, 28 / factor)
  controller.start()
  if (paused) controller.pause()
  return controller
}

export function GameScene({ role, position, settings, match, onCheckpoint, onFinish, onExit }: { role: PlayerRole; position: Position; settings: GameSettings; match: MatchState; onCheckpoint: (state: MatchState) => boolean; onFinish: (result: GameSceneResult) => void; onExit: () => void }) {
  const initialScene: ActiveScene = role === 'pitcher' ? 'pitching' : 'batting'
  const initialPaused = match.phase === 'paused'
  const [paused, setPaused] = useState(initialPaused)
  const [helpVisible, setHelpVisible] = useState(false)
  const [aim, setAim] = useState({ x: 50, y: 50 })
  const [swing, setSwing] = useState<'NORMAL' | 'CONTACT' | 'POWER'>('NORMAL')
  const [pitch, setPitch] = useState(1)
  const [mode, setMode] = useState<ActiveScene>(initialScene)
  const [feedback, setFeedback] = useState(role === 'pitcher' ? '구종을 고르고 코스를 지정하세요' : '투수의 릴리스를 읽고 스윙하세요')
  const [terminal, setTerminal] = useState<SceneTerminalResult | null>(null)
  const [presentationComplete, setPresentationComplete] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [qualityFactor, setQualityFactor] = useState(1)
  const modeRef = useRef<ActiveScene>(initialScene)
  const pausedRef = useRef(initialPaused)
  const aimRef = useRef(aim)
  const sequenceRef = useRef(1)
  const completedRef = useRef<SceneTerminalResult[]>([])
  const matchRef = useRef(match)
  const controllerRef = useRef<SceneController>(createController(initialScene, position, settings.difficulty, 1, initialPaused))
  const pitchingInputRef = useRef(new PitchingInputMapper())
  const fieldingInputRef = useRef(new FieldingInputMapper())
  const baserunningInputRef = useRef(new BaserunningInputMapper())
  const fieldRouteRef = useRef({ x: 0, z: 0, sprint: false, caught: false })

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const setScene = (scene: ActiveScene) => {
    sequenceRef.current += 1
    modeRef.current = scene
    setMode(scene)
    controllerRef.current = createController(scene, position, settings.difficulty, sequenceRef.current)
    pitchingInputRef.current = new PitchingInputMapper()
    pitchingInputRef.current.selectPitch(String(pitch))
    fieldingInputRef.current = new FieldingInputMapper()
    baserunningInputRef.current = new BaserunningInputMapper()
    fieldRouteRef.current = { x: 0, z: 0, sprint: false, caught: false }
  }
  const recordAuthoritativeTerminal = (result: SceneTerminalResult) => {
    completedRef.current = [...completedRef.current, result]
    setTerminal(result)
    setFeedback(result.summary)
    playAudioCue(settings.masterVolume, result.success)
    if (result.scene === 'batting') setScene(result.success ? 'baserunning' : fieldingSceneFor(position as HitterPosition))
    else if (matchRef.current.half === 'top') setScene('pitching')
    else setPresentationComplete(true)
  }
  const continueHitterLoop = () => {
    if (completedRef.current.filter((scene) => scene.scene === 'batting').length >= 3) {
      setPresentationComplete(true)
      return
    }
    let state = matchRef.current
    if (state.phase === 'live' && state.half === 'bottom') state = simulateAiPlateAppearance(state).state
    if (state.phase === 'live' && state.half === 'top') state = simulateAiHalfInning(state).state
    if (!onCheckpoint(state)) { setFeedback('다음 타석 체크포인트를 저장하지 못했습니다.'); return }
    matchRef.current = state
    setScene('batting')
    setFeedback('팀 동료와 상대 공격이 끝났습니다. 다음 타석을 준비하세요.')
  }
  const recordPresentationTerminal = (result: SceneTerminalResult) => {
    completedRef.current = [...completedRef.current, result]
    setTerminal(result)
    setFeedback(result.summary)
    playAudioCue(settings.masterVolume, result.success)
    if (result.scene === 'baserunning') setScene(fieldingSceneFor(position as HitterPosition))
    else continueHitterLoop()
  }
  const commitMatchCommand = (type: GameplayCommand['type'], payload: GameplayCommand['payload']): MatchCommit | undefined => {
    const current = matchRef.current
    const command = { id: current.lastCommandId + 1, tick: current.tick + 1, type, payload } as GameplayCommand
    const reduction = reduceMatch(current, command)
    if (!onCheckpoint(reduction.state)) {
      setFeedback('경기 체크포인트를 저장하지 못했습니다. 입력을 다시 시도하세요.')
      return undefined
    }
    matchRef.current = reduction.state
    const terminalEvent = reduction.events.find((event) => event.type === 'match/scene-terminal')
    return { state: reduction.state, ...(terminalEvent?.type === 'match/scene-terminal' ? { terminal: terminalEvent.payload } : {}) }
  }
  const setPauseState = (next: boolean) => {
    const snapshot = controllerRef.current.snapshot()
    if (snapshot.phase === 'terminal') return
    const current = matchRef.current
    const type = next ? 'gameplay/pause' : 'gameplay/resume'
    const reduction = reduceMatch(current, { id: current.lastCommandId + 1, tick: current.tick + 1, type, payload: {} })
    if (!onCheckpoint(reduction.state)) return
    matchRef.current = reduction.state
    if (next && snapshot.phase === 'live') controllerRef.current.pause()
    if (!next && snapshot.phase === 'paused' && !snapshot.helpVisible) controllerRef.current.resume()
    pausedRef.current = next
    setPaused(next)
  }
  const toggleHelp = () => {
    const visible = controllerRef.current.toggleHelp()
    setHelpVisible(visible)
    pausedRef.current = controllerRef.current.snapshot().phase === 'paused'
    setPaused(pausedRef.current)
  }
  const normalizedAim = () => {
    const raw = { x: (aimRef.current.x - 50) / 50, y: (aimRef.current.y - 50) / 50 }
    if (!settings.aimAssist || modeRef.current !== 'batting') return raw
    const factor = DIFFICULTY_FACTOR[settings.difficulty]
    const target = { x: .16 * factor, y: -.1 * factor }
    return { x: raw.x * .65 + target.x * .35, y: raw.y * .65 + target.y * .35 }
  }
  const resolveBatting = (action: ReturnType<typeof mapBattingKey> | ReturnType<typeof mapBattingPointerButton>) => {
    if (!action || modeRef.current !== 'batting' || pausedRef.current) return
    const controller = controllerRef.current as BattingController
    if (action.type === 'request-time') { controller.requestTime(); setFeedback('타임 요청이 받아들여졌습니다'); return }
    if (action.type === 'bunt') {
      const aim = normalizedAim()
      const command = createSwingCommand('contact', aim, .02)
      const committed = commitMatchCommand('gameplay/swing', command)
      if (!committed) return
      const authoritative = committed.terminal
      if (!authoritative) {
        setFeedback(countFeedback(committed.state))
        return
      }
      setSwing('CONTACT')
      controller.bunt(aim)
      recordAuthoritativeTerminal(authoritative)
      return
    }
    if (action.type !== 'swing') return
    setSwing(action.swingType.toUpperCase() as 'NORMAL' | 'CONTACT' | 'POWER')
    const timing = swingTiming(action.swingType)
    const command = createSwingCommand(action.swingType, normalizedAim(), timing)
    const committed = commitMatchCommand('gameplay/swing', command)
    if (!committed) return
    const authoritative = committed.terminal
    if (!authoritative) {
      setFeedback(countFeedback(committed.state))
      return
    }
    controller.swing(createSwingCommand(action.swingType, command.aim, timing + .5))
    recordAuthoritativeTerminal(authoritative)
  }
  const resolveFielding = (key: string, keyUp = false) => {
    const action = keyUp ? fieldingInputRef.current.keyUp(key) : fieldingInputRef.current.keyDown(key)
    if (!action || pausedRef.current) return
    if (action.type === 'move') {
      if (!commitMatchCommand('gameplay/move-fielder', { mode: modeRef.current as 'catcher' | 'infield' | 'outfield', x: action.x, z: action.z, sprint: action.sprint })) return
      fieldRouteRef.current = { ...fieldRouteRef.current, x: action.x, z: action.z, sprint: action.sprint }
      setFeedback(action.sprint ? '전력으로 타구를 따라갑니다' : '타구 낙하지점으로 이동합니다')
    } else if (action.type === 'attempt-catch') {
      fieldRouteRef.current.caught = true
      const route = Math.hypot(fieldRouteRef.current.x, fieldRouteRef.current.z) * (fieldRouteRef.current.sprint ? 1.5 : 3)
      if (modeRef.current === 'catcher' || modeRef.current === 'outfield') {
        const local = modeRef.current === 'catcher'
          ? (controllerRef.current as CatcherController).receive({ reactionSeconds: .22 + route * .03, gloveAccuracy: .9 - route * .03 })
          : (controllerRef.current as OutfieldController).field({ routeDistance: route + 2, catchTiming: .9, throwAccuracy: .72 })
        const committed = commitMatchCommand('gameplay/move-fielder', { mode: modeRef.current, x: fieldRouteRef.current.x, z: fieldRouteRef.current.z, sprint: fieldRouteRef.current.sprint, outcome: local })
        if (committed?.terminal) recordPresentationTerminal(committed.terminal)
        else if (!committed) setScene(modeRef.current)
      } else {
        if (!commitMatchCommand('gameplay/move-fielder', { mode: 'infield', x: fieldRouteRef.current.x, z: fieldRouteRef.current.z, sprint: fieldRouteRef.current.sprint })) return
        setFeedback('포구 성공 · 1–4 키로 송구 베이스를 선택하세요')
      }
    } else if (modeRef.current === 'infield') {
      const route = Math.hypot(fieldRouteRef.current.x, fieldRouteRef.current.z) * (fieldRouteRef.current.sprint ? 1.5 : 3)
      const local = (controllerRef.current as InfieldController).field({ routeDistance: route + (fieldRouteRef.current.caught ? 1 : 6), catchTiming: fieldRouteRef.current.caught ? .9 : .4, throwBase: action.base, throwAccuracy: .86 })
      const committed = commitMatchCommand('gameplay/throw-base', { base: action.base, accuracy: .86, outcome: local })
      if (committed?.terminal) recordPresentationTerminal(committed.terminal)
      else if (!committed) setScene('infield')
    }
  }
  const resolveBaserunning = (key: string, keyUp = false) => {
    const decision = keyUp ? baserunningInputRef.current.keyUp(key) : baserunningInputRef.current.keyDown(key)
    if (!decision || pausedRef.current) return
    setFeedback(runnerFeedback(decision.direction))
    if (!keyUp && (key === ' ' || key === 'Space')) {
      const local = (controllerRef.current as BaserunningController).run(decision)
      const committed = commitMatchCommand('gameplay/runner-decision', { ...decision, outcome: local })
      if (committed?.terminal) recordPresentationTerminal(committed.terminal)
      else if (!committed) setScene('baserunning')
    } else commitMatchCommand('gameplay/runner-decision', decision)
  }
  const resolvePitch = (command: NonNullable<ReturnType<PitchingInputMapper['releaseGesture']>>) => {
    const factor = DIFFICULTY_FACTOR[settings.difficulty]
    const adjusted = {
      ...command,
      gestureAccuracy: command.gestureAccuracy / factor,
      releaseAccuracy: command.releaseAccuracy / factor,
    }
    const committed = commitMatchCommand('gameplay/pitch', adjusted)
    if (!committed) return
    const authoritative = committed.terminal
    if (!authoritative) {
      setFeedback(countFeedback(committed.state, true))
      return
    }
    const controller = controllerRef.current as PitchingController
    controller.pitch(adjusted)
    recordAuthoritativeTerminal(authoritative)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPauseState(!pausedRef.current); return }
      if (event.key === '?' || event.key.toLowerCase() === 'h') { toggleHelp(); return }
      if (modeRef.current === 'pitching') {
        const selected = pitchingInputRef.current.selectPitch(event.key)
        if (selected) { setPitch(Number(event.key)); setFeedback(`${selected} 선택`) }
      } else if (modeRef.current === 'batting') resolveBatting(mapBattingKey(event.key))
      else if (modeRef.current === 'baserunning') resolveBaserunning(event.key)
      else resolveFielding(event.key)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (modeRef.current === 'baserunning') resolveBaserunning(event.key, true)
      else if (modeRef.current === 'catcher' || modeRef.current === 'infield' || modeRef.current === 'outfield') resolveFielding(event.key, true)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  })

  const finish = () => {
    const results = completedRef.current
    if (completedRef.current.filter((scene) => scene.scene === 'batting').length < 3 && role === 'hitter') return
    if (!results.length || !presentationComplete) return
    const finalState = matchRef.current.phase === 'terminal' ? matchRef.current : simulateAiGame(matchRef.current).state
    if (!onCheckpoint(finalState)) {
      setFeedback('최종 경기 상태를 저장하지 못했습니다. 완료 처리가 중단되었습니다.')
      return
    }
    matchRef.current = finalState
    onFinish(summarizeGameplay(finalState, results))
  }
  const motionEnabled = settings.motionEffects && !reducedMotion
  const baseDpr = dprForGraphics(settings.graphics)
  const effectiveDpr = Number((baseDpr * qualityFactor).toFixed(2))
  const authoritativeBall = matchRef.current.lastPlay?.contact?.flight.state
  const sceneQuality = qualityFactor < 1 && settings.graphics === 'high' ? 'medium' : settings.graphics
  const crowdCount = crowdCountForGraphics(settings.graphics)
  const hints = controlHints(mode)
  return <main className="game-screen" data-testid="game-screen" data-scene={mode} data-match-phase={matchRef.current.phase} data-match-half={matchRef.current.half} data-match-outs={matchRef.current.outs} data-player-plate-appearances={completedRef.current.filter((scene) => scene.scene === 'batting').length} data-player-strikeouts={completedRef.current.filter((scene) => scene.summary === 'strikeout').length} data-authoritative-ball-count={authoritativeBall ? 1 : 0} data-difficulty={settings.difficulty} data-aim-assist={settings.aimAssist} data-motion={motionEnabled} data-target-dpr={effectiveDpr} data-quality-fallback={qualityFactor < 1} data-scene-quality={sceneQuality} data-athlete-count="18" data-crowd-count={crowdCount} data-lighting="night"
    onContextMenu={(event) => { event.preventDefault(); resolveBatting(mapBattingPointerButton(2)) }}
    onPointerDown={(event) => {
      if ((event.target as Element).closest('button')) return
      if (pausedRef.current) return
      if (modeRef.current === 'pitching') {
        const x = (event.clientX / window.innerWidth - .5) * 2, y = (event.clientY / window.innerHeight - .5) * 2
        pitchingInputRef.current.setTarget(x, y); pitchingInputRef.current.beginGesture(x, y, event.timeStamp)
      } else resolveBatting(mapBattingPointerButton(event.button))
    }}
    onPointerUp={(event) => {
      if ((event.target as Element).closest('button')) return
      if (modeRef.current !== 'pitching' || pausedRef.current) return
      const x = (event.clientX / window.innerWidth - .5) * 2, y = (event.clientY / window.innerHeight - .5) * 2
      const command = pitchingInputRef.current.releaseGesture(x, y, event.timeStamp)
      if (command) resolvePitch(command)
    }}
    onPointerMove={(event) => {
      if (pausedRef.current) return
      const nextAim = { x: event.clientX / window.innerWidth * 100, y: event.clientY / window.innerHeight * 100 }
      aimRef.current = nextAim; setAim(nextAim)
      if (modeRef.current === 'pitching' && event.buttons === 1) pitchingInputRef.current.updateGesture((nextAim.x - 50) / 50, (nextAim.y - 50) / 50, event.timeStamp)
    }}>
    <div className="game-canvas" aria-label="3D 야구 경기장"><Canvas dpr={effectiveDpr} shadows={settings.graphics !== 'low'} camera={{ position: [7.8, 4, -8.8], fov: 44 }} gl={{ antialias: settings.graphics !== 'low', powerPreference: 'high-performance' }}><DynamicQuality onFactor={setQualityFactor} /><GameWorld paused={paused} ballState={authoritativeBall} graphics={sceneQuality} motionEnabled={motionEnabled} cameraShake={terminal && motionEnabled ? settings.cameraShake : 0} /></Canvas></div>
    <div className="scorebug" data-testid="authoritative-score"><div className="scorebug__inning"><span>{matchRef.current.inning}</span><small>{matchRef.current.half === 'top' ? '초' : '말'}</small></div><div className="scorebug__teams"><p><i className="team-dot team-dot--away" />원정 <strong data-testid="away-score">{matchRef.current.score.away}</strong></p><p><i className="team-dot team-dot--home" />우리 팀 <strong data-testid="home-score">{matchRef.current.score.home}</strong></p></div><div className="scorebug__count"><p><span>B</span>{[0, 1, 2, 3].map((value) => <i key={value} className={value < matchRef.current.balls ? 'is-on' : ''} />)}</p><p><span>S</span>{[0, 1, 2].map((value) => <i key={value} className={value < matchRef.current.strikes ? 'is-on' : ''} />)}</p><p><span>O</span>{[0, 1].map((value) => <i key={value} className={value < matchRef.current.outs ? 'is-on' : ''} />)}</p></div><div className="base-diamond">{matchRef.current.bases.map((occupied, index) => <i key={index} className={occupied ? 'is-on' : ''} />)}</div></div>
    <div className="broadcast-tag"><span>LIVE</span> {broadcastLabel(mode, position)} · PLAY {completedRef.current.length + 1}</div>
    <div className="aim-reticle" style={{ left: `${aim.x}%`, top: `${aim.y}%` }} aria-hidden="true"><span /><i /></div>
    <div className="pitch-info"><span>{mode === 'pitching' ? pitch : '2–1'}</span><div><small>{mode.toUpperCase()}</small><strong>{feedback}</strong></div></div>
    {authoritativeBall && <output data-testid="authoritative-ball-state">LIVE BALL · {authoritativeBall.position.x.toFixed(1)}, {authoritativeBall.position.y.toFixed(1)}, {authoritativeBall.position.z.toFixed(1)}</output>}
    {terminal && <output data-testid="gameplay-terminal" data-terminal-id={terminal.id} data-success={terminal.success} data-replay-hash={terminal.replayHash}>{terminal.scene} · {terminal.summary} · {terminal.runs}R/{terminal.outs}O</output>}
    {mode === 'batting' && <div className="swing-selector" role="group" aria-label="스윙 유형" onPointerDown={(event) => event.stopPropagation()}>{(['CONTACT', 'NORMAL', 'POWER'] as const).map((type) => <button key={type} className={swing === type ? 'is-active' : ''} onClick={(event) => { event.stopPropagation(); resolveBatting({ type: 'swing', swingType: type.toLowerCase() as 'normal' | 'contact' | 'power' }) }}><kbd>{swingKey(type)}</kbd>{type}</button>)}</div>}
    {mode === 'pitching' && <div className="swing-selector" role="group" aria-label="구종 선택" onPointerDown={(event) => event.stopPropagation()}>{['포심', '투심', '체인지업', '슬라이더', '커브'].map((name, index) => <button key={name} className={pitch === index + 1 ? 'is-active' : ''} onClick={(event) => { event.stopPropagation(); pitchingInputRef.current.selectPitch(String(index + 1)); setPitch(index + 1) }}><kbd>{index + 1}</kbd>{name}</button>)}</div>}
    <div className="game-controls"><span><i className="mouse-icon" /> {hints.movementInput} <b>{hints.movementAction}</b></span><span><i className="mouse-click" /> {hints.playInput} <b>{hints.playAction}</b></span><span><kbd>ESC</kbd> <b>일시정지</b></span><span><kbd>H</kbd> <b>도움말</b></span></div>
    <div className="game-tools"><button aria-label="음량" onClick={() => playAudioCue(settings.masterVolume, true)}><SoundIcon /></button><button aria-label="일시정지" onClick={() => setPauseState(true)}><PauseIcon /></button></div>
    <button className="finish-game" data-testid="finish-game-button" disabled={!terminal || !presentationComplete} onClick={finish}>남은 이닝 시뮬레이션 · 경기 완료</button>
    {(paused || helpVisible) && <div className="pause-overlay"><div className="pause-card panel"><DiamondIcon /><span>{helpVisible ? 'GAME HELP' : 'GAME PAUSED'}</span><h1>{helpVisible ? '조작 도움말' : '일시정지'}</h1>{helpVisible && <p>현재 {mode.toUpperCase()} 조작은 하단 키 가이드를 따릅니다.</p>}<Button onClick={() => helpVisible ? toggleHelp() : setPauseState(false)} icon={<PlayIcon />}>경기 계속하기</Button><Button variant="ghost" onClick={onExit}>커리어로 나가기</Button><small>ESC 키로 일시정지 · H 키로 도움말</small></div></div>}
  </main>
}
