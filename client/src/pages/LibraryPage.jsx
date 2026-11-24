// LoL 자료실 — 연도별 선수·팀·챔피언 검색.
//   연도별 기록: Leaguepedia 경기 기록(lolChampStats.json, 1부 리그·국제대회).
//   선수 페이지 연결·사진·포지션은 현재 로스터(lolRosters)·로스터 밖 선수(lolExtraPlayers) 이름 기준.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import rosters from '../data/lolRosters.json';
import gprTeams from '../data/gprTeams.json';
import extraPlayers from '../data/lolExtraPlayers.json';
import stats from '../data/lolChampStats.json';
import { TeamLogo } from '../components/GprTable';
import RoleIcon from '../components/RoleIcon';
import { YearDropdown } from './PredictionPage';

export const YEARS = Object.keys(stats.years).sort((a, b) => b - a);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const PLAYER_INFO = {}; // 이름 → { id, role, image }
for (const r of Object.values(rosters.rosters)) for (const p of r.players) PLAYER_INFO[norm(p.name)] ??= p;
for (const [id, p] of Object.entries(extraPlayers.players)) PLAYER_INFO[norm(p.name)] ??= { ...p, id };
const TEAM_BY_NAME = Object.fromEntries(gprTeams.teams.map((t) => [norm(t.name), t]));
// Leaguepedia 챔피언 이름 → CommunityDragon 키
const CD_KEY = { nunuwillump: 'nunu', wukong: 'monkeyking', renataglasc: 'renata' };
const champIcon = (c) => `https://cdn.communitydragon.org/latest/champion/${CD_KEY[norm(c)] || norm(c)}/square`;
// 챔피언 한글 이름(Data Dragon ko_KR) — 한글 검색·표시용
export const koName = (c) => stats.koNames?.[norm(c)] || '';
const champMatch = (c, k) => norm(c).includes(k) || norm(koName(c)).includes(k);
export const pct = (w, n) => (n ? `${Math.round((w / n) * 100)}%` : '-');

export const ChampImg = ({ c, size = 28 }) => (
  <img src={champIcon(c)} alt="" title={c} width={size} height={size} className="rounded shrink-0 bg-white/10" style={{ width: size, height: size }}
    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
);
const ROW = 'flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-left w-full';
const Row = ({ to, onClick, children }) => (to ? <Link to={to} className={ROW}>{children}</Link> : <button onClick={onClick} className={ROW}>{children}</button>);

// 챔피언 전용 페이지 주소 — 보고 있던 연도를 넘김
export const champPath = (c, year) => `/lol/library/champion/${encodeURIComponent(c)}${year ? `?year=${year}` : ''}`;

