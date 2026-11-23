// TPR(TotalDU 자체 레이팅) — 팀별 2027 계약 확정 선수만, 선수별 이전 팀 GPR(월즈 종료 시점) 평균. 데이터: scripts/buildTpr.mjs → lolTpr.json
//   UI는 GprTable과 같은 표(리그 필터·점수 막대).
import React, { useState } from 'react';
import tpr from '../data/lolTpr.json';
import gpr from '../data/lolGpr.json';
import { TeamLogo } from './GprTable';
import { textOn, lighten } from '../utils/colorContrast';

const ROLE_KO = { Top: '탑', Jungle: '정글', Mid: '미드', Bot: '원딜', Support: '서폿' };
const leagueColor = Object.fromEntries(gpr.regions.map((r) => [r.key, r.color]));
const ranked = [...(tpr.teams || [])].sort((a, b) => b.tpr - a.tpr);
const maxScore = Math.max(...ranked.map((t) => t.tpr));
const minScore = Math.min(...ranked.map((t) => t.tpr)); // 최저 팀 = 막대 0%
const rankOf = {};
ranked.forEach((t, i) => { rankOf[t.short] = i > 0 && ranked[i - 1].tpr === t.tpr ? rankOf[ranked[i - 1].short] : i + 1; });
const leagues = [...gpr.regions].sort((a, b) => b.score - a.score).filter((r) => ranked.some((t) => t.league === r.key));
const rosterText = (t) => t.players.map((p) => `${ROLE_KO[p.role] || p.role} ${p.name}${p.prevGpr != null ? ` (${p.prevTeam} ${p.prevYear} ${p.prevGpr}${p.teamGames ? ` · ${p.games}/${p.teamGames}경기` : ''}${p.weight < 1 ? ` · 반영 ${Math.round(p.weight * 100)}%` : ''})` : ' (GPR 없음)'}`).join('\n');

export default function TprTable({ logoOf, selectedTeam, onTeamClick }) {
  const [selected, setSelected] = useState([]);
  const toggle = (k) => setSelected((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const visible = selected.length ? ranked.filter((t) => selected.includes(t.league)) : ranked;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {leagues.map((r) => {
          const on = selected.includes(r.key);
          return (
            <button key={r.key} onClick={() => toggle(r.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${on ? '' : 'text-white/45 border-white/10 hover:border-white/30 hover:text-white/70 bg-transparent'}`}
              style={on ? { backgroundColor: r.color, borderColor: r.color, color: textOn(r.color) } : {}}>
              {r.name}
            </button>
          );
        })}
        {selected.length > 0 && (
          <button onClick={() => setSelected([])} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/45 border border-white/10 hover:border-white/30 hover:text-white/70 bg-transparent">전체 보기</button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-white/40 text-xs border-b border-white/10">
              <th className="text-center font-bold py-2 px-2 w-10">#</th>
              <th className="text-left font-bold py-2 pr-2">팀</th>
              <th className="text-center font-bold py-2 px-2">리그</th>
              <th className="text-center font-bold py-2 px-3 w-1/3">TPR 점수</th>
              <th className="text-center font-bold py-2 px-2">반영</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => {
              const col = leagueColor[t.league] || '#888';
              return (
                <tr key={t.short} title={rosterText(t)} onClick={() => onTeamClick?.(t.short)}
                  className={`border-b border-white/5 cursor-pointer transition-colors ${selectedTeam === t.short ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                  <td className="py-2 px-2 text-center text-white/40 font-mono">{rankOf[t.short]}</td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamLogo src={logoOf?.(t.short)} />
                      <span className="font-bold text-white/90 truncate">{t.name}</span>
                      <span className="text-white/40 text-xs shrink-0">{t.short}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="text-xs font-black px-2 py-0.5 rounded" style={{ color: textOn(col), backgroundColor: col }}>{t.league}</span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3.5 bg-white/5 rounded-full overflow-hidden min-w-[60px]">
                        <div className="h-full rounded-full" style={{ width: `${((t.tpr - minScore) / (maxScore - minScore || 1)) * 100}%`, backgroundColor: col }} />
                      </div>
                      <span className="font-mono font-black tabular-nums w-10 text-right" style={{ color: lighten(col) }}>{t.tpr}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center text-white/50 font-mono whitespace-nowrap">
                    {t.coverage}{!t.complete && <span className="ml-1.5 text-[10px] font-sans font-bold text-amber-300/70" title="로스터 미확정 — 계약 확정 선수만 반영한 잠정값">잠정 {t.roles}/5</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-white/30">
        2027 계약 확정 선수만 반영(산출 {ranked.length}팀 중 로스터 확정 {ranked.filter((t) => t.complete).length}팀, '잠정 n/5'는 확정된 포지션 수 · 산출 불가 {tpr.pending?.length ?? 0}팀). 선수별 이전 팀의 월즈 종료 시점 GPR 평균(쉰 시즌 1개당 반영 50% × 출전 게임/팀 전체 게임) · 행에 마우스를 올리면 선수별 반영값 · 기준일 {tpr.refDate} · 출처 {tpr.source} / {tpr.gprBase}
      </p>
    </div>
  );
}
