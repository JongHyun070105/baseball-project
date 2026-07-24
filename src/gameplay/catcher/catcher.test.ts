import { describe, expect, it } from 'vitest'
import { CatcherController } from './controller'

describe('catcher gameplay', () => {
  it('blocks a pitch with a quick accurate reaction', () => {
    const controller = new CatcherController('catch-1', 1)
    controller.start()
    expect(controller.receive({ reactionSeconds: 0.2, gloveAccuracy: 0.9 })).toMatchObject({
      scene: 'catcher', success: true, runs: 0, outs: 1,
    })
  })
})
