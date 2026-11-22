// TPR(TotalDU 자체 레이팅) — 2027 로스터가 확정된 팀만, 선수별 이전 팀 GPR(월즈 종료 시점) 평균. 데이터: scripts/buildTpr.mjs → lolTpr.json
import React from 'react';
import tpr from '../data/lolTpr.json';
import { TeamLogo } from './GprTable';

const ROLE_KO = { Top: '탑', Jungle: '정글', Mid: '미드', Bot: '원딜', Support: '서폿' };

export default function TprTable({ logoOf, onTeamClick }) {
  const teams = [...(tpr.teams || [])].sort((a, b) => b.tpr - a.tpr);
  return (
    <div className="flex flex-col gap-3">
      {teams.map((t, i) => (
        <div key={t.short} className="rounded-xl bg-white/5 border border-white/10 p-3">
          <button onClick={() => onTeamClick?.(t.short)} className="w-full flex items-center gap-3 hover:brightness-125">
            <span className="w-6 text-white/40 font-black text-sm">{i + 1}</span>
            <TeamLogo src={logoOf?.(t.short)} size={24} />
            <span className="font-black text-white/90 text-sm truncate">{t.name}</span>
            <span className="text-[10px] text-white/40 font-bold">{t.league}</span>
            <span className="ml-auto font-mono font-black text-lg text-[#E8C77E]">{t.tpr}</span>
          </button>
          <div className="mt-2 pl-9 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/50">
            {t.players.map((p) => (
              <span key={p.name}>
                <span className="text-white/35">{ROLE_KO[p.role] || p.role}</span> {p.name}
                {p.prevGpr != null ? <span className="font-mono text-white/40"> {p.prevTeam} {p.prevYear} {p.prevGpr}</span> : <span className="text-white/30"> (GPR 없음)</span>}
              </span>
            ))}
            <span className="text-white/30">반영 {t.coverage}</span>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-white/30">
        2027 로스터가 확정된 팀만 표시(현재 {teams.length}팀, 미확정 {tpr.pending?.length ?? 0}팀). 선수별 이전 팀의 월즈 종료 시점 GPR 평균 · 기준일 {tpr.refDate} · 출처 {tpr.source} / {tpr.gprBase}
      </p>
    </div>
  );
}
