import { create } from 'zustand'
import { z } from 'zod'
import type { Difficulty, GameSettings, HitterPosition, PitcherRole, PlayerRole } from '../contracts'

export type AppScreen = 'title' | 'creation' | 'hub' | 'records' | 'settings' | 'saves' | 'game' | 'result' | 'draft'
export type CreationPosition = HitterPosition | PitcherRole

export interface UiPlayer {
  name: string
  role: PlayerRole
  position: CreationPosition
  schoolId: string
}

interface UiState {
  screen: AppScreen
  player: UiPlayer
  settings: GameSettings
  setScreen: (screen: AppScreen) => void
  updatePlayer: (patch: Partial<UiPlayer>) => void
  updateSettings: (patch: Partial<GameSettings>) => void
}

export const DEFAULT_SETTINGS: Readonly<GameSettings> = {
  difficulty: 'prospect',
  aimAssist: true,
  cameraShake: 0.35,
  motionEffects: true,
  graphics: 'high',
  masterVolume: 0.75,
}

const normalizedSettingsSchema = z.preprocess(
  (value) => typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {},
  z.object({
    difficulty: z.enum(['rookie', 'prospect', 'legend']).catch(DEFAULT_SETTINGS.difficulty).default(DEFAULT_SETTINGS.difficulty),
    aimAssist: z.boolean().catch(DEFAULT_SETTINGS.aimAssist).default(DEFAULT_SETTINGS.aimAssist),
    cameraShake: z.number().finite().transform(clampUnit).catch(DEFAULT_SETTINGS.cameraShake).default(DEFAULT_SETTINGS.cameraShake),
    motionEffects: z.boolean().catch(DEFAULT_SETTINGS.motionEffects).default(DEFAULT_SETTINGS.motionEffects),
    graphics: z.enum(['low', 'medium', 'high']).catch(DEFAULT_SETTINGS.graphics).default(DEFAULT_SETTINGS.graphics),
    masterVolume: z.number().finite().transform(clampUnit).catch(DEFAULT_SETTINGS.masterVolume).default(DEFAULT_SETTINGS.masterVolume),
  }),
)

export function normalizeSettings(value: unknown): GameSettings {
  return normalizedSettingsSchema.parse(value)
}

function initialSettings(): GameSettings {
  try {
    const serialized = globalThis.localStorage?.getItem('diamond-road:settings')
    return normalizeSettings(serialized === null || serialized === undefined ? {} : JSON.parse(serialized))
  } catch {
    return normalizeSettings({})
  }
}

export const useUiStore = create<UiState>((set) => ({
  screen: 'title',
  player: { name: '강현우', role: 'hitter', position: 'SS', schoolId: 'seorin' },
  settings: initialSettings(),
  setScreen: (screen) => set({ screen }),
  updatePlayer: (patch) => set((state) => ({ player: { ...state.player, ...patch } })),
  updateSettings: (patch) => set((state) => {
    const settings = normalizeSettings({ ...state.settings, ...patch })
    try {
      globalThis.localStorage?.setItem('diamond-road:settings', JSON.stringify(settings))
    } catch {
      // Settings still apply for this session when persistence is unavailable.
    }
    return { settings }
  }),
}))

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  rookie: '루키',
  prospect: '프로스펙트',
  legend: '레전드',
}
