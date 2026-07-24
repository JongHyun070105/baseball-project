import type { RunnerDecision } from '../../contracts'
import { normalizeKey } from '../core'

const RUNNER_KEYS = new Set(['w', 's', 'Shift', ' ', 'Space'])

export class BaserunningInputMapper {
  private readonly held = new Set<string>()

  keyDown(key: string): RunnerDecision | undefined {
    const normalized = normalizeKey(key)
    if (!RUNNER_KEYS.has(normalized)) return undefined
    this.held.add(normalized)
    return this.decision()
  }

  keyUp(key: string): RunnerDecision | undefined {
    const normalized = normalizeKey(key)
    if (!RUNNER_KEYS.has(normalized)) return undefined
    this.held.delete(normalized)
    return this.decision()
  }

  decision(): RunnerDecision {
    const advancing = this.held.has('w')
    const retreating = this.held.has('s')
    return {
      direction: advancing === retreating ? 'hold' : advancing ? 'advance' : 'retreat',
      sprint: this.held.has('Shift'),
      slide: this.held.has(' ') || this.held.has('Space'),
    }
  }
}
