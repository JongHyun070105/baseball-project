import { describe, expect, it } from 'vitest'
import { BaserunningController } from './controller'
import { BaserunningInputMapper } from './input'

describe('baserunning gameplay', () => {
  it('maps advance, sprint, and slide into a safe advance', () => {
    const input = new BaserunningInputMapper()
    input.keyDown('w')
    input.keyDown('Shift')
    const decision = input.keyDown('Space')
    expect(decision).toEqual({ direction: 'advance', sprint: true, slide: true })

    const controller = new BaserunningController('run-1', {
      distanceMeters: 20,
      availableSeconds: 2.5,
    })
    controller.start()
    expect(controller.run(decision!)).toMatchObject({
      scene: 'baserunning', success: true, outs: 0,
    })
  })
})
