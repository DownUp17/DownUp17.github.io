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

const YEARS = Object.keys(stats.years).sort((a, b) => b - a);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const PLAYER_INFO = {}; // 이름 → { id, role, image }
for (const r of Object.values(rosters.rosters)) for (const p of r.players) PLAYER_INFO[norm(p.name)] ??= p;
for (const [id, p] of Object.entries(extraPlayers.players)) PLAYER_INFO[norm(p.name)] ??= { ...p, id };
const TEAM_BY_NAME = Object.fromEntries(gprTeams.teams.map((t) => [norm(t.name), t]));
// Leaguepedia 챔피언 이름 → CommunityDragon 키
const CD_KEY = { nunuwillump: 'nunu', wukong: 'monkeyking', renataglasc: 'renata' };
const champIcon = (c) => `https://cdn.communitydragon.org/latest/champion/${CD_KEY[norm(c)] || norm(c)}/square`;
const pct = (w, n) => (n ? `${Math.round((w / n) * 100)}%` : '-');

const ChampImg = ({ c, size = 28 }) => (
  <img src={champIcon(c)} alt="" title={c} width={size} height={size} className="rounded shrink-0 bg-white/10" style={{ width: size, height: size }}
    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
);
const ROW = 'flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-left w-full';
const Row = ({ to, onClick, children }) => (to ? <Link to={to} className={ROW}>{children}</Link> : <button onClick={onClick} className={ROW}>{children}</button>);

// 챔피언 상세 — 포지션별 기록 + 원딜/서폿이면 함께 자주 쓰인 상대 챔피언
function ChampDetail({ name, data }) {
  const e = data.champs[name] || { n: 0, w: 0, r: {} };
  const partners = (role) => Object.entries(data.pairs)
    .map(([k, v]) => { const [bot, sup] = k.split('|'); return role === 'Bot' && bot === name ? [sup, v] : role === 'Support' && sup === name ? [bot, v] : null; })
    .filter(Boolean).sort((a, b) => b[1][0] - a[1][0]).slice(0, 8);
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <ChampImg c={name} size={40} />
        <span className="font-black text-lg text-white">{name}</span>
        <span className="ml-auto text-sm text-white/60">{e.n}경기 · 승률 {pct(e.w, e.n)} · 밴 {data.bans?.[name] || 0} ({pct(data.bans?.[name] || 0, data.games)})</span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(e.r).sort((a, b) => b[1][0] - a[1][0]).map(([r, [n, w]]) => (
          <span key={r} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-white/70"><RoleIcon role={r} size={14} /> {n}경기 · {pct(w, n)}</span>
        ))}
      </div>
      {['Bot', 'Support'].filter((r) => e.r[r]).map((r) => {
        const list = partners(r);
        return list.length > 0 && (
          <div key={r}>
            <h3 className="text-xs font-black text-white/50 mb-2">{r === 'Bot' ? '함께 쓰인 서포터' : '함께 쓰인 원딜'} (경기 · 승률)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {list.map(([c, [n, w]]) => (
                <div key={c} className="flex items-center gap-2 text-xs text-white/70">
                  <ChampImg c={c} size={24} />
                  <span className="truncate">{c}</span>
                  <span className="ml-auto text-white/45 font-mono">{n} · {pct(w, n)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LibraryPage() {
  const [q, setQ] = useState('');
  const [year, setYear] = useState(YEARS[0]);
  const [tab, setTab] = useState('search');
  const [champ, setChamp] = useState(null);
  const data = stats.years[year];
  const k = norm(q);
  const players = useMemo(() => (k ? Object.entries(data.players).filter(([n]) => norm(n).includes(k)).sort((a, b) => b[1].n - a[1].n) : []), [k, data]);
  const teams = useMemo(() => (k ? Object.entries(data.teams).filter(([n]) => norm(n).includes(k) || norm(TEAM_BY_NAME[norm(n)]?.short) === k).sort((a, b) => b[1][0] - a[1][0]) : []), [k, data]);
  // 밴만 되고 픽되지 않은 챔피언도 목록에 포함
  const champs = useMemo(() => [...Object.entries(data.champs), ...Object.keys(data.bans || {}).filter((c) => !data.champs[c]).map((c) => [c, { n: 0, w: 0, r: {} }])].filter(([n]) => !k || norm(n).includes(k)).sort((a, b) => b[1].n - a[1].n), [k, data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] p-4 md:p-6 text-white">
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
        <h1 className="text-3xl md:text-4xl font-black text-white">LoL 자료실</h1>
        <div className="flex flex-wrap items-center gap-2">
          {[['search', '선수·팀'], ['champ', '챔피언']].map(([v, l]) => (
            <button key={v} onClick={() => { setTab(v); setChamp(null); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-black border ${tab === v ? 'bg-[#C8963E] border-[#C8963E] text-[#1e2328]' : 'border-white/10 text-white/50 hover:text-white/80'}`}>{l}</button>
          ))}
          <select value={year} onChange={(e) => { setYear(e.target.value); setChamp(null); }} aria-label="연도"
            className="ml-auto bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-bold text-white">
            {YEARS.map((y) => <option key={y} value={y} className="text-black">{y}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus-within:border-[#C8963E]">
          <Search size={18} className="text-white/40" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'champ' ? '챔피언 이름 검색 (예: Ashe)' : '선수 또는 팀 이름 검색 (예: Faker, T1)'}
            className="flex-1 bg-transparent outline-none text-white placeholder:text-white/30" />
        </label>

        {tab === 'search' && (
          <>
            {!k && <p className="text-sm text-white/40">{year}년 경기 기록이 있는 선수 {Object.keys(data.players).length}명 · 팀 {Object.keys(data.teams).length}개를 검색할 수 있습니다.</p>}
            {k && !players.length && !teams.length && <p className="text-sm text-white/40">검색 결과가 없습니다.</p>}
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
          </>
        )}

        {tab === 'champ' && (
          <section className="flex flex-col gap-1">
            {champ && (data.champs[champ] || data.bans?.[champ]) && <div className="mb-3"><ChampDetail name={champ} data={data} /></div>}
            <div className="text-xs text-white/40 flex px-3 mb-1"><span>챔피언 (클릭 시 상세)</span><span className="ml-auto">경기 · 승률 · 밴</span></div>
            {champs.map(([n, e]) => {
              const main = Object.entries(e.r).sort((a, b) => b[1][0] - a[1][0])[0]?.[0];
              return (
                <Row key={n} onClick={() => { setChamp(n); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <ChampImg c={n} />
                  <span className={`font-bold ${champ === n ? 'text-[#E8C77E]' : 'text-white/90'}`}>{n}</span>
                  <RoleIcon role={main} size={14} className="opacity-60" />
                  <span className="ml-auto text-xs text-white/60 font-mono">{e.n} · {pct(e.w, e.n)} · {data.bans?.[n] || 0}</span>
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
