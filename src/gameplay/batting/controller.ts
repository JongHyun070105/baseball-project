import type { SceneTerminalResult, SwingCommand } from '../../contracts'
import { clamp, distance2d, SceneController } from '../core'

export interface BattingChallenge {
  pitchLocation: { x: number; y: number }
  perfectTimingSeconds: number
}

const SWING_BONUS = { contact: 0.1, normal: 0, power: -0.08 } as const

export class BattingController extends SceneController {
  private timeRequested = false

  constructor(id: string, private readonly challenge: BattingChallenge) {
    super(id, 'batting')
  }

  requestTime(): boolean {
    this.assertLive()
    this.timeRequested = true
    return this.timeRequested
  }

  consumeTimeRequest(): boolean {
    const requested = this.timeRequested
    this.timeRequested = false
    return requested
  }

  swing(command: SwingCommand): SceneTerminalResult {
    const locationAccuracy = clamp(1 - distance2d(command.aim, this.challenge.pitchLocation))
    const timingAccuracy = clamp(1 - Math.abs(command.timingSeconds - this.challenge.perfectTimingSeconds) / 0.35)
    const quality = clamp((locationAccuracy + timingAccuracy) / 2 + SWING_BONUS[command.swingType])
    const success = quality >= 0.62
    const homeRun = success && command.swingType === 'power' && quality >= 0.88
    return this.finish({
      success,
      runs: homeRun ? 1 : 0,
      outs: success ? 0 : 1,
      summary: homeRun ? 'Home run' : success ? 'Ball put in play' : 'Swing and miss',
    })
  }

  bunt(aim: Readonly<{ x: number; y: number }>): SceneTerminalResult {
    const accuracy = clamp(1 - distance2d(aim, this.challenge.pitchLocation))
    const success = accuracy >= 0.72
    return this.finish({
      success,
      runs: 0,
      outs: success ? 0 : 1,
      summary: success ? 'Bunt placed safely' : 'Bunt retired',
    })
  }
}
