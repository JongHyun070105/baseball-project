import type { SceneTerminalResult } from '../../contracts'
import { clamp, SceneController } from '../core'

export interface OutfieldAttempt {
  routeDistance: number
  catchTiming: number
  throwAccuracy: number
}

export class OutfieldController extends SceneController {
  constructor(id: string, private readonly maximumRouteDistance = 25) {
    super(id, 'outfield')
  }

  field(attempt: OutfieldAttempt): SceneTerminalResult {
    const routeAccuracy = clamp(1 - attempt.routeDistance / this.maximumRouteDistance)
    const catchScore = (routeAccuracy + clamp(attempt.catchTiming)) / 2
    const caught = catchScore >= 0.58
    const heldRunner = caught && attempt.throwAccuracy >= 0.45
    return this.finish({
      success: caught,
      runs: caught ? 0 : 1,
      outs: caught ? 1 : 0,
      summary: caught
        ? heldRunner ? 'Fly ball caught and runners held' : 'Fly ball caught'
        : 'Ball drops in the outfield',
    })
  }
}
