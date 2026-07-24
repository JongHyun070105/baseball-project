import type { PitchCommand, PitchType } from '../../contracts'
import { clamp, distance2d, normalizeKey } from '../core'

const PITCH_KEYS: Readonly<Record<string, PitchType>> = {
  '1': 'four-seam',
  '2': 'two-seam',
  '3': 'changeup',
  '4': 'slider',
  '5': 'curveball',
}

export function mapPitchSelectionKey(key: string): PitchType | undefined {
  return PITCH_KEYS[normalizeKey(key)]
}

interface GestureSample {
  x: number
  y: number
  timeMs: number
}

export class PitchingInputMapper {
  private pitchType: PitchType = 'four-seam'
  private target = { x: 0, y: 0 }
  private gesture: GestureSample[] = []

  selectPitch(key: string): PitchType | undefined {
    const selected = mapPitchSelectionKey(key)
    if (selected) this.pitchType = selected
    return selected
  }

  setTarget(x: number, y: number): Readonly<{ x: number; y: number }> {
    this.target = { x, y }
    return this.target
  }

  beginGesture(x: number, y: number, timeMs: number): void {
    this.gesture = [{ x, y, timeMs }]
  }

  updateGesture(x: number, y: number, timeMs: number): void {
    if (!this.gesture.length) return
    this.gesture.push({ x, y, timeMs })
  }

  releaseGesture(x: number, y: number, timeMs: number): PitchCommand | undefined {
    if (!this.gesture.length) return undefined
    this.gesture.push({ x, y, timeMs })
    const first = this.gesture[0]
    const last = this.gesture[this.gesture.length - 1]
    let pathLength = 0
    for (let index = 1; index < this.gesture.length; index += 1) {
      pathLength += distance2d(this.gesture[index - 1], this.gesture[index])
    }
    const directLength = distance2d(first, last)
    const pathEfficiency = pathLength === 0 ? 0 : directLength / pathLength
    const gestureDistance = clamp(directLength / 0.45)
    const holdSeconds = Math.max(0, last.timeMs - first.timeMs) / 1_000
    const releaseAccuracy = clamp(1 - Math.abs(holdSeconds - 0.65) / 0.65)
    const command: PitchCommand = {
      pitchType: this.pitchType,
      target: { ...this.target },
      gestureAccuracy: clamp(pathEfficiency * gestureDistance),
      releaseAccuracy,
    }
    this.gesture = []
    return command
  }
}
