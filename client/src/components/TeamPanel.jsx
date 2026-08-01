// client/src/components/TeamPanel.jsx
import React, { useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';
import rosters from '../data/lolRosters.json';
import gprTeamsData from '../data/gprTeams.json';
import gpr from '../data/lolGpr.json';
import { textOn } from '../utils/colorContrast';

const gprTeamMap = Object.fromEntries(gprTeamsData.teams.map(t => [t.short, t]));
const leagueColorMap = Object.fromEntries(gpr.regions.map(r => [r.key, r.color]));

const ROLE_KO = { top: '탑', jungle: '정글', mid: '미드', bottom: '원딜', support: '서폿' };
const ROLE_ORDER = ['top', 'jungle', 'mid', 'bottom', 'support'];

const TeamPanel = ({ teamShort, onClose, onNavigate }) => {
  const team = gprTeamMap[teamShort];
  const roster = rosters.rosters[teamShort];
  const leagueColor = leagueColorMap[team?.league?.toLowerCase()] || '#888';

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!team) return null;

  const playersByRole = {};
  for (const p of roster?.players ?? []) {
    if (!playersByRole[p.role]) playersByRole[p.role] = [];
    playersByRole[p.role].push(p);
  }

  return (
    <>
      {/* 배경 오버레이 (모바일에서만 반투명) */}
      <div
        className="fixed inset-0 z-40 lg:hidden"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* 패널 */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col shadow-2xl"
        style={{
          width: 'min(360px, 100vw)',
          backgroundColor: '#0f1923',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 p-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {team.logo && <img src={team.logo} alt={team.short} className="w-10 h-10 object-contain shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-white text-base leading-tight truncate">{team.name}</span>
              <span className="text-[11px] font-black px-2 py-0.5 rounded shrink-0"
                style={{ backgroundColor: leagueColor, color: textOn(leagueColor) }}>
                {team.league}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
              <span>GPR <span className="font-black text-white/60">{team.score}</span></span>
              {team.w != null && <span>{team.w}승 {team.l}패</span>}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 선수 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          {roster?.players?.length > 0 ? (
            <div className="flex flex-col gap-4">
              {ROLE_ORDER.map(role => {
                const players = playersByRole[role];
                if (!players?.length) return null;
                return (
                  <div key={role}>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">{ROLE_KO[role]}</p>
                    <div className="flex flex-col gap-1.5">
                      {players.map(p => (
                        <div key={p.name} className="flex items-center gap-3 p-2.5 rounded-xl"
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            opacity: p.starter === false ? 0.55 : 1,
                          }}>
                          <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-white/5">
                            {p.image
                              ? <img src={p.image} alt={p.name} className="w-full h-full object-cover object-top"
                                  onError={e => { e.currentTarget.style.display = 'none'; }} />
                              : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">?</div>
                            }
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-white text-sm leading-tight">{p.name}</span>
                            </div>
                            {(p.firstName || p.lastName) && (
                              <div className="text-white/35 text-xs mt-0.5 truncate">
                                {[p.firstName, p.lastName].filter(Boolean).join(' ')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-white/30 text-sm text-center py-12">선수 정보 없음</p>
          )}
        </div>

        {/* 상세 페이지 버튼 */}
        <div className="p-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={onNavigate}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all hover:brightness-110"
            style={{ backgroundColor: leagueColor, color: textOn(leagueColor) }}
          >
            상세 페이지
            <ArrowRight size={15} />
          </button>
          <p className="text-white/20 text-[10px] text-center mt-2">한 번 더 클릭해도 이동합니다</p>
        </div>
      </div>
    </>
  );
};

export default TeamPanel;
