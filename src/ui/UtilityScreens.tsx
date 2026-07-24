import { useState } from 'react'
import type { CareerSave, Difficulty, GameSettings } from '../contracts'
import { DIFFICULTY_LABEL } from '../app/ui-store'
import { Button, Segmented } from './controls'
import { ArrowIcon, ChartIcon, GearIcon, SaveIcon } from './icons'

function UtilityLayout({ title, kicker, icon, onBack, children }: { title: string; kicker: string; icon: React.ReactNode; onBack: () => void; children: React.ReactNode }) {
  return <main className="utility-screen screen-shell"><header className="utility-header"><button className="back-button" onClick={onBack}><ArrowIcon /> 커리어 홈</button><div><span>{kicker}</span><h1>{title}</h1></div>{icon}</header><section className="utility-content">{children}</section></main>
}

export function RecordsScreen({ save, onBack }: { save: CareerSave; onBack: () => void }) {
  const record = save.record
  const average = record.plateAppearances > 0 ? record.hits / record.plateAppearances : 0
  const era = record.inningsPitched > 0 ? record.earnedRuns * 9 / record.inningsPitched : 0
  const hitter = save.player.role === 'hitter'
  return <UtilityLayout title="커리어 기록" kicker="CAREER RECORDS" icon={<ChartIcon />} onBack={onBack}><div className="record-summary panel"><div><span>경기</span><strong>{record.games}</strong><small>{record.wins}승 {record.losses}패</small></div>{hitter ? <><div><span>타율</span><strong>{average.toFixed(3).replace(/^0/, '')}</strong><small>{record.hits}안타</small></div><div><span>홈런</span><strong>{record.homeRuns}</strong><small>{record.runsBattedIn}타점</small></div><div><span>타석</span><strong>{record.plateAppearances}</strong><small>고교 통산</small></div></> : <><div><span>평균자책</span><strong>{era.toFixed(2)}</strong><small>{record.inningsPitched}이닝</small></div><div><span>탈삼진</span><strong>{record.strikeouts}</strong><small>{record.earnedRuns}자책</small></div><div><span>컨디션</span><strong>{save.player.condition}</strong><small>현재 상태</small></div></>}</div><section className="panel game-log"><div className="section-heading"><div><span>CAREER LOG</span><h2>최근 활동</h2></div></div>{save.eventHistory.slice(-8).reverse().map((entry, index) => <div className="game-log__row" key={`${entry}-${index}`}><time>{save.month.month}월</time><strong>{entry.startsWith('action:') ? '월간 행동' : '생활 이벤트'}</strong><span>{entry.split(':').at(-1)}</span></div>)}</section></UtilityLayout>
}

export function SettingsScreen({ settings, onChange, onBack }: { settings: GameSettings; onChange: (patch: Partial<GameSettings>) => void; onBack: () => void }) {
  return <UtilityLayout title="게임 설정" kicker="SETTINGS" icon={<GearIcon />} onBack={onBack}><section className="settings-panel panel"><SettingRow title="난이도" description="투구 속도와 AI 판단력에 영향을 줍니다."><Segmented label="난이도" value={settings.difficulty} onChange={(difficulty: Difficulty) => onChange({ difficulty })} options={(['rookie', 'prospect', 'legend'] as const).map((value) => ({ value, label: DIFFICULTY_LABEL[value] }))} /></SettingRow><SettingRow title="그래픽 품질" description="픽셀 비율, 그림자와 관중 표현을 조절합니다."><Segmented label="그래픽 품질" value={settings.graphics} onChange={(graphics: GameSettings['graphics']) => onChange({ graphics })} options={[{ value: 'low', label: '낮음' }, { value: 'medium', label: '중간' }, { value: 'high', label: '높음' }]} /></SettingRow><SettingRow title="에임 보정" description="타격 지점을 공에 부드럽게 맞춥니다."><Toggle checked={settings.aimAssist} onChange={(aimAssist) => onChange({ aimAssist })} /></SettingRow><SettingRow title="모션 효과" description="전환과 경기 연출 애니메이션을 사용합니다."><Toggle checked={settings.motionEffects} onChange={(motionEffects) => onChange({ motionEffects })} /></SettingRow><SettingRow title="카메라 흔들림" description="타격 순간의 카메라 충격 강도입니다."><input aria-label="카메라 흔들림" type="range" min="0" max="1" step="0.05" value={settings.cameraShake} onChange={(event) => onChange({ cameraShake: Number(event.target.value) })} /></SettingRow><SettingRow title="전체 음량" description="게임의 모든 사운드 볼륨입니다."><input aria-label="전체 음량" type="range" min="0" max="1" step="0.05" value={settings.masterVolume} onChange={(event) => onChange({ masterVolume: Number(event.target.value) })} /></SettingRow></section></UtilityLayout>
}

