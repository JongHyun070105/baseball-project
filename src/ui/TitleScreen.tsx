import { Button } from './controls'
import { CapIcon, DiamondIcon, PlayIcon, SaveIcon } from './icons'

export function TitleScreen({ onNew, onContinue, onSaves, canResume }: { onNew: () => void; onContinue: () => void; onSaves: () => void; canResume: boolean }) {
  return (
    <main className="title-screen screen-shell" data-testid="title-screen">
      <div className="title-screen__atmosphere" aria-hidden="true">
        <span className="stadium-light stadium-light--left" /><span className="stadium-light stadium-light--right" />
        <div className="diamond-lines"><i /><i /><i /></div>
      </div>
      <header className="brand-mark"><DiamondIcon /><span>HB CAREER SIMULATION</span></header>
      <section className="title-hero">
        <div className="eyebrow"><span /> 고교야구의 정점으로</div>
        <h1>DIAMOND<br /><em>ROAD</em></h1>
        <p>한 타석, 한 이닝, 한 시즌.<br />당신의 이름을 역사에 새기세요.</p>
        <div className="title-actions">
          <Button data-testid="resume-game-button" disabled={!canResume} onClick={onContinue} icon={<PlayIcon />}>커리어 계속하기</Button>
          <Button data-testid="new-game-button" variant="secondary" onClick={onNew} icon={<CapIcon />}>새 선수 만들기</Button>
          <button className="text-button" data-testid="manage-saves-button" type="button" onClick={onSaves}><SaveIcon /> 저장 슬롯 관리</button>
        </div>
      </section>
      <footer className="title-footer"><span>SEASON 2026</span><span>VER 1.0</span><span className="title-footer__line" /><span>PRESS ENTER TO CONTINUE</span></footer>
    </main>
  )
}