export default function LibraryPage() {
  const [q, setQ] = useState('');
  const [year, setYear] = useState(YEARS[0]);
  const data = stats.years[year];
  const k = norm(q);
  const players = useMemo(() => (k ? Object.entries(data.players).filter(([n]) => norm(n).includes(k)).sort((a, b) => b[1].n - a[1].n) : []), [k, data]);
  const teams = useMemo(() => (k ? Object.entries(data.teams).filter(([n]) => norm(n).includes(k) || norm(TEAM_BY_NAME[norm(n)]?.short) === k).sort((a, b) => b[1][0] - a[1][0]) : []), [k, data]);
  // 밴만 되고 픽되지 않은 챔피언도 목록에 포함
  const champs = useMemo(() => [...Object.entries(data.champs), ...Object.keys(data.bans || {}).filter((c) => !data.champs[c]).map((c) => [c, { n: 0, w: 0, r: {} }]),
    // 그 해 픽·밴이 한 번도 없던 챔피언도 전체 목록(koNames, Data Dragon 기준)에 0으로 포함
    ...Object.keys(stats.koNames || {}).filter((k) => !Object.keys(data.champs).concat(Object.keys(data.bans || {})).some((c) => norm(c) === k)).map((k) => [k, { n: 0, w: 0, r: {} }])].filter(([n]) => !k || champMatch(n, k))
    // 밴픽률(픽+밴 ÷ 그 해 경기) 높은 순, 같으면 경기 수
    .sort((a, b) => (b[1].n + (data.bans?.[b[0]] || 0)) - (a[1].n + (data.bans?.[a[0]] || 0)) || b[1].n - a[1].n), [k, data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] p-4 md:p-6 text-white">
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
        <h1 className="text-3xl md:text-4xl font-black text-white">LoL 자료실</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="ml-auto"><YearDropdown years={YEARS} value={year} onChange={setYear} ariaLabel="연도 선택" /></div>
        </div>
        <label className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus-within:border-[#C8963E]">
          <Search size={18} className="text-white/40" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="선수·팀·챔피언 검색 (예: Faker, T1, 애쉬)"
            className="flex-1 bg-transparent outline-none text-white placeholder:text-white/30" />
        </label>

        {!k && <p className="text-sm text-white/40">{year}년 경기 기록이 있는 선수 {Object.keys(data.players).length}명 · 팀 {Object.keys(data.teams).length}개 · 챔피언 {champs.length}개를 검색할 수 있습니다.</p>}
            {k && !players.length && !teams.length && !champs.length && <p className="text-sm text-white/40">검색 결과가 없습니다.</p>}
            {teams.length > 0 && (
              <section>
                <h2 className="text-sm font-black text-white/50 mb-2">팀 {teams.length}</h2>
                {teams.map(([n, [g, w]]) => {
                  const t = TEAM_BY_NAME[norm(n)];
                  return (
                    <Row key={n} to={t && `/lol/prediction/team/${t.short}`}>
                      <TeamLogo src={t?.logo} size={24} />
                      <span className="font-bold text-white/90">{n}</span>
                      {t && <span className="text-xs text-white/40">{t.short}</span>}
                      <span className="ml-auto text-xs text-white/50 font-mono">{g}경기 · 승률 {pct(w, g)}</span>
                    </Row>
                  );
                })}
              </section>
            )}
            {players.length > 0 && (
              <section>
                <h2 className="text-sm font-black text-white/50 mb-2">선수 {players.length}</h2>
                {players.map(([n, p]) => {
                  const info = PLAYER_INFO[norm(n)];
                  return (
                    <Row key={n} to={info?.id && `/lol/prediction/player/${info.id}`}>
                      {info?.image ? <img src={info.image} alt="" className="w-8 h-8 rounded-full object-cover bg-white/10 shrink-0" /> : <span className="w-8 h-8 rounded-full bg-white/10 shrink-0" />}
                      <span className="font-bold text-white/90">{n}</span>
                      {info?.role && <RoleIcon role={info.role} size={14} className="opacity-60" />}
                      <span className="text-xs text-white/40 truncate">{p.t}</span>
                      <span className="ml-auto flex items-center gap-1">{p.c.slice(0, 3).map(([c]) => <ChampImg key={c} c={c} size={20} />)}</span>
                      <span className="text-xs text-white/50 font-mono w-28 text-right shrink-0">{p.n}경기 · {pct(p.w, p.n)}</span>
                    </Row>
                  );
                })}
              </section>
            )}
        {champs.length > 0 && (
          <section className="flex flex-col gap-1">
            <div className="text-xs text-white/40 flex px-3 mb-1"><span className="font-black text-sm text-white/50">챔피언 {champs.length}</span><span className="ml-auto">승률 · 밴픽률 · 경기</span></div>
            {champs.map(([n, e]) => {
              const main = Object.entries(e.r).sort((a, b) => b[1][0] - a[1][0])[0]?.[0];
              return (
                <Row key={n} to={champPath(n, year)}>
                  <ChampImg c={n} />
                  <span className="font-bold text-white/90">{koName(n) || n}</span>
                  <RoleIcon role={main} size={14} className="opacity-60" />
                  <span className="ml-auto text-xs text-white/60 font-mono">{pct(e.w, e.n)} · {pct(e.n + (data.bans?.[n] || 0), data.games)} · {e.n}</span>
                </Row>
              );
            })}
          </section>
        )}
        <p className="text-[11px] text-white/30">출처 {stats.source} · 갱신 {stats.updatedAt}</p>
      </div>
    </div>
  );
}
