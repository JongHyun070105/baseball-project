import { describe, expect, it } from 'vitest'
import { BattingController } from './controller'
import { createSwingCommand, mapBattingKey, mapBattingPointerButton } from './input'

describe('batting gameplay', () => {
  it('maps controls and resolves a well-timed swing deterministically', () => {
    expect(mapBattingPointerButton(0)).toEqual({ type: 'swing', swingType: 'normal' })
    expect(mapBattingPointerButton(2)).toEqual({ type: 'swing', swingType: 'contact' })
    expect(mapBattingKey('Space')).toEqual({ type: 'swing', swingType: 'power' })
    expect(mapBattingKey('b')).toEqual({ type: 'bunt' })
    expect(mapBattingKey('t')).toEqual({ type: 'request-time' })

    const play = (): ReturnType<BattingController['swing']> => {
      const controller = new BattingController('bat-1', {
        pitchLocation: { x: 0.2, y: -0.1 },
        perfectTimingSeconds: 0.5,
      })
      controller.start()
      controller.toggleHelp()
      expect(controller.snapshot().phase).toBe('paused')
      controller.toggleHelp()
      return controller.swing(createSwingCommand('normal', { x: 0.2, y: -0.1 }, 0.5))
    }

    expect(play()).toEqual(play())
    expect(play()).toMatchObject({ success: true, scene: 'batting', outs: 0 })
  })
})
