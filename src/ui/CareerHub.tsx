import type { UiPlayer } from '../app/ui-store'
import type { CareerAction, CareerSimulation } from '../domain/career'
import { getCareerEvent, getSchool } from '../content'
import { Button, Meter } from './controls'
import { CapIcon, ChartIcon, DiamondIcon, GearIcon, PlayIcon, SaveIcon } from './icons'

const navItems = [
  { id: 'hub', label: '커리어', icon: DiamondIcon },
  { id: 'records', label: '기록', icon: ChartIcon },
  { id: 'saves', label: '저장', icon: SaveIcon },
  { id: 'settings', label: '설정', icon: GearIcon },
] as const

export function CareerHub({ player, career, importSuccess, onNavigate, onPlay, onTitle, onAction, onEventChoice, onAdvance, onExport, onImport }: { player: UiPlayer; career: CareerSimulation; importSuccess: boolean; onNavigate: (id: 'hub' | 'records' | 'saves' | 'settings') => void; onPlay: () => void; onTitle: () => void; onAction: (action: CareerAction) => void; onEventChoice: (eventId: string, choiceId: string) => void; onAdvance: () => void; onExport: () => void; onImport: (file: File) => void }) {
  const { save, progress } = career
  const school = getSchool(save.player.schoolId)
  const nextGame = career.schedule.find((game) => game.monthIndex === save.month.index && !game.resolved)
  const gamesThisMonth = career.schedule.filter((game) => game.monthIndex === save.month.index)
  const gamesRemaining = gamesThisMonth.filter((game) => !game.resolved).length
  const opponent = nextGame ? getSchool(nextGame.opponentId) : null
  const pendingEvent = progress.latestEventId ? getCareerEvent(progress.latestEventId) : null
  const year = save.player.year
  const overall = Math.round(Object.values(save.player.ratings).reduce((sum, value) => sum + value, 0) / 8)
  return (
    <main className="hub-screen screen-shell" data-testid="career-hub">
      <aside className="side-nav">
        <div className="side-nav__brand"><DiamondIcon /><span>DR</span></div>
        <nav aria-label="주 메뉴">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={id === 'hub' ? 'is-active' : ''} onClick={() => onNavigate(id)} title={label}><Icon /><span>{label}</span></button>)}</nav>
        <button className="side-nav__exit" data-testid="return-to-title-button" onClick={onTitle}>타이틀로</button><div className="side-nav__season">2026<br /><b>SEASON</b></div>
      </aside>
      <div className="hub-main">
        <header className="hub-header"><div><small><span data-testid="career-year">{year}</span>학년 · {save.month.month}월</small><h1>{save.month.competition === 'summer' ? '여름, ' : '오늘도, '}<em>증명할 시간.</em></h1></div><div className="hub-header__utilities"><button data-testid="advance-month-button" disabled={Boolean(pendingEvent) || save.month.actionsRemaining !== 0 || gamesRemaining !== 0} onClick={onAdvance}>이달 완료</button><button data-testid="export-save-button" onClick={onExport}>내보내기</button><label>불러오기<input data-testid="import-save-input" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file) }} /></label>{importSuccess && <span data-testid="import-save-success">불러오기 완료</span>}</div><div className="hub-header__status"><span>남은 행동</span><strong>{save.month.actionsRemaining}</strong><i>/ 3</i></div></header>
        <div className="hub-grid">
          <section className="player-card panel">
            <div className="player-card__banner"><span className="player-number">07</span><div className="player-silhouette" aria-hidden="true"><CapIcon /></div><span className="school-badge">{school.name}<br /><b>{school.motto}</b></span></div>
            <div className="player-card__body"><div><small>{player.position} · {player.role === 'hitter' ? '우투우타' : '우완'}</small><h2 data-testid="player-name-display">{player.name}</h2><p>{progress.lineupStatus} · {year}학년</p></div><div className="overall"><span>OVR</span><strong>{overall}</strong></div></div>
            <div className="rating-grid">{player.role === 'hitter' ? <><Meter label="컨택" value={save.player.ratings.contact} /><Meter label="파워" value={save.player.ratings.power} /><Meter label="스피드" value={save.player.ratings.speed} tone="green" /><Meter label="수비" value={save.player.ratings.fielding} tone="blue" /></> : <><Meter label="구속" value={save.player.ratings.velocity} /><Meter label="제구" value={save.player.ratings.command} /><Meter label="구위" value={save.player.ratings.movement} tone="green" /><Meter label="체력" value={save.player.ratings.stamina} tone="blue" /></>}</div>
            <div className="condition-row"><span>컨디션 <b>최상</b></span><span className="condition-dots"><i /><i /><i /><i /><i /></span></div>
          </section>
          <section className="next-game panel">
            <div className="section-heading"><div><span>NEXT GAME</span><h2>{nextGame ? `${save.month.competition.toUpperCase()} 일정` : '이달 경기 완료'}</h2></div><small data-testid="games-remaining">{gamesRemaining} / {gamesThisMonth.length} 남음</small></div>
            <div className="matchup"><div className="team-crest team-crest--home"><CapIcon /><b>{school.name[0]}</b><span>{school.name}</span></div><div className="versus"><small>{save.month.month}월 · 14:00</small><strong>VS</strong><span>다이아몬드 파크</span></div><div className="team-crest team-crest--away"><CapIcon /><b>{opponent?.name[0] ?? '—'}</b><span>{opponent?.name ?? '훈련 경기'}</span></div></div>
            <div className="opponent-note"><span>SCOUT REPORT</span><p>좌완 에이스의 슬라이더 비율이 높습니다. 초구 직구를 노려보세요.</p></div>
            <Button data-testid="start-game-button" disabled={!nextGame || Boolean(pendingEvent) || progress.lineupStatus === 'ineligible'} onClick={onPlay} icon={<PlayIcon />}>{progress.lineupStatus === 'ineligible' ? '학업 결격 · 자동 벤치' : nextGame ? '경기 시작' : '예정 경기 없음'}</Button>
          </section>
          <section className="actions-panel panel"><div className="section-heading"><div><span>THIS MONTH</span><h2>행동 선택</h2></div><small>{save.month.actionsRemaining}회 남음</small></div><div className="action-list">
            <ActionCard testId="career-action-growth" disabled={save.month.actionsRemaining === 0 || Boolean(pendingEvent)} onClick={() => onAction('growth')} icon="⚾" title={player.role === 'hitter' ? '타격·수비 훈련' : '불펜·구위 훈련'} subtitle="능력치 성장 · 피로 증가" gain="+2~4" />
            <ActionCard testId="career-action-recovery" disabled={save.month.actionsRemaining === 0 || Boolean(pendingEvent)} onClick={() => onAction('recovery')} icon="◇" title="개인 회복" subtitle="컨디션·부상 회복" gain="+15" />
            <ActionCard testId="career-action-study" disabled={save.month.actionsRemaining === 0 || Boolean(pendingEvent)} onClick={() => onAction('study')} icon="▤" title="학업 관리" subtitle="출전 자격 · 감독 신뢰" gain="+8" />
            <ActionCard testId="career-action-relationship" disabled={save.month.actionsRemaining === 0 || Boolean(pendingEvent)} onClick={() => onAction('relationship')} icon="◎" title="팀 미팅" subtitle="사기 · 신뢰 상승" gain="+5" />
          </div></section>
          <section className="scout-panel panel"><div className="section-heading"><div><span>SCOUTING</span><h2>드래프트 전망</h2></div><CapIcon /></div><div className="draft-round"><span>예상 지명</span><strong>2<small>ROUND</small></strong></div><p>“넓은 수비 범위와 안정적인 컨택. 즉시 전력감 내야수.”</p><div className="scout-tags"><span>+ 수비 센스</span><span>+ 주루</span><span>△ 장타력</span></div></section>
        </div>
      </div>
      {pendingEvent && <div className="career-event" role="dialog" aria-modal="true" aria-labelledby="career-event-title" data-testid="career-event-dialog"><section className="panel"><span>{pendingEvent.category.toUpperCase()} EVENT</span><h2 id="career-event-title">{pendingEvent.title}</h2><p>{pendingEvent.body}</p><div>{pendingEvent.choices.map((choice) => <button key={choice.id} data-testid={`career-event-choice-${choice.id}`} onClick={() => onEventChoice(pendingEvent.id, choice.id)}><strong>{choice.label}</strong><small>{choice.effect}</small></button>)}</div></section></div>}
    </main>
  )
}

function ActionCard({ testId, icon, title, subtitle, gain, onClick, disabled }: { testId: string; icon: string; title: string; subtitle: string; gain: string; onClick: () => void; disabled: boolean }) {
  return <button type="button" data-testid={testId} className="action-card" disabled={disabled} onClick={onClick}><span className="action-card__icon">{icon}</span><span><strong>{title}</strong><small>{subtitle}</small></span><b>{gain}</b></button>
}
