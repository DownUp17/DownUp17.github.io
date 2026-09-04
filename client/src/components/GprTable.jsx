// client/src/components/GprTable.jsx
// GPR 팀별 점수(레이팅) 전체 랭킹 표 — 다크 배경 카드 안에서 사용
import React, { useState } from 'react';
import gpr from '../data/lolGpr.json';
import gprTeams from '../data/gprTeams.json';
import { textOn, lighten } from '../utils/colorContrast';

const leagueColor = Object.fromEntries(gpr.regions.map((r) => [r.key, r.color]));
const gprRanked = [...gprTeams.teams].sort((a, b) => b.score - a.score);
const gprMaxScore = Math.max(...gprRanked.map((t) => t.score));
// 동점 팀은 같은 순위 (standard competition ranking, 1224 방식).
const gprRankByShort = {};
gprRanked.forEach((t, i) => {
  gprRankByShort[t.short] = (i > 0 && gprRanked[i - 1].score === t.score)
    ? gprRankByShort[gprRanked[i - 1].short]
    : i + 1;
});

// 로고 (로드 실패 시 숨김)
export const TeamLogo = ({ src, size = 20 }) =>
  src ? (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="object-contain shrink-0"
      style={{ width: size, height: size }}
      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
    />
  ) : (
    <span className="shrink-0" style={{ width: size, height: size }} />
  );

const GprTable = ({ showIntro = true, selectedTeam, onTeamClick }) => {
  const [selected, setSelected] = useState([]);
  const toggleLeague = (key) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const visible = selected.length > 0 ? gprRanked.filter((t) => selected.includes(t.league)) : gprRanked;

  return (
  <div className="flex flex-col gap-4">
    {showIntro && (
      <p className="text-sm text-white/50">
        lolesports GPR 팀별 점수(레이팅) 전체 랭킹입니다. 이 점수가 시뮬레이션 승률 산출의 기준입니다.
      </p>
    )}
    <div className="flex flex-wrap gap-2">
      {gpr.regions.map((r) => {
        const on = selected.includes(r.key);
        return (
          <button
            key={r.key}
            onClick={() => toggleLeague(r.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${
              on ? '' : 'text-white/45 border-white/10 hover:border-white/30 hover:text-white/70 bg-transparent'
            }`}
            style={on ? { backgroundColor: r.color, borderColor: r.color, color: textOn(r.color) } : {}}
          >
            {r.name}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          onClick={() => setSelected([])}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/45 border border-white/10 hover:border-white/30 hover:text-white/70 bg-transparent"
        >
          전체 보기
        </button>
      )}
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-white/40 text-xs border-b border-white/10">
            <th className="text-center font-bold py-2 px-2 w-10">#</th>
            <th className="text-left font-bold py-2 pr-2">팀</th>
            <th className="text-center font-bold py-2 px-2">리그</th>
            <th className="text-center font-bold py-2 px-3 w-1/3">GPR 점수</th>
            <th className="text-center font-bold py-2 px-2">전적</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((t) => {
            const col = leagueColor[t.league] || '#888';
            const barCol = col;
            return (
              <tr
                key={t.short}
                className={`border-b border-white/5 cursor-pointer transition-colors ${selectedTeam === t.short ? 'bg-white/10' : 'hover:bg-white/5'}`}
                onClick={() => onTeamClick?.(t.short)}
              >
                <td className="py-2 px-2 text-center text-white/40 font-mono">{gprRankByShort[t.short]}</td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamLogo src={t.logo} />
                    <span className="font-bold text-white/90 truncate">{t.name}</span>
                    <span className="text-white/40 text-xs shrink-0">{t.short}</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-center">
                  <span
                    className="text-xs font-black px-2 py-0.5 rounded"
                    style={{ color: textOn(col), backgroundColor: col }}
                  >
                    {t.league}
                  </span>
                </td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3.5 bg-white/5 rounded-full overflow-hidden min-w-[60px]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(t.score / gprMaxScore) * 100}%`, backgroundColor: barCol }}
                      />
                    </div>
                    <span className="font-mono font-black tabular-nums w-10 text-right" style={{ color: lighten(barCol) }}>
                      {t.score}
                    </span>
                  </div>
                </td>
                <td className="py-2 px-2 text-center text-white/50 font-mono whitespace-nowrap">
                  {t.w != null ? `${t.w}-${t.l}` : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
  );
};

export default GprTable;
