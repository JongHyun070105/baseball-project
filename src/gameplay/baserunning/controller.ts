import type { RunnerDecision, SceneTerminalResult } from '../../contracts'
import { SceneController } from '../core'

export interface BaserunningOpportunity {
  distanceMeters: number
  availableSeconds: number
}

export class BaserunningController extends SceneController {
  constructor(id: string, private readonly opportunity: BaserunningOpportunity) {
    super(id, 'baserunning')
  }

  run(decision: RunnerDecision): SceneTerminalResult {
    if (decision.direction === 'hold') {
      return this.finish({ success: true, runs: 0, outs: 0, summary: 'Runner holds the base' })
    }
    if (decision.direction === 'retreat') {
      const success = this.opportunity.availableSeconds >= 0.75
      return this.finish({
        success,
        runs: 0,
        outs: success ? 0 : 1,
        summary: success ? 'Runner returns safely' : 'Runner doubled off',
      })
    }
    const speedMetersPerSecond = decision.sprint ? 8.2 : 6.6
    const slideAdjustment = decision.slide ? -0.12 : 0.08
    const arrivalSeconds = this.opportunity.distanceMeters / speedMetersPerSecond + slideAdjustment
    const success = arrivalSeconds <= this.opportunity.availableSeconds
    return this.finish({
      success,
      runs: success && this.opportunity.distanceMeters >= 25 ? 1 : 0,
      outs: success ? 0 : 1,
      summary: success ? 'Runner advances safely' : 'Runner is tagged out',
    })
  }
}
