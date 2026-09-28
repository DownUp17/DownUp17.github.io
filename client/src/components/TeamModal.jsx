// client/src/components/TeamModal.jsx
import React, { useEffect } from 'react';
import RoleIcon from './RoleIcon';
import { X } from 'lucide-react';
import rosters from '../data/lolRosters.json';
import gprTeamsData from '../data/gprTeams.json';
import { textOn } from '../utils/colorContrast';
import gpr from '../data/lolGpr.json';

const gprTeamMap = Object.fromEntries(gprTeamsData.teams.map(t => [t.short, t]));
const leagueColorMap = Object.fromEntries(gpr.regions.map(r => [r.key, r.color]));

const ROLE_ORDER = ['top', 'jungle', 'mid', 'bottom', 'support'];

const PlayerCard = ({ player, leagueColor }) => (
  <div className="flex flex-col items-center gap-1.5 p-2">
    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-white/5 shrink-0">
      {player.image ? (
        <img
          src={player.image}
          alt={player.name}
          className="w-full h-full object-cover object-top"
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">?</div>
      )}
    </div>
    <div className="text-center min-w-0">
      <div className="font-black text-white text-sm leading-tight">{player.name}</div>
      {(player.firstName || player.lastName) && (
        <div className="text-white/40 text-[10px] leading-tight mt-0.5 truncate">
          {[player.firstName, player.lastName].filter(Boolean).join(' ')}
        </div>
      )}
      <span
        className="inline-block mt-1 text-[9px] font-black px-1.5 py-0.5 rounded"
        style={{ backgroundColor: leagueColor + '33', color: leagueColor }}
      >
        <RoleIcon role={player.role} size={12} className="align-middle" />
      </span>
    </div>
  </div>
);

const TeamModal = ({ teamShort, onClose }) => {
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
  if (roster?.players) {
    for (const p of roster.players) {
      if (!playersByRole[p.role]) playersByRole[p.role] = [];
      playersByRole[p.role].push(p);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-4 p-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {team.logo && (
            <img src={team.logo} alt={team.short} className="w-12 h-12 object-contain shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-white text-lg leading-tight">{team.name}</span>
              <span
                className="text-xs font-black px-2 py-0.5 rounded"
                style={{ backgroundColor: leagueColor, color: textOn(leagueColor) }}
              >
                {team.league}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
              <span>GPR <span className="font-black text-white/70">{team.score}</span></span>
              {team.w != null && (
                <span>{team.w}승 {team.l}패</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 선수 목록 */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {roster?.players?.length > 0 ? (
            <div className="flex flex-col gap-3">
              {ROLE_ORDER.map(role => {
                const players = playersByRole[role];
                if (!players?.length) return null;
                return (
                  <div key={role}>
                    <div className="mb-1 px-1 opacity-50"><RoleIcon role={role} size={16} /></div>
                    <div className="flex gap-1 flex-wrap">
                      {players.map(p => (
                        <PlayerCard key={p.name} player={p} leagueColor={leagueColor} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-white/30 text-sm text-center py-8">선수 정보 없음</p>
          )}
          <p className="text-white/20 text-[10px] text-right mt-4">
            출처: lolesports.com · {rosters.updatedAt} 기준
          </p>
        </div>
      </div>
    </div>
  );
};

export default TeamModal;
