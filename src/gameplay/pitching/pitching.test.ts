import { describe, expect, it } from 'vitest'
import { PitchingController } from './controller'
import { PitchingInputMapper } from './input'

describe('pitching gameplay', () => {
  it('builds a pitch from number, target, hold gesture, and release', () => {
    const input = new PitchingInputMapper()
    expect(input.selectPitch('4')).toBe('slider')
    input.setTarget(0.05, -0.05)
    input.beginGesture(0, 0, 1_000)
    input.updateGesture(0.25, 0, 1_300)
    const command = input.releaseGesture(0.5, 0, 1_650)
    expect(command).toMatchObject({ pitchType: 'slider', releaseAccuracy: 1 })

    const controller = new PitchingController('pitch-1')
    controller.start()
    const result = controller.pitch(command!)
    expect(result).toMatchObject({ scene: 'pitching', success: true, outs: 1 })
  })
})
