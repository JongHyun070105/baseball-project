import { normalizeKey } from '../core'

export type FieldingInputAction =
  | { type: 'move'; x: number; z: number; sprint: boolean }
  | { type: 'attempt-catch' }
  | { type: 'throw-base'; base: 1 | 2 | 3 | 4 }

const MOVEMENT_KEYS = new Set(['w', 'a', 's', 'd', 'Shift'])

export class FieldingInputMapper {
  private readonly held = new Set<string>()

  keyDown(key: string): FieldingInputAction | undefined {
    const normalized = normalizeKey(key)
    if (MOVEMENT_KEYS.has(normalized)) {
      this.held.add(normalized)
      return this.movement()
    }
    if (normalized === ' ' || normalized === 'Space') return { type: 'attempt-catch' }
    if (normalized === '1' || normalized === '2' || normalized === '3' || normalized === '4') {
      return { type: 'throw-base', base: Number(normalized) as 1 | 2 | 3 | 4 }
    }
    return undefined
  }

  keyUp(key: string): FieldingInputAction | undefined {
    const normalized = normalizeKey(key)
    if (!MOVEMENT_KEYS.has(normalized)) return undefined
    this.held.delete(normalized)
    return this.movement()
  }

  movement(): FieldingInputAction {
    return {
      type: 'move',
      x: Number(this.held.has('d')) - Number(this.held.has('a')),
      z: Number(this.held.has('w')) - Number(this.held.has('s')),
      sprint: this.held.has('Shift'),
    }
  }
}
