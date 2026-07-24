import type { Difficulty, HitterPosition, PitcherRole, PlayerRole } from './gameplay'

export type RegionId = 'capital' | 'west-coast' | 'central' | 'southwest' | 'southeast' | 'islands'

export interface SchoolProfile {
  id: string
  name: string
  region: RegionId
  playable: boolean
  primary: string
  secondary: string
  teamPower: number
  growth: number
  competition: number
  coachStyle: string
  motto: string
}

export interface PlayerArchetype {
  id: string
  label: string
  role: PlayerRole
  growthBias: string
}

export interface RosterPlayer {
  id: string
  name: string
  role: PlayerRole
  position: HitterPosition | PitcherRole
  overall: number
  year: 1 | 2 | 3
  archetypeId: string
}

export interface CareerEventTemplate {
  id: string
  category: 'academic' | 'relationship' | 'health' | 'morale' | 'competition'
  title: string
  body: string
  choices: readonly { id: string; label: string; effect: string }[]
}

export interface PresentationManifest {
  screens: readonly string[]
  cameraCues: readonly string[]
  animationStates: readonly string[]
  audioCues: readonly string[]
  difficulties: readonly Difficulty[]
}
