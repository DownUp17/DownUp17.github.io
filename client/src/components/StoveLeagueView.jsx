// 2027 LCK 스토브리그 — 팀별 예상 주전 로스터(계약 정보 + 커뮤니티 썰 종합). 불확실한 포지션은 공백.
import React from 'react';
import RoleIcon from './RoleIcon';
import stove from '../data/lckStove2027.json';
import rosters from '../data/lolRosters.json';
import gprTeamsData from '../data/gprTeams.json';
import standings from '../data/lolStandings.json';

// 팀 순서 = 2026 LCK 최종 순위
const rankOf = Object.fromEntries((standings.standings?.lck?.LCK?.finalStandings || []).map((r) => [r.team, r.rank]));
const teamsSorted = [...stove.teams].sort((a, b) => (rankOf[a.short] ?? 99) - (rankOf[b.short] ?? 99));
const ROLES = ['top', 'jungle', 'mid', 'bottom', 'support'];
const teamName = Object.fromEntries(gprTeamsData.teams.map((t) => [t.short, t.name]));
// 선수 이름 → 2026 로스터 사진·ID(소문자 비교)
const playerByName = {};
for (const r of Object.values(rosters.rosters || {})) for (const p of r.players || []) playerByName[p.name.toLowerCase()] = p;
const BASIS = {
  계약: { label: '계약', color: '#34D399' },
  유력: { label: '유력', color: '#60A5FA' },
  루머: { label: '루머', color: '#FBBF24' },
};

export default function StoveLeagueView({ logoOf, onTeamClick, onPlayerClick }) {
  return (
    <section>
      <div className="flex items-baseline gap-2 flex-wrap mb-2">
        <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">예상 주전 로스터</h3>
        <span className="text-xs text-white/40">{stove.updatedAt} 기준 · 공식 발표 아님</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-white/60 flex-wrap mb-4">
        {Object.values(BASIS).map((b) => (
          <span key={b.label} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />{b.label}</span>
        ))}
        <span className="text-white/35">빈칸 = 불확실</span>
      </div>
      <div className="flex flex-col gap-3">
        {teamsSorted.map((t) => (
          <div key={t.short} className="rounded-xl bg-white/5 border border-white/10 p-3">
            <button onClick={() => onTeamClick?.(t.short)} className="flex items-center gap-2 mb-2 hover:brightness-125">
              {logoOf?.(t.short) && <img src={logoOf(t.short)} alt="" className="w-6 h-6 object-contain" />}
              <span className="font-black text-white/90 text-sm">{teamName[t.short] || t.short}</span>
            </button>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {ROLES.map((role) => {
                const s = t.players[role];
                const p = s && playerByName[s.name.toLowerCase()];
                const b = s && BASIS[s.basis];
                return (
                  <div key={role} title={s?.note || '불확실'}
                    onClick={p?.id ? () => onPlayerClick?.(p.id) : undefined}
                    className={`flex flex-col items-center text-center rounded-lg p-1.5 sm:p-2 min-h-[96px]${p?.id ? ' cursor-pointer hover:bg-white/10' : ''}`}
                    style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: `1px ${s ? 'solid' : 'dashed'} ${b ? b.color + '55' : 'rgba(255,255,255,0.12)'}` }}>
                    <RoleIcon role={role} size={14} className="opacity-60 mb-1" />
                    {s ? (
                      <>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-white/5">
                          {p?.image && <img src={p.image} alt={s.name} className="w-full h-full object-cover object-top" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                        </div>
                        <span className="mt-1 text-[11px] sm:text-xs font-black text-white/90 truncate max-w-full">{s.name}</span>
                        <span className="text-[9px] sm:text-[10px] font-bold" style={{ color: b?.color }}>{b?.label}</span>
                      </>
                    ) : (
                      <span className="flex-1 flex items-center text-white/25 text-lg font-black">?</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
