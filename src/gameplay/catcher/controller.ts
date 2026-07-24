import type { SceneTerminalResult } from '../../contracts'
import { clamp, SceneController } from '../core'

export interface CatcherAttempt {
  reactionSeconds: number
  gloveAccuracy: number
}

export class CatcherController extends SceneController {
  constructor(id: string, private readonly timeLimitSeconds = 0.8) {
    super(id, 'catcher')
  }

  receive(attempt: CatcherAttempt): SceneTerminalResult {
    const reaction = clamp(1 - attempt.reactionSeconds / this.timeLimitSeconds)
    const execution = (reaction + clamp(attempt.gloveAccuracy)) / 2
    const success = execution >= 0.55
    return this.finish({
      success,
      runs: success ? 0 : 1,
      outs: success ? 1 : 0,
      summary: success ? 'Pitch blocked and secured' : 'Passed ball',
    })
  }
}
