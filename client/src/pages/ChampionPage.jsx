// 챔피언 전용 페이지 — 시즌(연도)별 경기·승률·밴 + 선택 시즌의 포지션별 기록과 바텀 조합.
//   기록: lolChampStats.json(Leaguepedia, 1부 리그·국제대회). 자료실에서 진입.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import stats from '../data/lolChampStats.json';
import RoleIcon from '../components/RoleIcon';
import { YEARS, koName, pct, ChampImg, champPath } from './LibraryPage';

// 패치 정렬: 26.1 > 25.24 > 25.3 (숫자 비교)
const patchCmp = (a, b) => { const [x, y] = [a, b].map((s) => String(s).split('.').map(Number)); return (y[0] - x[0]) || ((y[1] || 0) - (x[1] || 0)); };
// 리그·패치별 표 — [이름, 경기, 승률, 밴, 밴률]
const BreakTable = ({ title, rows }) => rows.length > 0 && (
  <div>
    <h3 className="text-xs font-black text-white/40 mb-2">{title}</h3>
    <table className="w-full text-sm border-collapse">
      <thead><tr className="text-white/40 text-xs border-b border-white/10"><th className="text-left font-bold py-1.5 px-2"></th><th className="text-right font-bold py-1.5 px-2">경기</th><th className="text-right font-bold py-1.5 px-2">승률</th><th className="text-right font-bold py-1.5 px-2">밴</th><th className="text-right font-bold py-1.5 px-2">밴률</th></tr></thead>
      <tbody>{rows.map(([k, n, w, b, g]) => (
        <tr key={k} className="border-b border-white/5"><td className="py-1.5 px-2 font-bold text-white/80">{k}</td><td className="py-1.5 px-2 text-right font-mono">{n}</td><td className="py-1.5 px-2 text-right font-mono">{pct(w, n)}</td><td className="py-1.5 px-2 text-right font-mono">{b}</td><td className="py-1.5 px-2 text-right font-mono text-white/60">{pct(b, g)}</td></tr>
      ))}</tbody>
    </table>
  </div>
);
// 패치별 픽률·밴률 막대 — 패치 순서대로(왼쪽 = 시즌 초), 그 패치 전체 경기 대비
const PatchChart = ({ rows }) => {
  const pts = rows.filter((r) => r[4] > 0).map(([k, n, , b, g]) => [k, n / g, b / g, n, b, g]);
  const max = Math.max(0.01, ...pts.flatMap((p) => [p[1], p[2]]));
  return pts.length > 0 && (
    <div>
      <h3 className="flex items-center gap-3 text-xs font-black text-white/40 mb-2">패치별 픽·밴률
        <span className="inline-flex items-center gap-1 font-bold"><i className="w-2.5 h-2.5 rounded-sm bg-[#5B8DEF]" />픽</span>
        <span className="inline-flex items-center gap-1 font-bold"><i className="w-2.5 h-2.5 rounded-sm bg-[#E8615A]" />밴</span>
      </h3>
      <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
        {pts.map(([k, pr, br, n, b, g]) => (
          <div key={k} className="flex flex-col items-center shrink-0" style={{ minWidth: 22 }} title={`패치 ${k} · ${g}경기 · 픽 ${n} (${pct(n, g)}) · 밴 ${b} (${pct(b, g)})`}>
            <div className="flex items-end gap-px h-24">
              <div className="w-2 rounded-t bg-[#5B8DEF]" style={{ height: `${(pr / max) * 100}%` }} />
              <div className="w-2 rounded-t bg-[#E8615A]" style={{ height: `${(br / max) * 100}%` }} />
            </div>
            <span className="mt-1 text-[9px] text-white/40 font-mono">{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
};const mainRole = (e) => Object.entries(e?.r || {}).sort((a, b) => b[1][0] - a[1][0])[0]?.[0];

export default function ChampionPage() {
  const { name: raw } = useParams();
  const name = decodeURIComponent(raw);
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  useEffect(() => { window.scrollTo(0, 0); }, [name]);
  // 리그·패치별 기록은 용량이 커서 이 페이지에서만 따로 불러옴
  const [detail, setDetail] = useState(null);
  useEffect(() => { import('../data/lolChampDetail.json').then((m) => setDetail(m.default)); }, []);
  // 시즌별 기록 — 픽·밴이 하나라도 있는 연도만
  const seasons = YEARS.map((y) => [y, stats.years[y]]).filter(([, d]) => d.champs[name] || d.bans?.[name]);
  const year = seasons.some(([y]) => y === sp.get('year')) ? sp.get('year') : seasons[0]?.[0];
  const data = stats.years[year];
  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-white/50 text-lg font-bold">챔피언 기록이 없습니다</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-sm text-white/40 hover:text-white/70">← 돌아가기</button>
        </div>
      </div>
    );
  }
  const e = data.champs[name] || { n: 0, w: 0, r: {} };
  const role = mainRole(e);
  // 선택 시즌의 리그·패치별 [이름, 경기, 승률용 승, 밴, 그 리그·패치 전체 경기]
  const dy = detail?.years?.[year];
  const dc = dy?.champs?.[name] || {}, db = dy?.bans?.[name] || {};
  const split = (key, totals) => [...new Set([...Object.keys(dc[key] || {}), ...Object.keys(db[key] || {})])]
    .map((k) => [k, dc[key]?.[k]?.[0] || 0, dc[key]?.[k]?.[1] || 0, db[key]?.[k] || 0, totals?.[k] || 0]);
  const byLeague = split('l', dy?.gL).sort((a, b) => b[1] - a[1] || b[3] - a[3]);
  const byPatch = split('p', dy?.gP).sort((a, b) => patchCmp(b[0], a[0])); // 오래된 패치부터
  // 주 포지션이 원딜이면 같이 쓰인 서포터, 서포터면 같이 쓰인 원딜
  const partners = role === 'Bot' || role === 'Support'
    ? Object.entries(data.pairs).map(([k, v]) => { const [bot, sup] = k.split('|'); return role === 'Bot' && bot === name ? [sup, v] : role === 'Support' && sup === name ? [bot, v] : null; })
      .filter(Boolean).sort((a, b) => b[1][0] - a[1][0]).slice(0, 10)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] p-6 md:p-12 text-white">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-white/40 hover:text-white/70 transition-colors text-sm font-bold self-start">
          <ChevronLeft size={16} /> 돌아가기
        </button>

        <div className="flex items-center gap-5 pb-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <ChampImg c={name} size={96} />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-black text-white truncate">{koName(name) || name}</h1>
            <p className="text-white/50 text-sm mt-0.5">{name}</p>
            {role && <div className="mt-2"><RoleIcon role={role} size={18} /></div>}
          </div>
        </div>

        <section>
          <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">시즌별 기록</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/10">
                <th className="text-left font-bold py-2 px-2">시즌</th>
                <th className="text-center font-bold py-2 px-2">포지션</th>
                <th className="text-right font-bold py-2 px-2">경기</th>
                <th className="text-right font-bold py-2 px-2">승률</th>
                <th className="text-right font-bold py-2 px-2">밴</th>
                <th className="text-right font-bold py-2 px-2">밴률</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map(([y, d]) => {
                const s = d.champs[name] || { n: 0, w: 0 };
                const b = d.bans?.[name] || 0;
                return (
                  <tr key={y} onClick={() => setSp({ year: y }, { replace: true })}
                    className={`border-b border-white/5 cursor-pointer ${y === year ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                    <td className="py-2 px-2 font-bold">{y}</td>
                    <td className="py-2 px-2 text-center">{mainRole(s) && <RoleIcon role={mainRole(s)} size={14} className="opacity-70" />}</td>
                    <td className="py-2 px-2 text-right font-mono">{s.n}</td>
                    <td className="py-2 px-2 text-right font-mono">{pct(s.w, s.n)}</td>
                    <td className="py-2 px-2 text-right font-mono">{b}</td>
                    <td className="py-2 px-2 text-right font-mono text-white/60">{pct(b, d.games)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-white/30">시즌을 누르면 아래 상세가 그 시즌 기준으로 바뀝니다.</p>
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="text-xs font-black text-white/30 uppercase tracking-widest">{year} 리그별 · 패치 추이</h2>
          {!detail ? <p className="text-xs text-white/40">불러오는 중…</p> : (<>
            <BreakTable title="리그(대회)별" rows={byLeague} />
            <PatchChart rows={byPatch} />
          </>)}
        </section>

        <section>
          <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">{year} 포지션별</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(e.r).sort((a, b) => b[1][0] - a[1][0]).map(([r, [n, w]]) => (
              <span key={r} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-white/70"><RoleIcon role={r} size={14} /> {n}경기 · {pct(w, n)}</span>
            ))}
            {!e.n && <span className="text-white/40">픽 기록 없음</span>}
          </div>
        </section>

        {partners.length > 0 && (
          <section>
            <h2 className="flex items-center gap-1 text-xs font-black text-white/30 uppercase tracking-widest mb-3">{year} 같이 쓰인 <RoleIcon role={role === 'Bot' ? 'support' : 'bottom'} size={14} /> (경기 · 승률)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {partners.map(([c, [n, w]]) => (
                <Link key={c} to={champPath(c, year)} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-white/80 hover:bg-white/5">
                  <ChampImg c={c} size={24} />
                  <span className="truncate">{koName(c) || c}</span>
                  <span className="ml-auto text-xs text-white/45 font-mono">{n} · {pct(w, n)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
        <p className="text-[11px] text-white/30">출처 {stats.source} · 갱신 {stats.updatedAt}</p>
      </div>
    </div>
  );
}
