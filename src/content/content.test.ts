import { describe, expect, it } from 'vitest'
import {
  CAREER_EVENTS,
  HITTER_POSITIONS,
  PLAYER_ARCHETYPES,
  PLAYABLE_SCHOOLS,
  PRESENTATION_MANIFEST,
  PITCHER_ROLES,
  ROSTERS,
  SCHOOLS,
  createRoster,
} from './index'

describe('Diamond Road original content', () => {
  it('preserves six regions and exactly 16 fictional schools with six playable choices', () => {
    expect(SCHOOLS).toHaveLength(16)
    expect(PLAYABLE_SCHOOLS).toHaveLength(6)
    expect(new Set(SCHOOLS.map((school) => school.id)).size).toBe(16)
    expect(new Set(SCHOOLS.map((school) => school.name)).size).toBe(16)
    expect(new Set(SCHOOLS.map((school) => school.region))).toEqual(
      new Set(['capital', 'west-coast', 'central', 'southwest', 'southeast', 'islands']),
    )
    expect(SCHOOLS.every((school) => school.motto.length > 5 && school.coachStyle.length > 4)).toBe(true)
  })

  it('builds a stable, unique 18-player roster for every school', () => {
    const allIds = new Set<string>()
    for (const school of SCHOOLS) {
      const roster = ROSTERS[school.id]
      expect(roster).toHaveLength(18)
      expect(roster).toEqual(createRoster(school.id))
      expect(new Set(roster.map((player) => player.name)).size).toBe(18)
      expect(roster.filter((player) => player.role === 'pitcher')).toHaveLength(6)
      for (const player of roster) {
        allIds.add(player.id)
        expect(PLAYER_ARCHETYPES.some((archetype) => archetype.id === player.archetypeId)).toBe(true)
      }
    }
    expect(allIds.size).toBe(16 * 18)
  })

  it('provides at least 40 actionable event templates across every category', () => {
    const effectDescriptor = /^(academics|condition|growth|relationship|coachTrust|morale|scouting|injury|injuryRisk|stamina|movement)[+-][1-9]\d*(,(academics|condition|growth|relationship|coachTrust|morale|scouting|injury|injuryRisk|stamina|movement)[+-][1-9]\d*)*$/

    expect(CAREER_EVENTS.length).toBeGreaterThanOrEqual(40)
    expect(new Set(CAREER_EVENTS.map((event) => event.id)).size).toBe(CAREER_EVENTS.length)
    expect(new Set(CAREER_EVENTS.map((event) => event.category))).toEqual(
      new Set(['academic', 'relationship', 'health', 'morale', 'competition']),
    )
    for (const event of CAREER_EVENTS) {
      expect(event.choices).toHaveLength(2)
      expect(new Set(event.choices.map((choice) => choice.id)).size).toBe(event.choices.length)
      expect(event.choices.every((choice) => effectDescriptor.test(choice.effect))).toBe(true)
      expect(event.choices[0]?.effect).not.toBe(event.choices[1]?.effect)
    }
  })

  it('covers every supported position and both career roles with archetypes', () => {
    expect(HITTER_POSITIONS).toEqual(['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'])
    expect(PITCHER_ROLES).toEqual(['starter', 'reliever'])
    expect(PLAYER_ARCHETYPES).toHaveLength(12)
    expect(new Set(PLAYER_ARCHETYPES.map((entry) => entry.id)).size).toBe(12)
    expect(PLAYER_ARCHETYPES.filter((entry) => entry.role === 'hitter').length).toBeGreaterThanOrEqual(6)
    expect(PLAYER_ARCHETYPES.filter((entry) => entry.role === 'pitcher').length).toBeGreaterThanOrEqual(6)
  })

  it('defines unique procedural presentation cue identifiers without claiming audio assets', () => {
    const identifier = /^[a-z]+(?:-[a-z]+)*$/
    const collections = [
      PRESENTATION_MANIFEST.screens,
      PRESENTATION_MANIFEST.cameraCues,
      PRESENTATION_MANIFEST.animationStates,
      PRESENTATION_MANIFEST.audioCues,
    ]

    expect(PRESENTATION_MANIFEST.cameraCues.length).toBeGreaterThanOrEqual(12)
    expect(PRESENTATION_MANIFEST.animationStates.length).toBeGreaterThanOrEqual(10)
    expect(PRESENTATION_MANIFEST.audioCues.length).toBeGreaterThanOrEqual(16)
    expect(PRESENTATION_MANIFEST.difficulties).toEqual(['rookie', 'prospect', 'legend'])
    for (const entries of collections) {
      expect(new Set(entries).size).toBe(entries.length)
      expect(entries.every((entry) => identifier.test(entry))).toBe(true)
    }
  })
})
