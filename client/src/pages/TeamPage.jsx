// client/src/pages/TeamPage.jsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import rosters from '../data/lolRosters.json';
import gprTeamsData from '../data/gprTeams.json';
import gpr from '../data/lolGpr.json';
import { textOn } from '../utils/colorContrast';

const gprTeamMap = Object.fromEntries(gprTeamsData.teams.map(t => [t.short, t]));
const leagueColorMap = Object.fromEntries(gpr.regions.map(r => [r.key, r.color]));

const ROLE_KO = { top: '탑', jungle: '정글', mid: '미드', bottom: '원딜', support: '서폿' };
const ROLE_ORDER = ['top', 'jungle', 'mid', 'bottom', 'support'];

const TeamPage = () => {
  const { teamShort } = useParams();
  const navigate = useNavigate();
  const team = gprTeamMap[teamShort];
  const roster = rosters.rosters[teamShort];
  const leagueColor = leagueColorMap[team?.league?.toLowerCase()] || '#888';

  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-white/50 text-lg font-bold">팀을 찾을 수 없습니다</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-sm text-white/40 hover:text-white/70">← 돌아가기</button>
        </div>
      </div>
    );
  }

  const playersByRole = {};
  for (const p of roster?.players ?? []) {
    if (!playersByRole[p.role]) playersByRole[p.role] = [];
    playersByRole[p.role].push(p);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] p-6 md:p-12 text-white">
      <div className="max-w-2xl mx-auto">

        {/* 뒤로가기 */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-white/40 hover:text-white/70 transition-colors text-sm font-bold mb-8"
        >
          <ChevronLeft size={16} />
          돌아가기
        </button>

        {/* 팀 헤더 */}
        <div className="flex items-center gap-5 mb-8 pb-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {team.logo && (
            <img src={team.logo} alt={team.short} className="w-20 h-20 object-contain shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl md:text-3xl font-black text-white">{team.name}</h1>
              <span
                className="text-sm font-black px-2.5 py-1 rounded-lg"
                style={{ backgroundColor: leagueColor, color: textOn(leagueColor) }}
              >
                {team.league}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-white/50">
              <span>GPR <span className="font-black text-white/80">{team.score}</span></span>
              {team.w != null && <span>{team.w}승 {team.l}패</span>}
            </div>
          </div>
        </div>

        {/* 선수 로스터 */}
        {roster?.players?.length > 0 ? (
          <div className="flex flex-col gap-6">
            {ROLE_ORDER.map(role => {
              const players = playersByRole[role];
              if (!players?.length) return null;
              return (
                <div key={role}>
                  <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">
                    {ROLE_KO[role]}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {players.map(p => (
                      <div
                        key={p.name}
                        className="flex items-center gap-4 p-3 rounded-xl"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          opacity: p.starter === false ? 0.55 : 1,
                        }}
                      >
                        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-white/5">
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-full h-full object-cover object-top"
                              onError={e => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">?</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-white text-lg leading-tight">{p.name}</span>
                          </div>
                          {(p.firstName || p.lastName) && (
                            <div className="text-white/40 text-sm mt-0.5">
                              {[p.firstName, p.lastName].filter(Boolean).join(' ')}
                            </div>
                          )}
                        </div>
                        <span
                          className="text-xs font-black px-2.5 py-1 rounded-lg shrink-0"
                          style={{ backgroundColor: leagueColor + '25', color: leagueColor }}
                        >
                          {ROLE_KO[role]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-white/30 text-sm text-center py-16">선수 정보 없음</p>
        )}

        <p className="text-white/20 text-[11px] text-right mt-8">
          출처: lolesports.com · {rosters.updatedAt} 기준
        </p>
      </div>
    </div>
  );
};

export default TeamPage;
