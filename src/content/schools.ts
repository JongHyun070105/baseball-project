import type { RegionId, SchoolProfile } from '../contracts'

const school = (
  id: string,
  name: string,
  region: RegionId,
  playable: boolean,
  primary: string,
  secondary: string,
  teamPower: number,
  growth: number,
  competition: number,
  coachStyle: string,
  motto: string,
): SchoolProfile => ({
  id,
  name,
  region,
  playable,
  primary,
  secondary,
  teamPower,
  growth,
  competition,
  coachStyle,
  motto,
})

/** Six playable programs and ten rivals, all original to Diamond Road. */
export const SCHOOLS: readonly SchoolProfile[] = [
  school('seorin', '서린고', 'capital', true, '#173B74', '#E9B949', 78, 82, 76, '기본기와 책임 야구', '끝까지 한 베이스 더'),
  school('hangyeol', '한결고', 'west-coast', true, '#0B5D4B', '#F4E3B2', 73, 88, 68, '긴 호흡의 육성', '흔들려도 흐트러지지 않는다'),
  school('mireu', '미르공고', 'central', true, '#7A2431', '#D7D7D7', 84, 70, 90, '치열한 실전 경쟁', '쇳소리처럼 단단하게'),
  school('cheongram', '청람고', 'southwest', true, '#126E82', '#F3C969', 75, 85, 72, '데이터와 자율 훈련', '푸른 파도는 멈추지 않는다'),
  school('haeoreum', '해오름고', 'southeast', true, '#E65F2B', '#192A56', 81, 76, 84, '공격적인 승부', '먼저 뜨고 오래 빛난다'),
  school('baram', '바람고', 'islands', true, '#276749', '#E8F1F2', 69, 92, 61, '개성 중심의 성장', '바람은 길을 묻지 않는다'),
  school('gwangjin', '광진상고', 'capital', false, '#4527A0', '#FFC107', 91, 65, 95, '결과 중심의 강훈련', '우승은 습관이다'),
  school('baeksae', '백새고', 'west-coast', false, '#FAFAFA', '#263238', 77, 79, 78, '수비와 주루 완성', '빈틈 없는 아홉 칸'),
  school('seongun', '성운고', 'central', false, '#283593', '#90CAF9', 88, 74, 89, '투수 왕국', '별보다 높은 마운드'),
  school('maehwa', '매화고', 'southwest', false, '#AD1457', '#F8BBD0', 72, 86, 66, '인내와 팀워크', '추위 끝에 피는 야구'),
  school('geumgang', '금강고', 'southeast', false, '#F9A825', '#212121', 86, 72, 88, '장타와 강속구', '정면으로 부딪쳐라'),
  school('pureun-sol', '푸른솔고', 'islands', false, '#00695C', '#B2DFDB', 70, 89, 64, '멘탈과 회복', '뿌리 깊은 승부'),
  school('eunha', '은하고', 'capital', false, '#37474F', '#CFD8DC', 83, 77, 82, '분석형 경기 운영', '모든 공에는 이유가 있다'),
  school('noeul', '노을고', 'west-coast', false, '#C2410C', '#FDBA74', 74, 81, 70, '끈질긴 타격', '마지막 빛까지'),
  school('dalgol', '달골고', 'central', false, '#4A5568', '#E2E8F0', 68, 90, 58, '소수 정예 맞춤 지도', '작은 운동장, 큰 꿈'),
  school('namcheon', '남천고', 'southeast', false, '#0369A1', '#E0F2FE', 89, 69, 92, '빠른 야구와 압박', '먼저 뛰고 먼저 웃는다'),
] as const

export const PLAYABLE_SCHOOLS = SCHOOLS.filter((entry) => entry.playable)

export function getSchool(schoolId: string): SchoolProfile {
  const result = SCHOOLS.find((entry) => entry.id === schoolId)
  if (!result) throw new Error(`Unknown school: ${schoolId}`)
  return result
}
