// LoL 자료실 — 선수·팀 검색. 선수는 현재 로스터(lolRosters), 팀은 GPR 팀 목록(gprTeams) 기준.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import rosters from '../data/lolRosters.json';
import gprTeams from '../data/gprTeams.json';
import extraPlayers from '../data/lolExtraPlayers.json';
import { TeamLogo } from '../components/GprTable';

const teamByShort = Object.fromEntries(gprTeams.teams.map((t) => [t.short, t]));
const ROLE_KO = { top: '탑', jungle: '정글', mid: '미드', bottom: '원딜', support: '서폿' };
const PLAYERS = Object.entries(rosters.rosters).flatMap(([short, r]) =>
  r.players.map((p) => ({ ...p, short, team: teamByShort[short] })))
  // 로스터 밖 선수(복귀 예정·명예의 전당)
  .concat(Object.entries(extraPlayers.players).map(([id, p]) => ({ ...p, id, short: p.note })));
const TEAMS = [...gprTeams.teams].sort((a, b) => a.name.localeCompare(b.name));
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');

export default function LibraryPage() {
  const [q, setQ] = useState('');
  const k = norm(q);
  const players = k ? PLAYERS.filter((p) => [p.name, p.firstName, p.lastName, `${p.lastName}${p.firstName}`].some((s) => norm(s).includes(k))) : [];
  const teams = k ? TEAMS.filter((t) => norm(t.name).includes(k) || norm(t.short).includes(k)) : [];
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] p-4 md:p-6 text-white">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <h1 className="text-3xl md:text-4xl font-black text-white">LoL 자료실</h1>
        <label className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus-within:border-[#C8963E]">
          <Search size={18} className="text-white/40" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="선수 또는 팀 이름 검색 (예: Faker, T1)"
            className="flex-1 bg-transparent outline-none text-white placeholder:text-white/30" />
        </label>
        {!k && <p className="text-sm text-white/40">선수 {PLAYERS.length}명 · 팀 {TEAMS.length}개를 검색할 수 있습니다.</p>}
        {k && !players.length && !teams.length && <p className="text-sm text-white/40">검색 결과가 없습니다.</p>}
        {teams.length > 0 && (
          <section>
            <h2 className="text-sm font-black text-white/50 mb-2">팀 {teams.length}</h2>
            <div className="flex flex-col">
              {teams.map((t) => (
                <Link key={t.short} to={`/lol/prediction/team/${t.short}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5">
                  <TeamLogo src={t.logo} size={24} />
                  <span className="font-bold text-white/90">{t.name}</span>
                  <span className="text-xs text-white/40">{t.short}</span>
                  <span className="ml-auto text-xs text-white/40">{t.league}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {players.length > 0 && (
          <section>
            <h2 className="text-sm font-black text-white/50 mb-2">선수 {players.length}</h2>
            <div className="flex flex-col">
              {players.map((p) => (
                <Link key={`${p.short}-${p.id}`} to={`/lol/prediction/player/${p.id}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5">
                  {p.image ? <img src={p.image} alt="" className="w-8 h-8 rounded-full object-cover bg-white/10" /> : <span className="w-8 h-8 rounded-full bg-white/10" />}
                  <span className="font-bold text-white/90">{p.name}</span>
                  <span className="text-xs text-white/40">{p.lastName} {p.firstName}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs text-white/50">
                    {ROLE_KO[p.role] || p.role}
                    <TeamLogo src={p.team?.logo} size={18} />
                    {p.team?.name || p.short}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
