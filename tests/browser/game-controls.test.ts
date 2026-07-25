import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameSettings, SceneTerminalResult } from '../../src/contracts'
import { createMatch, reduceMatch, startMatch, type MatchState } from '../../src/domain/match'

vi.mock('@react-three/fiber', () => ({
  Canvas: () => createElement('div', { 'data-testid': 'mock-canvas' }),
  useFrame: () => undefined,
  useThree: () => ({ camera: { position: { x: 0, y: 0 }, lookAt: () => undefined } }),
}))
vi.mock('@react-three/drei', () => ({ ContactShadows: () => null }))
vi.mock('@react-three/rapier', () => ({ Physics: ({ children }: { children?: unknown }) => children, RigidBody: ({ children }: { children?: unknown }) => children }))

import { fieldingSceneFor, GameScene, summarizeGameplay, type GameSceneResult } from '../../src/ui/GameScene'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function flush(callback: () => unknown): Promise<void> {
  flushSync(callback)
  await Promise.resolve()
}

const settings: GameSettings = {
  difficulty: 'prospect', aimAssist: true, cameraShake: .35,
  motionEffects: true, graphics: 'low', masterVolume: 0,
}

afterEach(() => { document.body.replaceChildren() })

describe('GameScene browser controls', () => {
  it('maps player positions to catcher, infield, and outfield scenes', () => {
    expect(fieldingSceneFor('C')).toBe('catcher')
    expect(fieldingSceneFor('SS')).toBe('infield')
    expect(fieldingSceneFor('CF')).toBe('outfield')
  })

  it('turns a real left-button batting input into a deterministic terminal result', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const finished: GameSceneResult[] = []
    let match = startMatch(createMatch({ id: 'browser-game', seed: 1, innings: 1 })).state
    for (let seed = 1; seed < 500; seed += 1) {
      const candidate = startMatch(createMatch({ id: 'browser-game', seed, innings: 1 })).state
      const preview = reduceMatch(candidate, { id: 1, tick: 1, type: 'gameplay/swing', payload: { swingType: 'normal', aim: { x: .056, y: -.035 }, timingSeconds: 0 } }).state
      if (preview.lastPlay?.terminal?.success) { match = candidate; break }
    }
    const root = createRoot(host)
    await flush(() => root.render(createElement(GameScene, {
      role: 'hitter', position: 'SS', settings,
      match, onCheckpoint: () => true,
      onFinish: (result: GameSceneResult) => { finished.push(result) }, onExit: () => undefined,
    })))

    const scene = host.querySelector<HTMLElement>('[data-testid="game-screen"]')!
    const completePlateAppearance = async () => {
      for (let pitch = 0; pitch < 12 && scene.dataset.scene === 'batting'; pitch += 1) {
        await flush(() => scene.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: innerWidth / 2, clientY: innerHeight / 2 })))
      }
      expect(scene.dataset.scene === 'baserunning' || scene.dataset.scene === 'infield').toBe(true)
      if (scene.dataset.scene === 'baserunning') await flush(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Space' }))
      })
      expect(scene.dataset.scene).toBe('infield')
      await flush(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Space' }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }))
      })
    }
    await completePlateAppearance()
    expect(scene.dataset.playerPlateAppearances).toBe('1')
    expect((host.querySelector('[data-testid="finish-game-button"]') as HTMLButtonElement).disabled).toBe(true)
    await completePlateAppearance()
    expect(scene.dataset.playerPlateAppearances).toBe('2')
    await completePlateAppearance()
    expect(scene.dataset.playerPlateAppearances).toBe('3')
    const terminal = host.querySelector<HTMLOutputElement>('[data-testid="gameplay-terminal"]')!
    expect(terminal.dataset.terminalId).toMatch(/^browser-game:terminal:\d+$/)
    expect(terminal.dataset.replayHash).toMatch(/^[0-9a-f]{8}$/)

    await flush(() => (host.querySelector('[data-testid="finish-game-button"]') as HTMLButtonElement).click())
    expect(finished).toHaveLength(1)
    expect(finished[0].completedScenes.filter((result) => result.scene === 'batting')).toHaveLength(3)
    expect(finished[0].matchState.phase).toBe('terminal')
    expect(finished[0].replay.commands.map((command) => command.type)).toEqual(expect.arrayContaining(['gameplay/runner-decision', 'gameplay/move-fielder', 'gameplay/throw-base']))
    expect(finished[0].performance).toBeGreaterThan(0)
    await flush(() => root.unmount())
  })

  it('produces stable aggregate hashes and distinguishes runs from outs', () => {
    const base: SceneTerminalResult = { id: 'gameplay-001-batting', scene: 'batting', success: true, runs: 0, outs: 0, summary: 'Ball put in play', replayHash: 'scene-hash' }
    const live = startMatch(createMatch({ id: 'summary-game', seed: 8, innings: 1 })).state
    const terminalMatch = reduceMatch(live, { id: 1, tick: 1, type: 'gameplay/swing', payload: { swingType: 'normal', aim: { x: 0, y: 0 }, timingSeconds: .5 } }).state
    const safe = summarizeGameplay(terminalMatch, [base])
    const scored = summarizeGameplay(terminalMatch, [{ ...base, runs: 1 }])
    const retired = summarizeGameplay(terminalMatch, [{ ...base, success: false, outs: 1 }])
    expect(summarizeGameplay(terminalMatch, [base])).toEqual(safe)
    expect(scored.performance).toBeGreaterThan(safe.performance)
    expect(retired.performance).toBeLessThan(safe.performance)
    expect(safe.replayHash).toBe(scored.replayHash)
  })

  it('restores the paused controller and UI from the authoritative match phase', async () => {
    const live = startMatch(createMatch({ id: 'paused-browser-game', seed: 19, innings: 1 })).state
    const paused = reduceMatch(live, { id: 1, tick: 1, type: 'gameplay/pause', payload: {} }).state
    const checkpoints: MatchState[] = []
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await flush(() => root.render(createElement(GameScene, {
      role: 'pitcher', position: 'starter', settings, match: paused,
      onCheckpoint: (state: MatchState) => { checkpoints.push(state); return true },
      onFinish: () => undefined, onExit: () => undefined,
    })))
    expect(host.querySelector('[data-testid="game-screen"]')?.getAttribute('data-match-phase')).toBe('paused')
    expect(host.querySelector('.pause-overlay')).not.toBeNull()
    await flush(() => (host.querySelector('button.button') as HTMLButtonElement).click())
    expect(checkpoints.at(-1)?.phase).toBe('live')
    expect(host.querySelector('.pause-overlay')).toBeNull()
    await flush(() => root.unmount())
  })
})
