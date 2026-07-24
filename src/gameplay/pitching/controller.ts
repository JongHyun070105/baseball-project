import type { PitchCommand, SceneTerminalResult } from '../../contracts'
import { clamp, SceneController } from '../core'

export class PitchingController extends SceneController {
  constructor(id: string) {
    super(id, 'pitching')
  }

  pitch(command: PitchCommand): SceneTerminalResult {
    const targetAccuracy = clamp(1 - Math.hypot(command.target.x, command.target.y) / Math.SQRT2)
    const execution = (
      targetAccuracy + clamp(command.gestureAccuracy) + clamp(command.releaseAccuracy)
    ) / 3
    const success = execution >= 0.66
    return this.finish({
      success,
      runs: success ? 0 : execution < 0.3 ? 1 : 0,
      outs: success ? 1 : 0,
      summary: success ? `${command.pitchType} located for an out` : 'Pitch missed its spot',
    })
  }
}
