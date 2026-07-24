import { describe, expect, it } from 'vitest'
import { InfieldController } from './infield-controller'
import { FieldingInputMapper } from './input'
import { OutfieldController } from './outfield-controller'

describe('fielding gameplay', () => {
  it('maps movement, sprint, catch, and base throws', () => {
    const input = new FieldingInputMapper()
    expect(input.keyDown('w')).toEqual({ type: 'move', x: 0, z: 1, sprint: false })
    expect(input.keyDown('Shift')).toEqual({ type: 'move', x: 0, z: 1, sprint: true })
    expect(input.keyDown('Space')).toEqual({ type: 'attempt-catch' })
    expect(input.keyDown('3')).toEqual({ type: 'throw-base', base: 3 })
  })

  it('resolves an infield out', () => {
    const controller = new InfieldController('infield-1', 1)
    controller.start()
    expect(controller.field({
      routeDistance: 1,
      catchTiming: 0.9,
      throwBase: 1,
      throwAccuracy: 0.9,
    })).toMatchObject({ scene: 'infield', success: true, outs: 1 })
  })

  it('resolves an outfield catch', () => {
    const controller = new OutfieldController('outfield-1')
    controller.start()
    expect(controller.field({ routeDistance: 2, catchTiming: 0.95, throwAccuracy: 0.8 }))
      .toMatchObject({ scene: 'outfield', success: true, outs: 1 })
  })
})
