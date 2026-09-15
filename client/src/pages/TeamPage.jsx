// client/src/pages/TeamPage.jsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import rosters from '../data/lolRosters.json';
import gprTeamsData from '../data/gprTeams.json';
import gpr from '../data/lolGpr.json';
import teamTitles from '../data/lolTitles.json';
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

  // 주전(스타터)만, 역할 순서대로 한 명씩 — 가로 일렬 배치용.
  const starters = ROLE_ORDER
    .map((role) => (roster?.players ?? []).find((p) => p.role === role && p.starter !== false))
    .filter(Boolean);
  // 우승 경력 — API에 없어 수기 관리(lolTitles.json). 팀 약칭 → [{ name, detail }].
  const titles = teamTitles.titles?.[teamShort] || [];

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

        {/* 주전 선수 — 역할 순서대로 가로 일렬 배치 */}
        {starters.length > 0 ? (
          <div>
            <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">주전 로스터</h2>
            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {starters.map(p => (
                <div
                  key={p.name}
                  className="flex flex-col items-center text-center p-2 sm:p-3 rounded-xl"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-full aspect-square max-w-[72px] rounded-xl overflow-hidden bg-white/5 mb-2">
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
                  <span className="font-black text-white text-sm sm:text-base leading-tight truncate max-w-full">{p.name}</span>
                  <span
                    className="mt-1.5 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-lg"
                    style={{ backgroundColor: leagueColor + '25', color: leagueColor }}
                  >
                    {ROLE_KO[p.role]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-white/30 text-sm text-center py-16">선수 정보 없음</p>
        )}

        {/* 우승 경력 */}
        {titles.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">우승 경력</h2>
            <div className="flex flex-col gap-2">
              {titles.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span className="text-base shrink-0">🏆</span>
                  <span className="font-bold text-white/90 text-sm">{t.name}</span>
                  {t.detail && <span className="ml-auto text-xs text-white/40 font-mono shrink-0">{t.detail}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-white/20 text-[11px] text-right mt-8">
          출처: lolesports.com · {rosters.updatedAt} 기준
        </p>
      </div>
    </div>
  );
};

export default TeamPage;
