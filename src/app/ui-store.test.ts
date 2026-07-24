import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameSettings } from '../contracts'

class TestStorage implements Storage {
  readonly values = new Map<string, string>()
  throwOnRead = false
  throwOnWrite = false

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    if (this.throwOnRead) throw new DOMException('blocked', 'SecurityError')
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    if (this.throwOnWrite) throw new DOMException('full', 'QuotaExceededError')
    this.values.set(key, value)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('UI settings persistence', () => {
  it('validates each persisted field, clamps numeric ranges, and strips unknown data', async () => {
    const storage = new TestStorage()
    storage.setItem('diamond-road:settings', JSON.stringify({
      difficulty: 'impossible',
      aimAssist: 'yes',
      cameraShake: 4,
      motionEffects: false,
      graphics: 'ultra',
      masterVolume: -2,
      injected: true,
    }))
    vi.stubGlobal('localStorage', storage)

    const { useUiStore } = await import('./ui-store')

    expect(useUiStore.getState().settings).toEqual({
      difficulty: 'prospect',
      aimAssist: true,
      cameraShake: 1,
      motionEffects: false,
      graphics: 'high',
      masterVolume: 0,
    })
    expect(useUiStore.getState().settings).not.toHaveProperty('injected')
  })

  it('prevents a bogus difficulty from reaching the gameplay-facing store state', async () => {
    const storage = new TestStorage()
    storage.setItem('diamond-road:settings', JSON.stringify({ difficulty: 'nightmare' }))
    vi.stubGlobal('localStorage', storage)
    const { DIFFICULTY_LABEL, useUiStore } = await import('./ui-store')

    expect(useUiStore.getState().settings.difficulty).toBe('prospect')
    expect(DIFFICULTY_LABEL[useUiStore.getState().settings.difficulty]).toBe('프로스펙트')

    useUiStore.getState().updateSettings({ difficulty: 'nightmare' } as unknown as Partial<GameSettings>)

    expect(useUiStore.getState().settings.difficulty).toBe('prospect')
    expect(JSON.parse(storage.getItem('diamond-road:settings') as string)).toMatchObject({ difficulty: 'prospect' })
  })

  it('falls back to defaults when localStorage reads or JSON parsing fail', async () => {
    const storage = new TestStorage()
    storage.throwOnRead = true
    vi.stubGlobal('localStorage', storage)

    let module = await import('./ui-store')
    expect(module.useUiStore.getState().settings).toEqual(module.DEFAULT_SETTINGS)

    vi.resetModules()
    storage.throwOnRead = false
    storage.setItem('diamond-road:settings', '{broken')
    module = await import('./ui-store')
    expect(module.useUiStore.getState().settings).toEqual(module.DEFAULT_SETTINGS)
  })

  it('keeps validated in-memory settings when localStorage writes fail', async () => {
    const storage = new TestStorage()
    storage.throwOnWrite = true
    vi.stubGlobal('localStorage', storage)
    const { useUiStore } = await import('./ui-store')

    expect(() => useUiStore.getState().updateSettings({ cameraShake: 2, masterVolume: 0.25 })).not.toThrow()
    expect(useUiStore.getState().settings.cameraShake).toBe(1)
    expect(useUiStore.getState().settings.masterVolume).toBe(0.25)
  })
})
