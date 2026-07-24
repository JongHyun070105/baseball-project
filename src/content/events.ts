import type { CareerEventTemplate } from '../contracts'

const event = (
  id: string,
  category: CareerEventTemplate['category'],
  title: string,
  body: string,
  first: readonly [string, string, string],
  second: readonly [string, string, string],
): CareerEventTemplate => ({
  id,
  category,
  title,
  body,
  choices: [
    { id: first[0], label: first[1], effect: first[2] },
    { id: second[0], label: second[1], effect: second[2] },
  ],
})

export const CAREER_EVENTS: readonly CareerEventTemplate[] = [
  event('library-lights', 'academic', '꺼지지 않는 도서관', '원정 전날, 밀린 수행평가와 야간 타격 훈련이 겹쳤다.', ['study', '과제를 마친다', 'academics+8,condition-3'], ['train', '배트를 든다', 'growth+3,academics-4']),
  event('lab-partner', 'academic', '실험 짝의 부탁', '부상으로 빠진 짝이 실험 기록 정리를 부탁했다.', ['help', '함께 정리한다', 'relationship+6,academics+4'], ['decline', '훈련에 집중한다', 'condition-2,coachTrust+2']),
  event('midterm-bus', 'academic', '버스 안의 중간고사', '긴 원정 버스에서 시험 범위가 눈에 밟힌다.', ['review', '노트를 펼친다', 'academics+6'], ['sleep', '눈을 붙인다', 'condition+7']),
  event('presentation-day', 'academic', '발표와 불펜 피칭', '발표 순서와 불펜 피칭 시간이 정확히 겹쳤다.', ['present', '발표를 지킨다', 'academics+8,coachTrust-2'], ['pitch', '불펜으로 간다', 'coachTrust+5,academics-5']),
  event('quiet-tutor', 'academic', '조용한 과외', '벤치 포수가 수학 문제를 알려 달라며 공책을 내민다.', ['teach', '차근차근 알려준다', 'academics+3,relationship+7'], ['pass', '혼자 복습한다', 'academics+5']),
  event('makeup-class', 'academic', '비 오는 보충수업', '우천 취소 뒤 모두가 쉬는 날, 보충수업 공지가 왔다.', ['attend', '교실로 간다', 'academics+7'], ['recover', '몸을 돌본다', 'condition+8']),
  event('essay-scout', 'academic', '스카우트의 자기소개서', '감독이 야구를 시작한 이유를 글로 써 보라고 했다.', ['write', '솔직하게 쓴다', 'academics+4,scouting+3'], ['short', '짧게 끝낸다', 'condition+3']),
  event('grade-warning', 'academic', '담임의 경고장', '성적이 더 내려가면 다음 연습경기에 못 나간다.', ['focus', '공부 시간을 확보한다', 'academics+10,growth-2'], ['risk', '출전을 우선한다', 'coachTrust+3,academics-6']),
  event('captain-meal', 'relationship', '주장의 늦은 저녁', '주장이 말없이 맞은편 의자를 빼 준다.', ['join', '속마음을 나눈다', 'relationship+8,morale+5'], ['rest', '먼저 숙소로 간다', 'condition+6']),
  event('rookie-glove', 'relationship', '후배의 낡은 글러브', '후배가 찢어진 끈을 숨긴 채 훈련하고 있다.', ['repair', '함께 손질한다', 'relationship+9'], ['report', '코치에게 알린다', 'coachTrust+3,relationship-2']),
  event('rival-message', 'relationship', '라이벌의 짧은 문자', '중학교 라이벌이 슬럼프 소식을 듣고 영상을 보내 왔다.', ['reply', '고맙다고 답한다', 'morale+6,relationship+4'], ['analyze', '영상부터 돌려본다', 'growth+3']),
  event('roommate-alarm', 'relationship', '룸메이트의 새벽 알람', '룸메이트가 매일 새벽 개인 훈련을 시작했다.', ['join', '함께 나간다', 'relationship+5,growth+3,condition-4'], ['talk', '훈련 시간을 조율한다', 'relationship+7,condition+2']),
  event('fan-letter', 'relationship', '삐뚤빼뚤한 응원 편지', '지역 어린이 야구단에서 손편지가 도착했다.', ['visit', '연습장을 방문한다', 'relationship+8,morale+6'], ['display', '라커에 붙인다', 'morale+4']),
  event('team-cleanup', 'relationship', '아무도 없는 더그아웃', '훈련 뒤 더그아웃에 공과 물병이 흩어져 있다.', ['clean', '남아 정리한다', 'coachTrust+6,relationship+3'], ['leave', '회복을 우선한다', 'condition+5']),
  event('catcher-signs', 'relationship', '엇갈린 사인', '배터리 사인이 자꾸 엇갈려 둘 사이가 날카롭다.', ['listen', '상대 방식부터 듣는다', 'relationship+7,coachTrust+2'], ['insist', '내 방식을 밀어붙인다', 'growth+2,relationship-5']),
  event('birthday-cage', 'relationship', '생일날의 타격장', '동료들이 몰래 케이크를 준비했지만 개인 훈련 예약도 잡혀 있다.', ['party', '초를 함께 끈다', 'relationship+9,morale+5'], ['cage', '예약을 지킨다', 'growth+4']),
  event('ankle-twinge', 'health', '베이스 위의 찌릿함', '슬라이딩 뒤 발목에 작고 날카로운 통증이 남았다.', ['report', '트레이너를 찾는다', 'condition+6,injury-1'], ['hide', '테이핑으로 버틴다', 'coachTrust+2,injuryRisk+8']),
  event('heavy-shoulder', 'health', '무거운 어깨', '캐치볼 첫 공부터 어깨가 평소보다 늦게 따라온다.', ['stop', '즉시 중단한다', 'condition+9'], ['continue', '루틴을 끝낸다', 'growth+2,injuryRisk+10']),
  event('ice-bath', 'health', '마지막 얼음 욕조', '회복실 마감 직전, 얼음 욕조 하나가 비었다.', ['use', '차가움을 견딘다', 'condition+10'], ['skip', '일찍 잠든다', 'condition+6,morale+2']),
  event('nutrition-cart', 'health', '영양사의 수레', '영양사가 경기 전 식단을 바꿔 보자고 제안한다.', ['try', '새 식단을 따른다', 'condition+6,stamina+1'], ['usual', '익숙한 메뉴를 고른다', 'morale+3']),
  event('rain-sprint', 'health', '빗속의 추가 질주', '코치가 선택 훈련으로 빗속 질주를 열었다.', ['run', '끝까지 뛴다', 'growth+3,condition-7'], ['stretch', '실내 스트레칭을 한다', 'condition+7']),
  event('sleep-audit', 'health', '수면 기록표', '트레이너가 일주일 수면 시간을 적어 보라고 한다.', ['honest', '있는 그대로 적는다', 'condition+7,coachTrust+2'], ['adjust', '좋아 보이게 고친다', 'morale+2']),
  event('finger-blister', 'health', '손끝의 물집', '새 공의 실밥이 손끝을 벗겨 냈다.', ['care', '보호 패드를 댄다', 'condition+5'], ['adapt', '그립을 바꿔 던진다', 'movement+1,injuryRisk+5']),
  event('vision-check', 'health', '흐릿한 실밥', '야간 훈련에서 공의 실밥이 평소보다 늦게 선명해진다.', ['check', '시력 검사를 받는다', 'condition+4,coachTrust+2'], ['adjust', '타이밍을 스스로 조정한다', 'growth+2,injuryRisk+3']),
  event('empty-stands', 'morale', '빈 관중석의 메아리', '연패 뒤 운동장에는 배트 소리만 크게 울린다.', ['routine', '루틴을 반복한다', 'morale+5,growth+2'], ['cheer', '동료를 먼저 웃긴다', 'morale+7,relationship+4']),
  event('error-replay', 'morale', '계속 재생되는 실책', '눈을 감을 때마다 마지막 타구가 다시 굴러온다.', ['review', '장면을 분석한다', 'growth+3,morale-2'], ['release', '다음 공을 상상한다', 'morale+7']),
  event('headline-pressure', 'morale', '너무 큰 제목', '지역 신문이 당신을 전국구 유망주라 불렀다.', ['keep', '기사를 라커에 둔다', 'scouting+4,morale+2'], ['fold', '접어 서랍에 넣는다', 'morale+5']),
  event('walkup-song', 'morale', '새로운 등장곡', '방송부가 다음 홈경기 등장곡을 골라 달라고 한다.', ['bold', '힘찬 곡을 고른다', 'morale+6,scouting+2'], ['team', '팀 응원가를 고른다', 'relationship+5']),
  event('old-field', 'morale', '처음 야구한 운동장', '휴일에 우연히 어린 시절 운동장 앞을 지난다.', ['visit', '마운드에 다시 선다', 'morale+9'], ['call', '옛 코치에게 전화한다', 'morale+5,relationship+4']),
  event('silent-bus', 'morale', '조용한 귀갓길', '끝내기 패배 뒤 버스에서는 누구도 말을 꺼내지 않는다.', ['speak', '내일을 이야기한다', 'morale+6,coachTrust+3'], ['reflect', '혼자 경기를 정리한다', 'growth+2']),
  event('bench-applause', 'morale', '벤치에서 보낸 박수', '출전 없이 이긴 날, 기쁨과 조급함이 함께 밀려온다.', ['celebrate', '동료를 축하한다', 'relationship+6,morale+4'], ['practice', '스윙을 더 한다', 'growth+3,condition-3']),
  event('depth-chart', 'competition', '새로 붙은 뎁스 차트', '이름 옆의 순위가 어제보다 한 칸 내려갔다.', ['ask', '코치에게 과제를 묻는다', 'coachTrust+4,growth+2'], ['prove', '말없이 결과로 증명한다', 'growth+4,condition-4']),
  event('transfer-arrival', 'competition', '전학생의 첫 타구', '전학 온 동포지션 선수가 첫 타구를 담장에 꽂았다.', ['welcome', '먼저 손을 내민다', 'relationship+5,coachTrust+2'], ['compete', '배팅 장갑을 조인다', 'growth+4,morale+2']),
  event('bullpen-slot', 'competition', '하나뿐인 불펜 자리', '주말 명단의 마지막 한 자리를 두고 평가전이 열린다.', ['attack', '정면 승부한다', 'scouting+3,injuryRisk+4'], ['execute', '낮은 코스를 지킨다', 'coachTrust+5']),
  event('leadoff-trial', 'competition', '1번 타자 시험', '감독이 연습경기 한 경기 동안 1번을 맡아 보라고 한다.', ['aggressive', '초구부터 흔든다', 'scouting+3,growth+2'], ['patient', '출루에 집중한다', 'coachTrust+4']),
  event('captain-vote', 'competition', '주장단 투표', '동료들이 다음 주장단 후보로 당신을 추천했다.', ['accept', '책임을 맡는다', 'coachTrust+6,relationship+5'], ['decline', '경쟁에 집중한다', 'growth+3']),
  event('scout-stopwatch', 'competition', '스톱워치의 클릭', '관중석의 스카우트가 당신의 모든 움직임을 재고 있다.', ['showcase', '장점을 보여 준다', 'scouting+6,condition-4'], ['routine', '평소 루틴을 지킨다', 'coachTrust+3,morale+3']),
  event('ace-challenge', 'competition', '에이스의 승부 신청', '팀 에이스가 훈련 마지막 타석의 승부를 제안했다.', ['accept', '승부를 받는다', 'growth+4,scouting+2'], ['defer', '계획한 훈련을 끝낸다', 'coachTrust+2,condition+2']),
  event('scrimmage-call', 'competition', '갑작스러운 청백전', '휴식 예정일에 선발 경쟁 청백전이 잡혔다.', ['play', '출전한다', 'coachTrust+5,condition-5'], ['recover', '상태를 솔직히 말한다', 'condition+8,coachTrust-1']),
  event('number-nine', 'competition', '등번호 9번', '졸업한 선배의 번호를 누가 이어받을지 논쟁이 생겼다.', ['earn', '경쟁으로 결정하자고 한다', 'morale+4,growth+2'], ['share', '번호보다 역할이 먼저라 말한다', 'relationship+7,coachTrust+2']),
] as const

export function getCareerEvent(eventId: string): CareerEventTemplate {
  const result = CAREER_EVENTS.find((entry) => entry.id === eventId)
  if (!result) throw new Error(`Unknown career event: ${eventId}`)
  return result
}
