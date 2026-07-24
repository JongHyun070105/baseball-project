import type { HitterPosition, PitcherRole, PlayerRole } from '../contracts'
import { PLAYABLE_SCHOOLS } from '../content'
import type { UiPlayer } from '../app/ui-store'
import { Button, Segmented } from './controls'
import { CapIcon, DiamondIcon } from './icons'

const hitterPositions: readonly { value: HitterPosition; label: string }[] = [
  { value: 'C', label: '포수' }, { value: '1B', label: '1루수' }, { value: '2B', label: '2루수' },
  { value: '3B', label: '3루수' }, { value: 'SS', label: '유격수' }, { value: 'LF', label: '좌익수' },
  { value: 'CF', label: '중견수' }, { value: 'RF', label: '우익수' },
]
const pitcherPositions: readonly { value: PitcherRole; label: string }[] = [
  { value: 'starter', label: '선발' }, { value: 'reliever', label: '구원' },
]
const regionLabel = { capital: '수도권', 'west-coast': '서해권', central: '중부권', southwest: '호남권', southeast: '영남권', islands: '도서권' } as const

export function CreationScreen({ player, onChange, onBack, onComplete }: {
  player: UiPlayer
  onChange: (patch: Partial<UiPlayer>) => void
  onBack: () => void
  onComplete: () => void
}) {
  const setRole = (role: PlayerRole) => onChange({ role, position: role === 'hitter' ? 'SS' : 'starter' })
  return (
    <main className="creation-screen screen-shell" data-testid="create-screen">
      <header className="topbar"><button className="brand-button" onClick={onBack}><DiamondIcon /> DIAMOND ROAD</button><span>PLAYER CREATION</span><span>01 — 03</span></header>
      <section className="creation-layout">
        <div className="creation-copy">
          <div className="eyebrow"><span /> 새로운 여정</div>
          <h1>당신의<br /><em>선수를 만드세요</em></h1>
          <p>플레이 스타일과 학교 선택이<br />3년간의 성장 경로를 결정합니다.</p>
          <ol className="step-list"><li className="is-active"><b>01</b> 기본 정보</li><li><b>02</b> 플레이 스타일</li><li><b>03</b> 학교 선택</li></ol>
        </div>
        <div className="creation-form panel">
          <div className="form-row">
            <label htmlFor="player-name">선수 이름</label>
            <input id="player-name" data-testid="player-name-input" maxLength={12} value={player.name} onChange={(event) => onChange({ name: event.target.value })} />
          </div>
          <div className="form-row"><span className="form-label">역할</span><Segmented label="선수 역할" value={player.role} onChange={setRole} options={[{ value: 'hitter', label: '타자', testId: 'role-hitter' }, { value: 'pitcher', label: '투수', testId: 'role-pitcher' }]} /></div>
          <div className="form-row"><span className="form-label">포지션</span>
            {player.role === 'hitter'
              ? <Segmented label="수비 포지션" value={player.position as HitterPosition} onChange={(position) => onChange({ position })} options={hitterPositions.map((option) => ({ ...option, testId: option.value === 'SS' ? 'position-SS' : undefined }))} />
              : <Segmented label="투수 보직" value={player.position as PitcherRole} onChange={(position) => onChange({ position })} options={pitcherPositions.map((option) => ({ ...option, testId: `position-${option.value}` }))} />}
          </div>
          <div className="form-row"><span className="form-label">진학할 학교</span><div className="school-grid">
            {PLAYABLE_SCHOOLS.map((school) => <button type="button" data-testid="school-option" key={school.id} className={`school-card ${player.schoolId === school.id ? 'is-selected' : ''}`} style={{ borderColor: player.schoolId === school.id ? school.primary : undefined }} onClick={() => onChange({ schoolId: school.id })}>
              <span className="school-card__crest" style={{ background: school.primary, color: school.secondary }}><CapIcon /><b>{school.name[0]}</b></span><span><strong>{school.name}</strong><small>{regionLabel[school.region]}</small></span><span className="school-card__stats"><small>전력 <b>{school.teamPower}</b></small><small>성장 <b>{school.growth}</b></small></span>
            </button>)}
          </div></div>
          <div className="creation-submit"><p><span>선택 완료</span><strong>{player.name || '이름 없음'} · {player.role === 'hitter' ? '타자' : '투수'} · {player.position}</strong></p><Button data-testid="create-career-button" disabled={!player.name.trim()} onClick={onComplete}>커리어 시작</Button></div>
        </div>
      </section>
    </main>
  )
}
