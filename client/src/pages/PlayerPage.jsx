// client/src/pages/PlayerPage.jsx
// 선수 상세 — 로스터(lolRosters.json)와 시즌 기록(lolPlayerStats.json)을 esports 선수 ID로 연결해 표시.
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import RoleIcon, { ROLE_KO } from '../components/RoleIcon';
import rosters from '../data/lolRosters.json';
import gprTeamsData from '../data/gprTeams.json';
import playerStats from '../data/lolPlayerStats.json';

const gprTeamMap = Object.fromEntries(gprTeamsData.teams.map((t) => [t.short, t]));
const pct = (x) => (x == null ? '-' : `${Math.round(x * 100)}%`);

// 선수 ID → { player, teamShort }
const findPlayer = (id) => {
  for (const [short, r] of Object.entries(rosters.rosters || {})) {
    const p = (r.players || []).find((x) => x.id === id);
    if (p) return { player: p, teamShort: short, roster: r };
  }
  return null;
};

const Stat = ({ label, value, sub }) => (
  <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
    <div className="text-[11px] text-white/40 font-bold mb-1">{label}</div>
    <div className="font-mono font-black text-white/90 text-base sm:text-lg">{value}</div>
    {sub && <div className="font-mono text-[11px] text-white/50 mt-0.5">{sub}</div>}
  </div>
);

const PlayerPage = () => {
  const { playerId } = useParams();
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, [playerId]);

  const found = findPlayer(playerId);
  const s = playerStats.players?.[playerId];
  if (!found && !s) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-white/50 text-lg font-bold">선수를 찾을 수 없습니다</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-sm text-white/40 hover:text-white/70">← 돌아가기</button>
        </div>
      </div>
    );
  }
  const p = found?.player || { name: s.name, role: s.role };
  const team = found ? gprTeamMap[found.teamShort] : null;
  const teamLogo = team?.logo || found?.roster?.team?.image;
  const realName = [p.lastName, p.firstName].filter(Boolean).join(' ');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] p-6 md:p-12 text-white">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-white/40 hover:text-white/70 transition-colors text-sm font-bold mb-8">
          <ChevronLeft size={16} />
          돌아가기
        </button>

        {/* 선수 헤더 */}
        <div className="flex items-center gap-5 mb-8 pb-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white/5 shrink-0">
            {p.image && <img src={p.image} alt={p.name} className="w-full h-full object-cover object-top" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-black text-white truncate">{p.name}</h1>
            {realName && <p className="text-white/50 text-sm mt-0.5">{realName}</p>}
            <div className="flex items-center gap-3 mt-2 text-sm text-white/60 flex-wrap">
              <span className="inline-flex items-center gap-1"><RoleIcon role={p.role} size={16} />{ROLE_KO[p.role] ?? p.role}</span>
              {found && (
                <button onClick={() => navigate(`/lol/prediction/team/${found.teamShort}`)} className="inline-flex items-center gap-1.5 font-bold text-white/80 hover:text-white">
                  {teamLogo && <img src={teamLogo} alt="" className="w-5 h-5 object-contain" />}
                  {team?.name || found.teamShort}
                </button>
              )}
              {p.starter === false && <span className="text-[11px] font-bold text-white/40 border border-white/15 rounded px-1">후보</span>}
            </div>
          </div>
        </div>

        {s ? (
          <div>
            <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">{playerStats.season} 시즌 기록</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <Stat label="경기" value={s.games} />
              <Stat label="KDA" value={s.kda} sub={`${s.k} / ${s.d} / ${s.a}`} />
              <Stat label="CS/분" value={s.csm} />
              <Stat label="골드/분" value={s.gpm} />
              <Stat label="DMG 비중" value={pct(s.dmgShare)} />
              <Stat label="킬 관여" value={pct(s.kp)} />
            </div>

            {s.champions?.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">주 챔피언</h2>
                <div className="flex flex-col gap-1.5">
                  {s.champions.map(([c, n]) => (
                    <div key={c} className="flex items-center gap-3 text-sm">
                      <span className="w-24 font-bold text-white/85 truncate">{c}</span>
                      <div className="flex-1 h-2 rounded bg-white/5 overflow-hidden">
                        <div className="h-full bg-white/40" style={{ width: `${(n / s.games) * 100}%` }} />
                      </div>
                      <span className="w-10 text-right font-mono text-white/60">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-white/25 text-[11px] mt-6">경기당 평균 · 출처 lolesports 경기 데이터</p>
          </div>
        ) : (
          <p className="text-white/30 text-sm text-center py-16">시즌 기록 없음</p>
        )}
      </div>
    </div>
  );
};

export default PlayerPage;
