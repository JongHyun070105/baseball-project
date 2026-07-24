export type RngStreamName = 'career' | 'schedule' | 'match' | 'ai' | 'presentation'

export interface RngSnapshot {
  seed: number
  state: number
}

export class SeededRng {
  private state: number

  constructor(readonly seed: number, state = seed) {
    this.state = state >>> 0
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let value = this.state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }

  integer(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  pick<T>(items: readonly T[]): T {
    if (!items.length) throw new Error('Cannot pick from an empty collection')
    return items[Math.floor(this.next() * items.length)]
  }

  snapshot(): RngSnapshot {
    return { seed: this.seed, state: this.state }
  }
}

export function deriveSeed(rootSeed: number, stream: RngStreamName): number {
  let hash = rootSeed >>> 0
  for (const character of stream) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619) >>> 0
  }
  return hash || 1
}

export function createRngStreams(rootSeed: number): Record<RngStreamName, SeededRng> {
  return {
    career: new SeededRng(deriveSeed(rootSeed, 'career')),
    schedule: new SeededRng(deriveSeed(rootSeed, 'schedule')),
    match: new SeededRng(deriveSeed(rootSeed, 'match')),
    ai: new SeededRng(deriveSeed(rootSeed, 'ai')),
    presentation: new SeededRng(deriveSeed(rootSeed, 'presentation')),
  }
}
