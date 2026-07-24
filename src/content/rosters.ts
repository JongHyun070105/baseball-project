import type { RosterPlayer } from '../contracts'
import { SeededRng, deriveSeed } from '../domain/core/rng'
import { PLAYER_ARCHETYPES } from './archetypes'
import { SCHOOLS } from './schools'

const FAMILY_NAMES = ['강', '고', '권', '김', '남', '도', '류', '문', '박', '배', '서', '성', '송', '신', '안', '오', '우', '유', '윤', '이', '임', '장', '전', '정', '조', '차', '최', '하', '한', '홍'] as const
const GIVEN_NAMES = ['건우', '규민', '도윤', '동현', '민재', '범준', '선우', '성호', '시우', '연호', '예준', '우진', '재하', '정민', '준서', '지환', '찬영', '태경', '하준', '현우'] as const
const POSITION_PLAN = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'C', '2B', 'SS', 'CF', 'starter', 'starter', 'starter', 'reliever', 'reliever', 'reliever'] as const

function textSeed(value: string): number {
  let hash = 0x811c9dc5
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
  return hash >>> 0 || 1
}

export function createRoster(schoolId: string): readonly RosterPlayer[] {
  const school = SCHOOLS.find((entry) => entry.id === schoolId)
  if (!school) throw new Error(`Unknown school: ${schoolId}`)
  const rng = new SeededRng(deriveSeed(textSeed(schoolId), 'ai'))
  const usedNames = new Set<string>()

  const nextUniqueName = (): string => {
    for (;;) {
      const candidate = `${rng.pick(FAMILY_NAMES)}${rng.pick(GIVEN_NAMES)}`
      if (!usedNames.has(candidate)) return candidate
    }
  }

  return POSITION_PLAN.map((position, index) => {
    const name = nextUniqueName()
    usedNames.add(name)
    const role = position === 'starter' || position === 'reliever' ? 'pitcher' : 'hitter'
    const archetypes = PLAYER_ARCHETYPES.filter((entry) => entry.role === role)
    const year = ((index + rng.integer(0, 2)) % 3 + 1) as 1 | 2 | 3
    const variance = rng.integer(-8, 8)
    const seniority = (year - 2) * 2
    return {
      id: `${schoolId}-${String(index + 1).padStart(2, '0')}`,
      name,
      role,
      position,
      overall: Math.max(48, Math.min(94, Math.round(school.teamPower * 0.72 + 17 + variance + seniority))),
      year,
      archetypeId: rng.pick(archetypes).id,
    }
  })
}

export const ROSTERS: Readonly<Record<string, readonly RosterPlayer[]>> = Object.freeze(
  Object.fromEntries(SCHOOLS.map((school) => [school.id, createRoster(school.id)])),
)
