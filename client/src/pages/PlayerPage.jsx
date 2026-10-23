// client/src/pages/PlayerPage.jsx
// 선수 상세 — 로스터(lolRosters.json)와 시즌 기록(lolPlayerStats.json)을 esports 선수 ID로 연결해 표시.
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import RoleIcon, { ROLE_KO } from '../components/RoleIcon';
import rosters from '../data/lolRosters.json';
import gprTeamsData from '../data/gprTeams.json';
import playerStats from '../data/lolPlayerStats.json';
import playerCareers from '../data/lolPlayerCareers.json';
import { PLAYER_WORLDS_TEAM } from '../utils/championBg';
import ChampionBackground from '../components/ChampionBackground';

const gprTeamMap = Object.fromEntries(gprTeamsData.teams.map((t) => [t.short, t]));
// 활동 시즌 표기: 2015-2019 / 1시즌이면 2020
const fmtYears = (c) => (c.from === c.to ? String(c.from) : `${c.from}-${c.to}`);
const pct = (x) => (x == null ? '-' : `${Math.round(x * 100)}%`);

// 선수 ID → { player, teamShort }
const findPlayer = (id) => {
  for (const [short, r] of Object.entries(rosters.rosters || {})) {
    const p = (r.players || []).find((x) => x.id === id);
    if (p) return { player: p, teamShort: short, roster: r };
  }
  return null;
};

const Stat = ({ label, value, sub, cto }) => (
  <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
    <div className="text-[11px] text-white/40 font-bold mb-1">{label}</div>
    <div className="font-mono font-black text-white/90 text-base sm:text-lg">{value}</div>
    {sub && <div className="font-mono text-[11px] text-white/50 mt-0.5">{sub}</div>}
    {cto != null && <div className="font-mono text-[10px] text-white/35 mt-0.5">CtO {cto}</div>}
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
  // Worlds 우승 선수 → 우승 당시 팀의 배경(팀 페이지와 같은 이미지)
  const career = playerCareers.players?.[playerId] || [];
  const bgKey = PLAYER_WORLDS_TEAM[String(p.name || '').split(' ').pop().toLowerCase()];

  return (
    <div className="relative overflow-hidden min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] p-6 md:p-12 text-white">
      <ChampionBackground bgKey={bgKey} resetKey={playerId} />
      <div className="relative max-w-2xl mx-auto">
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
                  {career.length > 0 && <span className="font-normal text-white/45">({fmtYears(career[career.length - 1])})</span>}
                </button>
              )}
              {p.starter === false && <span className="text-[11px] font-bold text-white/40 border border-white/15 rounded px-1">후보</span>}
            </div>
            {/* 역대 팀 — 팀 이름(입단 시즌 - 마지막 활동 시즌), 1시즌이면 팀 이름(시즌). 출처 Leaguepedia */}
            {career.length > 1 && (
              <p className="mt-2 text-xs text-white/50 leading-relaxed">
                {career.slice(0, -1).reverse().map((c, i) => (
                  <React.Fragment key={i}>{i > 0 && <span className="text-white/25"> · </span>}{c.team}({fmtYears(c)})</React.Fragment>
                ))}
              </p>
            )}
          </div>
        </div>

        {s ? (
          <div>
            <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">{playerStats.season} 시즌 기록</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <Stat label="경기" value={s.games} />
              <Stat label="KDA" value={s.kda} sub={`${s.k} / ${s.d} / ${s.a}`} cto={s.cto?.kda} />
              <Stat label="CS/분" value={s.csm} cto={s.cto?.csm} />
              <Stat label="골드/분" value={s.gpm} cto={s.cto?.gpm} />
              <Stat label="DMG 비중" value={pct(s.dmgShare)} cto={s.cto ? pct(s.cto.dmgShare) : null} />
              <Stat label="킬 관여" value={pct(s.kp)} cto={s.cto ? pct(s.cto.kp) : null} />
            </div>

            {s.cto && (
              <p className="text-[11px] text-white/30 mt-2">
                CtO(상대 대비): 게임마다 (상대 팀 GPR ÷ 우리 팀 GPR)를 곱한 기록 · 평균 상대 강도 {s.cto.weight} ({s.cto.games}경기 기준)
              </p>
            )}

            {s.champions?.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">주 챔피언</h2>
                <div className="flex flex-col gap-1.5">
                  {s.champions.map(([c, n]) => (
                    <div key={c} className="flex items-center gap-3 text-sm">
                      {/* 챔피언 아이콘(CommunityDragon, 챔피언 alias 기준) — 로드 실패 시 이름으로 대체 */}
                      <img src={`https://cdn.communitydragon.org/latest/champion/${c}/square`} alt={c} title={c}
                        className="w-8 h-8 rounded-md object-cover shrink-0 bg-white/5"
                        onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('span'), { textContent: c, className: 'w-8 text-[10px] font-bold text-white/70 truncate' })); }} />
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
