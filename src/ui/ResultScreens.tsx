import { Button } from './controls'
import { CapIcon, DiamondIcon } from './icons'
import type { CareerSave } from '../contracts'
import type { GamePerformance } from '../domain/career'
import { getSchool } from '../content'

export interface CareerGameSummary {
  opponentName: string
  performance: GamePerformance
  score: { away: number; home: number }
  replayHash: string
  terminalId: string
}

export function ResultScreen({ save, result, onHub }: { save: CareerSave; result: CareerGameSummary | null; onHub: () => void }) {
  const school = getSchool(save.player.schoolId)
  const hitter = save.player.role === 'hitter'
  const performance = result?.performance
  const won = performance?.won ?? save.resolvedGames.at(-1)?.won ?? false
  const rating = performance?.performance ?? save.resolvedGames.at(-1)?.performance ?? 0
  const primaryStat = hitter
    ? `${performance?.plateAppearances ?? 0}타석 ${performance?.hits ?? 0}안타`
    : `${performance?.inningsPitched ?? 0}이닝 ${performance?.strikeouts ?? 0}탈삼진`
  return <main className="result-screen screen-shell" data-testid="result-screen"><div className="result-glow" /><header className="brand-mark"><DiamondIcon /><span>DIAMOND ROAD · GAME RESULT</span></header><section className="result-card panel"><span className="result-label">FINAL · {save.month.competition.toUpperCase()}</span><div className="result-score"><div><span className="team-crest team-crest--away"><CapIcon /><b>{result?.opponentName[0] ?? '상'}</b></span><strong>{result?.opponentName ?? '상대 팀'}</strong><b data-testid="result-away-score">{result?.score.away ?? 0}</b></div><p><span data-testid="game-performance">{rating}</span><small>PERFORMANCE</small></p><div><span className="team-crest team-crest--home"><CapIcon /><b>{school.name[0]}</b></span><strong>{school.name}</strong><b data-testid="result-home-score">{result?.score.home ?? 0}</b></div></div><div className="result-title"><span>{won ? 'WIN' : 'LOSS'}</span><h1>{won ? '오늘의 승리' : '다음 경기를 향해'}</h1><p>{hitter ? '직접 플레이한 타석과 주루 결과가 기록에 반영되었습니다.' : '직접 플레이한 투구 결과가 기록에 반영되었습니다.'}</p><span hidden data-testid="result-terminal-id">{result?.terminalId ?? save.lastTerminalEventId ?? ''}</span><span hidden data-testid="result-replay-hash">{result?.replayHash ?? save.replayCheckpoint?.finalHash ?? ''}</span></div><div className="result-stats"><div><span>오늘의 기록</span><strong data-testid="game-stat-line">{primaryStat}</strong></div><div><span>{hitter ? '타점' : '자책'}</span><strong>{hitter ? performance?.runsBattedIn ?? 0 : performance?.earnedRuns ?? 0}</strong></div><div><span>누적 경기</span><strong className="positive">{save.record.games}</strong></div><div><span>코치 신뢰</span><strong className="positive">{save.player.coachTrust}</strong></div></div><Button data-testid="return-to-hub-button" onClick={onHub}>커리어로 돌아가기</Button></section></main>
}

export function DraftScreen({ save, onTitle }: { save: CareerSave; onTitle: () => void }) {
  const school = getSchool(save.player.schoolId)
  const report = save.scoutingReport
  return <main className="draft-screen screen-shell" data-testid="draft-screen"><div className="draft-stage"><div className="draft-stage__lights" /><span>FINAL SCOUTING REPORT</span><h1>{report?.projectedRound ? '당신의 이름이' : '다음 무대를 향해'}<br /><em>{report?.projectedRound ? '불렸습니다.' : '길은 계속됩니다.'}</em></h1><div className="draft-pick panel"><span>{report?.projectedRound ? `${report.projectedRound} ROUND · DRAFTED` : 'UNDRAFTED · NEXT CHANCE'}</span><CapIcon /><div><small>DIAMOND ROAD</small><strong>{save.player.name}</strong><p>{save.player.position} · {school.name} · OVR {report?.overall ?? save.player.scouting}</p></div></div>{report && <p>{report.headline}</p>}<Button onClick={onTitle}>타이틀로</Button></div></main>
}
