import type { SceneTerminalResult } from '../../contracts'
import { clamp, SceneController } from '../core'

export interface InfieldAttempt {
  routeDistance: number
  catchTiming: number
  throwBase: 1 | 2 | 3 | 4
  throwAccuracy: number
}

export class InfieldController extends SceneController {
  constructor(id: string, private readonly requiredBase: 1 | 2 | 3 | 4) {
    super(id, 'infield')
  }

  field(attempt: InfieldAttempt): SceneTerminalResult {
    const routeAccuracy = clamp(1 - attempt.routeDistance / 12)
    const execution = (routeAccuracy + clamp(attempt.catchTiming) + clamp(attempt.throwAccuracy)) / 3
    const success = attempt.throwBase === this.requiredBase && execution >= 0.62
    return this.finish({
      success,
      runs: 0,
      outs: success ? 1 : 0,
      summary: success ? `Ground ball retired at base ${attempt.throwBase}` : 'Runner beats the infield play',
    })
  }
}
