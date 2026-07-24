import type { HitterPosition, PitcherRole, PlayerArchetype } from '../contracts'

export const HITTER_POSITIONS: readonly HitterPosition[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
export const PITCHER_ROLES: readonly PitcherRole[] = ['starter', 'reliever']

export const PLAYER_ARCHETYPES: readonly PlayerArchetype[] = [
  { id: 'table-setter', label: '길을 여는 출루형', role: 'hitter', growthBias: 'contact,speed' },
  { id: 'slugger', label: '담장을 노리는 거포', role: 'hitter', growthBias: 'power' },
  { id: 'field-general', label: '수비를 지휘하는 야전사령관', role: 'hitter', growthBias: 'fielding,contact' },
  { id: 'five-tool', label: '빈틈 없는 오각형', role: 'hitter', growthBias: 'balanced' },
  { id: 'sparkplug', label: '흐름을 바꾸는 질주자', role: 'hitter', growthBias: 'speed,contact' },
  { id: 'gap-hunter', label: '외야의 틈을 가르는 중거리형', role: 'hitter', growthBias: 'contact,power,speed' },
  { id: 'power-ace', label: '힘으로 누르는 정통파', role: 'pitcher', growthBias: 'velocity,stamina' },
  { id: 'command-artist', label: '모서리를 그리는 제구형', role: 'pitcher', growthBias: 'command,movement' },
  { id: 'breaking-ball', label: '궤적을 숨기는 변화구형', role: 'pitcher', growthBias: 'movement' },
  { id: 'iron-arm', label: '긴 이닝을 버티는 이닝이터', role: 'pitcher', growthBias: 'stamina,command' },
  { id: 'fireman', label: '위기를 끄는 불펜 에이스', role: 'pitcher', growthBias: 'velocity,movement' },
  { id: 'tempo-breaker', label: '타자의 박자를 빼앗는 완급형', role: 'pitcher', growthBias: 'command,movement,stamina' },
] as const

export function archetypesForRole(role: PlayerArchetype['role']): readonly PlayerArchetype[] {
  return PLAYER_ARCHETYPES.filter((entry) => entry.role === role)
}
