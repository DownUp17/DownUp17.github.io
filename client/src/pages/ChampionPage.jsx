// 챔피언 전용 페이지 — 시즌(연도)별 경기·승률·밴 + 선택 시즌의 포지션별 기록과 바텀 조합.
//   기록: lolChampStats.json(Leaguepedia, 1부 리그·국제대회). 자료실에서 진입.
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import stats from '../data/lolChampStats.json';
import RoleIcon from '../components/RoleIcon';
import gpr from '../data/lolGpr.json';
import leaguesData from '../data/lolLeagues.json';
import { textOn } from '../utils/colorContrast';
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
  // 그 해 주 패치(경기 수가 가장 많은 메이저 버전)만 — 이전 시즌 패치로 치른 대회·패치 미상('?') 제외
  const byMajor = {};
  for (const r of rows) if (/^\d+\./.test(r[0])) byMajor[r[0].split('.')[0]] = (byMajor[r[0].split('.')[0]] || 0) + r[4];
  const major = Object.entries(byMajor).sort((a, b) => b[1] - a[1])[0]?.[0];
  const pts = rows.filter((r) => r[4] > 0 && r[0].split('.')[0] === major).map(([k, n, , b, g, lgs]) => [k, n / g, b / g, n, b, g, lgs]);
  const max = 1; // 막대 최대 길이 = 100% (데이터 오류로 100% 넘는 값은 아래에서 잘림)
  const [hover, setHover] = useState(null);
  return pts.length > 0 && (
    <div>
      <h3 className="flex items-center gap-3 text-xs font-black text-white/40 mb-2">패치별 픽·밴률
        <span className="inline-flex items-center gap-1 font-bold"><i className="w-2.5 h-2.5 rounded-sm bg-[#5B8DEF]" />픽</span>
        <span className="inline-flex items-center gap-1 font-bold"><i className="w-2.5 h-2.5 rounded-sm bg-[#E8615A]" />밴</span>
      </h3>
      {/* 패치 수와 상관없이 가로 폭을 꽉 채움. 막대 칸에 커서를 올리면 그 패치 수치 표시 */}
      <div className="flex items-start w-full" onMouseLeave={() => setHover(null)}>
        {pts.map(([k, pr, br, n, b, g, lgs], i) => (
          <div key={k} className={`relative flex-1 min-w-0 flex flex-col items-center rounded ${hover === i ? 'bg-white/5' : ''}`}
            onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
            {hover === i && (
              <div className={`absolute bottom-full mb-1 z-10 whitespace-nowrap rounded-lg bg-black/75 backdrop-blur-sm border border-white/10 px-3 py-2 text-[11px] font-mono text-white/85 shadow-lg ${i < pts.length / 2 ? 'left-0' : 'right-0'}`}>
                <div className="font-black text-white">패치 {k} <span className="font-normal text-white/40">· {g}경기</span></div>
                <div className="mt-1 pl-2 flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#5B8DEF]" />픽 <b className="text-white">{pct(n, g)}</b> <span className="text-white/45">({n})</span></div>
                <div className="pl-2 flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#E8615A]" />밴 <b className="text-white">{pct(b, g)}</b> <span className="text-white/45">({b})</span></div>
              </div>
            )}
            <div className="flex items-end justify-center gap-0.5 h-28 w-full">
              <div className="w-1/3 max-w-[10px] rounded-t bg-[#5B8DEF]" style={{ height: `${Math.min(1, pr / max) * 100}%` }} />
              <div className="w-1/3 max-w-[10px] rounded-t bg-[#E8615A]" style={{ height: `${Math.min(1, br / max) * 100}%` }} />
            </div>
            <span className="mt-1 text-[9px] text-white/40 font-mono truncate max-w-full">{k}</span>
            {/* 이 패치로 경기가 치러진 국제 대회 */}
            <div className="mt-1 flex flex-col items-center gap-0.5">
              {lgs.filter(isIntl).map((l) => (leagueLogo(l)
                ? <img key={l} src={leagueLogo(l)} alt={l} title={l} className="w-3.5 h-3.5 object-contain opacity-80" />
                : <span key={l} title={l} className="text-[7px] leading-none text-white/35 font-bold max-w-full truncate">{l}</span>))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};// 대회 약칭(Leaguepedia) → lolesports 리그 로고. 없는 옛 대회는 글자로 표시
const LG_BY_SLUG = Object.fromEntries((leaguesData.leagues || []).map((l) => [l.slug, l.image]));
const LG_BY_NAME = Object.fromEntries((leaguesData.leagues || []).map((l) => [l.name.toUpperCase(), l.image]));
const LG_SLUG = { Worlds: 'worlds', FST: 'first_stand', EWC: 'ewc_lol', DC: 'demacia_cup', 'LTA N': 'lta_n', 'LTA S': 'lta_s', LTA: 'lta_cross', AG: 'asian_games' };
// 국제 대회(패치 아래 로고 표시 대상)
const INTL = new Set(['Worlds', 'MSI', 'FST', 'EWC', 'MSC', 'IEM', 'RR', 'AG', 'IWCQ', 'Masters']);
const isIntl = (l) => INTL.has(l) || /Rift Rivals|Wildcard|IWC/.test(l);
const leagueLogo = (l) => LG_BY_SLUG[LG_SLUG[l]] || LG_BY_NAME[l.toUpperCase()];
const LEAGUE_COLOR = Object.fromEntries(gpr.regions.map((r) => [r.key, r.color]));
const mainRole = (e) => Object.entries(e?.r || {}).sort((a, b) => b[1][0] - a[1][0])[0]?.[0];

export default function ChampionPage() {
  const { name: raw } = useParams();
  const name = decodeURIComponent(raw);
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  useEffect(() => { window.scrollTo(0, 0); }, [name]);
  // 리그·패치별 기록은 용량이 커서 이 페이지에서만 따로 불러옴
  const [detail, setDetail] = useState(null);
  const [sel, setSel] = useState([]);
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
  // 리그 선택(GPR 리그 버튼과 같은 방식, 비우면 전체) — 리그별로 나뉜 기록(lolChampDetail)을 골라 합산
  const dy = detail?.years?.[year];
  const dc = dy?.champs?.[name] || {}, db = dy?.bans?.[name] || {};
  const leagues = dy ? Object.keys(dy.gLP).filter((l) => dc[l] || db[l]).sort((a, b) => (dc[b]?.n || 0) - (dc[a]?.n || 0)) : [];
  const picked = sel.filter((l) => leagues.includes(l));
  const on = (l) => !picked.length || picked.includes(l);
  const sum = (o, k, v) => { o[k] = o[k] || [0, 0]; o[k][0] += v[0]; o[k][1] += v[1]; };
  let e = data.champs[name] || { n: 0, w: 0, r: {} }, bans = data.bans?.[name] || 0, games = data.games, byPatch = [], byLeague = [], pairs = data.pairs;
  if (dy) {
    e = { n: 0, w: 0, r: {} }; bans = 0; games = 0; pairs = {};
    const pP = {}, bP = {}, gP = {}, lgP = {};
    for (const l of Object.keys(dy.gLP)) {
      if (!on(l)) continue;
      const c = dc[l];
      if (c) { e.n += c.n; e.w += c.w; for (const [r, v] of Object.entries(c.r)) sum(e.r, r, v); for (const [p, v] of Object.entries(c.p)) sum(pP, p, v); }
      for (const [p, b] of Object.entries(db[l] || {})) { bans += b; bP[p] = (bP[p] || 0) + b; }
      for (const [p, g] of Object.entries(dy.gLP[l])) { games += g; gP[p] = (gP[p] || 0) + g; (lgP[p] ??= []).push(l); }
      for (const [k, v] of Object.entries(dy.pairs?.[l] || {})) sum(pairs, k, v);
    }
    byPatch = [...new Set([...Object.keys(pP), ...Object.keys(bP)])].map((p) => [p, pP[p]?.[0] || 0, pP[p]?.[1] || 0, bP[p] || 0, gP[p] || 0, lgP[p] || []]).sort((a, b) => patchCmp(b[0], a[0])); // 오래된 패치부터
    byLeague = leagues.filter(on).map((l) => { const b = Object.values(db[l] || {}).reduce((a, x) => a + x, 0); const g = Object.values(dy.gLP[l]).reduce((a, x) => a + x, 0); return [l, dc[l]?.n || 0, dc[l]?.w || 0, b, g]; });
  }
  const role = mainRole(e);
  // 주 포지션이 원딜이면 같이 쓰인 서포터, 서포터면 같이 쓰인 원딜
  const partners = role === 'Bot' || role === 'Support'
    ? Object.entries(pairs).map(([k, v]) => { const [bot, sup] = k.split('|'); return role === 'Bot' && bot === name ? [sup, v] : role === 'Support' && sup === name ? [bot, v] : null; })
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

        {/* 연도 선택 — 아래 블록 전체가 그 연도 기준 */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-black text-white/40">시즌</span>
          <select value={year} onChange={(ev) => setSp({ year: ev.target.value }, { replace: true })} aria-label="연도"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-bold text-white">
            {seasons.map(([y]) => <option key={y} value={y} className="text-black">{y}</option>)}
          </select>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5 flex flex-col gap-8">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-xl font-black text-[#E8C77E]">{year} 시즌</h2>
            <span className="text-sm text-white/60 font-mono">{picked.length ? `${picked.join('·')} · ` : ''}{e.n}경기 · 승률 {pct(e.w, e.n)} · 밴 {bans} ({pct(bans, games)})</span>
          </div>
          {leagues.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {leagues.map((l) => {
                const act = picked.includes(l), col = LEAGUE_COLOR[l] || '#C8963E';
                return (
                  <button key={l} onClick={() => setSel((s) => (s.includes(l) ? s.filter((x) => x !== l) : [...s, l]))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${act ? '' : 'text-white/45 border-white/10 hover:border-white/30 hover:text-white/70 bg-transparent'}`}
                    style={act ? { backgroundColor: col, borderColor: col, color: textOn(col) } : {}}>{l}</button>
                );
              })}
              {picked.length > 0 && <button onClick={() => setSel([])} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/45 border border-white/10 hover:border-white/30 hover:text-white/70">전체 보기</button>}
            </div>
          )}
          {/* 맨 위: 패치별 픽·밴률 + 포지션 비율 */}
          <section className="flex flex-col gap-5">
            {!detail ? <p className="text-xs text-white/40">불러오는 중…</p> : <PatchChart rows={byPatch} />}
            <div>
              <h3 className="text-xs font-black text-white/40 mb-2">포지션 비율</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(e.r).sort((a, b) => b[1][0] - a[1][0]).map(([r, [n, w]]) => (
                  <span key={r} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-white/70"><RoleIcon role={r} size={14} /> <b className="text-white/90">{pct(n, e.n)}</b> <span className="text-white/45">({n}경기)</span></span>
                ))}
                {!e.n && <span className="text-white/40">픽 기록 없음</span>}
              </div>
            </div>
          </section>

          {detail && <BreakTable title="리그(대회)별" rows={byLeague} />}

          {partners.length > 0 && (
            <section>
              <h2 className="flex items-center gap-1 text-xs font-black text-white/30 uppercase tracking-widest mb-3">같이 쓰인 <RoleIcon role={role === 'Bot' ? 'support' : 'bottom'} size={14} /></h2>
              {/* 왼쪽 1–5위, 오른쪽 6–10위. 채용률 = 이 챔피언이 주 포지션으로 나온 경기 중 그 챔피언과 함께한 비율 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                {[partners.slice(0, 5), partners.slice(5, 10)].filter((col) => col.length).map((col, ci) => (
                  <div key={ci}>
                    <div className="flex items-center gap-2 px-2 pb-1 mb-1 text-[11px] font-bold text-white/35 border-b border-white/10">
                      <span className="w-5 text-center">#</span><span className="flex-1">챔피언</span><span className="w-24 text-right">채용률(경기)</span><span className="w-10 text-right">승률</span>
                    </div>
                    {col.map(([c, [n, w]], i) => (
                      <Link key={c} to={champPath(c, year)} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-white/80 hover:bg-white/5">
                        <span className="w-5 text-center text-xs text-white/40 font-mono">{ci * 5 + i + 1}</span>
                        <ChampImg c={c} size={24} />
                        <span className="flex-1 truncate">{koName(c) || c}</span>
                        <span className="w-24 text-right text-xs font-mono">{pct(n, e.r[role]?.[0] || 0)} <span className="text-white/40">({n})</span></span>
                        <span className="w-10 text-right text-xs font-mono text-white/60">{pct(w, n)}</span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <section>
          <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">전체 시즌 요약</h2>
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
          <p className="mt-2 text-[11px] text-white/30">행을 누르면 위 시즌이 그 연도로 바뀝니다.</p>
        </section>
        <p className="text-[11px] text-white/30">출처 {stats.source} · 갱신 {stats.updatedAt}</p>
      </div>
    </div>
  );
}
