import type { SceneTerminalResult } from '../../contracts'
import { stateHash } from '../../domain/core/hash'

export type GameplayScene = SceneTerminalResult['scene']
export type ScenePhase = 'ready' | 'live' | 'paused' | 'terminal'

export interface SceneControllerSnapshot {
  readonly id: string
  readonly scene: GameplayScene
  readonly phase: ScenePhase
  readonly helpVisible: boolean
  readonly result?: SceneTerminalResult
}

export abstract class SceneController {
  private phase: ScenePhase = 'ready'
  private helpVisible = false
  private pausedForHelp = false
  private result?: SceneTerminalResult

  protected constructor(
    readonly id: string,
    readonly scene: GameplayScene,
  ) {}

  start(): void {
    if (this.phase !== 'ready') throw new Error(`Cannot start ${this.scene} from ${this.phase}`)
    this.phase = 'live'
  }

  pause(): void {
    if (this.phase !== 'live') throw new Error(`Cannot pause ${this.scene} from ${this.phase}`)
    this.pausedForHelp = false
    this.phase = 'paused'
  }

  resume(): void {
    if (this.phase !== 'paused' || this.helpVisible) {
      throw new Error(`Cannot resume ${this.scene} while it is not manually paused`)
    }
    this.phase = 'live'
  }

  toggleHelp(): boolean {
    if (this.phase === 'terminal') return this.helpVisible
    this.helpVisible = !this.helpVisible
    if (this.helpVisible && this.phase === 'live') {
      this.pausedForHelp = true
      this.phase = 'paused'
    } else if (!this.helpVisible && this.phase === 'paused' && this.pausedForHelp) {
      this.pausedForHelp = false
      this.phase = 'live'
    }
    return this.helpVisible
  }

  snapshot(): SceneControllerSnapshot {
    return {
      id: this.id,
      scene: this.scene,
      phase: this.phase,
      helpVisible: this.helpVisible,
      ...(this.result ? { result: this.result } : {}),
    }
  }

  protected assertLive(): void {
    if (this.phase !== 'live') throw new Error(`${this.scene} controller is not live`)
  }

  protected finish(outcome: Omit<SceneTerminalResult, 'id' | 'scene' | 'replayHash'>): SceneTerminalResult {
    this.assertLive()
    const payload = { id: this.id, scene: this.scene, ...outcome }
    this.result = { ...payload, replayHash: stateHash(payload) }
    this.phase = 'terminal'
    this.helpVisible = false
    this.pausedForHelp = false
    return this.result
  }
}