function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <div className="setting-row"><div><strong>{title}</strong><p>{description}</p></div>{children}</div> }
function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) { return <button className={`toggle ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}><span /></button> }

export interface SaveSlotSummary { slot: 1 | 2 | 3; save: CareerSave | null; backup: CareerSave | null; error?: string }

type PendingSaveAction = { kind: 'overwrite' | 'delete' | 'restore'; slot: 1 | 2 | 3 } | null

export function SavesScreen({ slots, activeSlot, onBack, onSelect, onOverwrite, onDelete, onRestore }: { slots: readonly SaveSlotSummary[]; activeSlot: number; onBack: () => void; onSelect: (slot: 1 | 2 | 3, exists: boolean) => void; onOverwrite: (slot: 1 | 2 | 3) => void; onDelete: (slot: 1 | 2 | 3) => void; onRestore: (slot: 1 | 2 | 3) => void }) {
  const [pending, setPending] = useState<PendingSaveAction>(null)
  const confirm = () => {
    if (!pending) return
    if (pending.kind === 'overwrite') onOverwrite(pending.slot)
    else if (pending.kind === 'delete') onDelete(pending.slot)
    else onRestore(pending.slot)
    setPending(null)
  }
  const actionLabel = pending?.kind === 'overwrite' ? '이 슬롯에 새 커리어를 시작' : pending?.kind === 'delete' ? '이 슬롯을 삭제' : '백업 시점으로 복원'
  return <UtilityLayout title="저장 슬롯" kicker="SAVE MANAGEMENT" icon={<SaveIcon />} onBack={onBack}>
    <p className="save-management-note" data-testid="save-slot-policy">세 슬롯이 모두 찬 경우 덮어쓸 슬롯을 직접 선택해야 합니다. 덮어쓴 세이브는 백업으로 한 번 복원할 수 있습니다.</p>
    <div className="save-grid">{slots.map(({ slot, save, backup, error }) => save ? <article data-testid={`save-slot-${slot}`} className={`save-slot panel ${slot === activeSlot ? 'save-slot--active' : ''}`} key={slot}><header><span>SLOT 0{slot} · AUTOSAVE</span><time>{new Date(save.updatedAt).toLocaleDateString('ko-KR')}</time></header><div className="save-slot__player"><b>{String(slot).padStart(2, '0')}</b><div><h2>{save.player.name}</h2><p>{save.player.year}학년 · {save.player.position}</p></div><strong>{save.player.scouting} <small>SCOUT</small></strong></div><dl><div><dt>진행</dt><dd>{save.month.index + 1} / 36개월</dd></div><div><dt>기록</dt><dd>{save.record.games}경기</dd></div><div><dt>상태</dt><dd>{save.phase}</dd></div></dl><Button data-testid={`select-save-slot-${slot}`} onClick={() => onSelect(slot, true)}>이어서 플레이</Button><div className="save-slot__actions"><button data-testid={`overwrite-save-slot-${slot}`} onClick={() => setPending({ kind: 'overwrite', slot })}>새 커리어로 덮어쓰기</button><button data-testid={`delete-save-slot-${slot}`} onClick={() => setPending({ kind: 'delete', slot })}>삭제</button>{backup && <button data-testid={`restore-save-slot-${slot}`} onClick={() => setPending({ kind: 'restore', slot })}>백업 복원</button>}</div></article> : <article data-testid={`save-slot-${slot}`} className="save-slot save-slot--empty panel" key={slot}><span>SLOT 0{slot}</span><SaveIcon /><h2>{error ? '손상된 세이브' : '비어 있는 슬롯'}</h2><p>{error ? '체크섬 또는 스키마 검증에 실패해 안전하게 거부했습니다.' : <>새 커리어를 시작하면<br />이 슬롯에 자동 저장됩니다.</>}</p>{error && backup && <button data-testid={`restore-save-slot-${slot}`} onClick={() => setPending({ kind: 'restore', slot })}>검증된 백업 복원</button>}{!error && <Button data-testid={`select-save-slot-${slot}`} variant="secondary" onClick={() => onSelect(slot, false)}>새 커리어</Button>}</article>)}</div>
    {pending && <div className="save-confirm" role="dialog" aria-modal="true" aria-labelledby="save-confirm-title" data-testid="save-confirm-dialog"><section className="panel"><span>SLOT 0{pending.slot}</span><h2 id="save-confirm-title">{actionLabel}할까요?</h2><p>{pending.kind === 'delete' ? '현재 세이브와 백업이 모두 삭제되며 되돌릴 수 없습니다.' : pending.kind === 'restore' ? '현재 상태는 새 백업으로 보관됩니다.' : '현재 세이브는 백업으로 보관된 뒤 새 커리어 생성 화면으로 이동합니다.'}</p><div><Button variant="secondary" data-testid={pending.kind === 'delete' ? 'cancel-delete-save-slot' : 'cancel-save-action'} onClick={() => setPending(null)}>취소</Button><Button data-testid={pending.kind === 'delete' ? 'confirm-delete-save-slot' : 'confirm-save-action'} onClick={confirm}>확인</Button></div></section></div>}
  </UtilityLayout>
}
