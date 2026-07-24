import { describe, expect, it } from 'vitest'
import type { SceneTerminalResult } from '../contracts'
import { createMatch, createReplayBundle, startMatch } from '../domain/match'
import type { GameSceneResult } from '../ui/GameScene'
import { performanceFromGameplay } from './App'

function scene(scene: SceneTerminalResult['scene'], runs: number, summary: string): SceneTerminalResult {
  return { id: `game:${scene}:${summary}`, scene, success: true, runs, outs: 0, summary, replayHash: 'deadbeef' }
}

function result(completedScenes: readonly SceneTerminalResult[]): GameSceneResult {
  const matchState = startMatch(createMatch({ id: 'game', seed: 17, innings: 1 })).state
  matchState.score.home = 1
  const replay = createReplayBundle(matchState, 'performance-test')
  return {
    terminal: completedScenes.at(-1)!,
    completedScenes,
    performance: 81,
    replayHash: replay.finalHash,
    matchState,
    replay,
    playerTerminalIds: completedScenes.map((terminal) => terminal.id),
  }
}

describe('performanceFromGameplay', () => {
  it('counts RBI only from authoritative batting plate appearances', () => {
    const performance = performanceFromGameplay('hitter', result([
      scene('batting', 1, 'single'),
      scene('baserunning', 2, 'Runner advances safely'),
      scene('outfield', 3, 'Ball drops in the outfield'),
    ]))

    expect(performance.runsBattedIn).toBe(1)
    expect(performance.plateAppearances).toBe(1)
    expect(performance.hits).toBe(1)
  })

  it('keeps earned runs scoped to authoritative pitching terminals', () => {
    const performance = performanceFromGameplay('pitcher', result([
      scene('pitching', 2, 'out'),
      scene('catcher', 4, 'Passed ball'),
    ]))

    expect(performance.earnedRuns).toBe(2)
  })
})
