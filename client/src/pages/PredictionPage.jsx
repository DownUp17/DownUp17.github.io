// client/src/pages/PredictionPage.jsx
import React, { useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Target, Trophy, ExternalLink, Crown, Hourglass } from 'lucide-react';
import sim from '../data/lolSim.json';
import gpr from '../data/lolGpr.json';
import gprTeams from '../data/gprTeams.json';
import officialStandings from '../data/lolStandings.json';
import GprTable, { TeamLogo } from '../components/GprTable';
import TeamPanel from '../components/TeamPanel';
import { textOn, lighten } from '../utils/colorContrast';
import demaciaLogo from '../assets/demacia.svg';

const statusMeta = {
  finished: { label: '종료', color: '#34D399', bg: 'rgba(52,211,153,0.15)' },
  ongoing: { label: '진행중', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)' },
  upcoming: { label: '예정', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
};

// 본문 추후 제공 대회 (정보 미준비)
const CONTENT_TBD = new Set([
  'fst',
  'lck|LCK CUP',
  'lpl|Split 1', 'lpl|Split 2',
  'lec|Versus', 'lec|Spring',
  'lcp|Split 1', 'lcp|Split 2',
  'lcs|Lock-In', 'lcs|Spring',
  'cblol|Copa', 'cblol|Split 1',
]);
const isContentTbd = (key, sub) =>
  CONTENT_TBD.has(key) || (sub ? CONTENT_TBD.has(`${key}|${sub}`) : false);

// 팀 short → 실제 전적(GPR 기준). gw/gl = 세트(게임) 승-패
const recordByShort = Object.fromEntries(
  gprTeams.teams.map((t) => [t.short, { w: t.w ?? 0, l: t.l ?? 0, gw: t.gw, gl: t.gl }])
);
// LCK 그룹 심볼 (레전드/라이즈) — 플레이-인/플레이오프 순위표 등수 앞에 표기
const GroupSymbol = ({ group, size = 16 }) => (
  group === 'Legend' ? (
    <svg width={size} height={size} viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M0 0v30h30L20 20H10V10zm20 0 10 10V0Z" fill="#f38a5c" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M0 0v10L10 0Zm20 0L10 10h10v10l10-10V0Zm0 20H10l10 10h10V20Zm-10 0V10L0 20v10h10z" fill="#76b6fc" />
    </svg>
  )
);

// 팀 short → 로고 / 풀네임
const logoByShort = Object.fromEntries(gprTeams.teams.map((t) => [t.short, t.logo]));
const nameByShort = Object.fromEntries(gprTeams.teams.map((t) => [t.short, t.name]));
// 팀 short → GPR 점수 (대진 확정·미진행 경기의 승부예측에 사용)
const gprScoreByShort = Object.fromEntries(gprTeams.teams.map((t) => [t.short, t.score]));

// Elo식 단판 승률 + Bo5 시리즈 승률 (scripts/simulateLol.mjs 와 동일 공식) — 대진표 미진행 경기 예측용
const ELO_SCALE = 400;
const bracketGameProb = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / ELO_SCALE));
const bracketBo5Prob = (pa) => { const q = 1 - pa; return pa * pa * pa * (1 + 3 * q + 6 * q * q); };
// 매치의 양 팀이 모두 확정(short 보유)이고 아직 결과가 안 나왔으면(점수·승패 표기 없음) 승부예측 %를 반환
const matchPrediction = (a, b) => {
  if (!a?.short || !b?.short) return null;
  const played = a.score != null || b.score != null || a.win || a.elim || a.msi || b.win || b.elim || b.msi;
  if (played) return null;
  const ra = gprScoreByShort[a.short], rb = gprScoreByShort[b.short];
  if (ra == null || rb == null) return null;
  const pA = Math.round(bracketBo5Prob(bracketGameProb(ra, rb)) * 100);
  return { pA, pB: 100 - pA };
};

// Road to MSI(선발전) 사다리식 대진표 — 실제 점수·진출/MSI 결과 표기
const MsiSlot = ({ s, predPct, onTeamClick }) => {
  // MSI(토너먼트) 진출 = 금색, 하위 라운드 승자 = 파랑, 탈락 = 빨강 배경
  const accent = s?.msi ? '#E8C77E' : s?.win ? '#60A5FA' : null;
  const bg = s?.msi ? 'rgba(232,199,126,0.16)' : s?.win ? 'rgba(96,165,250,0.14)' : s?.elim ? 'rgba(248,113,113,0.18)' : 'transparent';
  const label = s?.seed || s?.label || '';
  const clickable = !!(s?.short && onTeamClick);
  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-2 min-h-[36px]${clickable ? ' cursor-pointer hover:brightness-125 transition-all' : ''}`}
      style={{ backgroundColor: bg }}
      onClick={clickable ? () => onTeamClick(s.short) : undefined}
    >
      {s?.short ? (
        <>
          {label && <span className="text-[10px] text-white/40 shrink-0 max-w-[80px] truncate">{label}</span>}
          <TeamLogo src={logoByShort[s.short]} size={16} />
          <span className="text-xs font-bold truncate" style={{ color: accent || 'rgba(255,255,255,0.88)' }}>{s.short}</span>
        </>
      ) : (
        <span className="text-xs text-white/35 truncate">{label || '미정'}</span>
      )}
      {s?.score != null ? (
        <span className="ml-auto text-sm font-black font-mono shrink-0" style={{ color: accent || 'rgba(255,255,255,0.45)' }}>
          {s.score}
        </span>
      ) : predPct != null && (
        <span className="ml-auto text-xs font-black font-mono shrink-0 text-white/55">
          {predPct}%
        </span>
      )}
    </div>
  );
};
const SLOT_H = 54;
const LABEL_H = 20;
const GAP_ROW = 2;
const COL_W = 200;
const COL_GAP = 16;
const ACTUAL_SLOT_H = 39; // 실제 슬롯(팀 한 줄) 렌더 높이 — connY 슬롯 중심 계산 기준

const gridSlotTop = (r) => LABEL_H + r * SLOT_H + (r >= GAP_ROW ? LABEL_H : 0);

// 공통 대진표 배경색 범례. 대회별로 goldLabel만 다름 (우승/MSI 진출/진출 등).
const BracketLegend = ({ goldLabel = '우승/진출' }) => (
  <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-white/50">
    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(232,199,126,0.7)' }} /> {goldLabel}</span>
    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }} /> 라운드 승리</span>
    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(248,113,113,0.6)' }} /> 탈락</span>
  </div>
);

// DEMACIA 브래킷 — 컬럼당 여러 브래킷 그룹을 세로로 배치. MsiSlot 재사용으로 다른 대진표와 일관.
//   msiSet(진출/우승) = 금색, 매치 승자 = 파랑, elimSet = 빨강.
//   connectors: [srcMatchId, destMatchId, destSlot('a'|'b')] — 매치 카드 간 SVG 연결선.
const DemaciaBracket = ({ columns, teams, msiSet, elimSet, connectors, onTeamClick }) => {
  const teamMap = Object.fromEntries((teams || []).map((t) => [t.slot, t]));
  const resolveShort = (v) => (v && teamMap[v]?.short) || (v && !teamMap[v] ? v : null);
  const wrapRef = useRef(null);
  const [connPaths, setConnPaths] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const matchDisplayName = (m) => m.id === 'GF' ? 'Grand Final' : m.id;
  const toSlot = (v, isWinner, score) => {
    const short = resolveShort(v);
    const slot = short ? { short } : { label: 'TBD' };
    if (short) {
      if (msiSet?.has(short)) slot.msi = true;
      else if (isWinner) slot.win = true;
      else if (elimSet?.has(short)) slot.elim = true;
    }
    if (score != null) slot.score = score;
    return slot;
  };
  const renderMatch = (m, showDate) => {
    const aShort = resolveShort(m.a), bShort = resolveShort(m.b);
    const aWin = m.winner && (m.winner === m.a || m.winner === aShort);
    const bWin = m.winner && (m.winner === m.b || m.winner === bShort);
    return (
      <div key={m.id} className="flex flex-col">
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-0.5 mb-1 flex items-baseline gap-1.5">
          <span>{matchDisplayName(m)}</span>
          {showDate && m.day && <span className="text-white/30 normal-case font-normal ml-auto">{m.day.replace(/^(\d+)-(\d+)$/, '$1/$2')}</span>}
        </span>
        <div data-card-id={m.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
          <MsiSlot s={toSlot(m.a, aWin, m.scoreA)} onTeamClick={onTeamClick} />
          <div className="h-px bg-white/10" />
          <MsiSlot s={toSlot(m.b, bWin, m.scoreB)} onTeamClick={onTeamClick} />
        </div>
      </div>
    );
  };
  useLayoutEffect(() => {
    if (!connectors?.length || !wrapRef.current) { setConnPaths([]); return; }
    const wrap = wrapRef.current;
    const wRect = wrap.getBoundingClientRect();
    setSvgSize({ w: wrap.scrollWidth, h: wrap.scrollHeight });
    const cardPos = (id) => {
      const el = wrap.querySelector(`[data-card-id="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const slots = el.children;
      const slotA = slots[0]?.getBoundingClientRect();
      const slotB = slots[2]?.getBoundingClientRect();
      return {
        right: r.right - wRect.left,
        left: r.left - wRect.left,
        cy: (r.top + r.bottom) / 2 - wRect.top,
        aCy: slotA ? (slotA.top + slotA.bottom) / 2 - wRect.top : null,
        bCy: slotB ? (slotB.top + slotB.bottom) / 2 - wRect.top : null,
      };
    };
    const paths = [];
    for (const [srcId, destId, destSlot] of connectors) {
      const src = cardPos(srcId), dest = cardPos(destId);
      if (!src || !dest) continue;
      const y2 = destSlot === 'a' ? dest.aCy : destSlot === 'b' ? dest.bCy : dest.cy;
      const midX = (src.right + dest.left) / 2;
      paths.push(`M ${src.right} ${src.cy} H ${midX} V ${y2} H ${dest.left}`);
    }
    setConnPaths(paths);
  }, [connectors, columns, teams, msiSet, elimSet]);
  // 라운드로빈 순위표 — 3팀이 각 2경기씩. 1위(2승)만 진출, 2·3위 탈락.
  const renderRRStandings = (matches) => {
    const parts = new Set();
    for (const m of matches) {
      const a = resolveShort(m.a); if (a) parts.add(a);
      const b = resolveShort(m.b); if (b) parts.add(b);
    }
    const list = Array.from(parts);
    const wins = Object.fromEntries(list.map((p) => [p, 0]));
    const losses = Object.fromEntries(list.map((p) => [p, 0]));
    for (const m of matches) {
      if (!m.winner) continue;
      const a = resolveShort(m.a), b = resolveShort(m.b);
      const winShort = m.winner === m.a || m.winner === a ? a : b;
      const loseShort = winShort === a ? b : a;
      if (winShort && wins[winShort] != null) wins[winShort]++;
      if (loseShort && losses[loseShort] != null) losses[loseShort]++;
    }
    const sorted = list.slice().sort((x, y) => wins[y] - wins[x] || losses[x] - losses[y]);
    const rows = sorted.length > 0 ? sorted.map((short) => ({ short, w: wins[short], l: losses[short] })) : [null, null, null];
    return (
      <div className="mt-1 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
        <div className="px-2.5 py-1.5 bg-white/10 text-[10px] font-black text-white/70 uppercase tracking-wider">순위표</div>
        {rows.map((r, i) => {
          const rank = i + 1;
          const played = r ? r.w + r.l : 0;
          const completed = r && played === 2;
          const bg = r && msiSet?.has(r.short) ? 'rgba(232,199,126,0.16)'
                    : rank === 1 && completed ? 'rgba(96,165,250,0.14)'
                    : rank > 1 && completed ? 'rgba(248,113,113,0.18)'
                    : 'transparent';
          const accent = r && msiSet?.has(r.short) ? '#E8C77E'
                        : rank === 1 && completed ? '#60A5FA'
                        : rank > 1 && completed ? '#F87171'
                        : null;
          return (
            <div key={i}
                 className={`flex items-center gap-1.5 px-2.5 py-1.5 min-h-[30px]${r ? ' cursor-pointer hover:brightness-125 transition-all' : ''}`}
                 style={{ backgroundColor: bg }}
                 onClick={r ? () => onTeamClick?.(r.short) : undefined}>
              <span className="text-[10px] text-white/50 w-3 font-bold shrink-0">{rank}</span>
              {r ? (
                <>
                  <TeamLogo src={logoByShort[r.short]} size={14} />
                  <span className="text-xs font-bold truncate flex-1" style={{ color: accent || 'rgba(255,255,255,0.88)' }}>{r.short}</span>
                  <span className="font-mono tabular-nums text-xs shrink-0" style={{ color: accent || 'rgba(255,255,255,0.55)' }}>{r.w}-{r.l}</span>
                </>
              ) : (
                <>
                  <span className="text-xs text-white/35 flex-1">TBD</span>
                  <span className="font-mono tabular-nums text-xs text-white/40 shrink-0">0-0</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  // 싱글 엘리미네이션 그리드: 카드 2행 span, 라운드가 진행될수록 시작 위치가 중앙으로 오도록 계산
  //   Round k, match i → gridStart = 2^k + i * 2^(k+1). 총 rows = 2 * (첫 라운드 매치 수).
  const SLOT_H_D = 46, ROW_GAP_D = 8;
  return (
    <div className="pb-1 msi-scroll" style={{ overflowX: 'auto' }}>
    <div ref={wrapRef} className="relative flex gap-4 items-stretch w-fit pb-3">
      {columns.map((col, ci) => (
        <div key={ci} className={`flex flex-col shrink-0 ${col.gridRows ? 'gap-2' : 'gap-4 justify-center'}`} style={{ width: 200 }}>
          {col.groups.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-2">
              <div className="text-[11px] text-white/50 font-black tracking-wider px-1 flex items-baseline gap-1.5">
                {!g.showMatchDate && <><span>{g.day}</span><span className="text-white/40">·</span></>}
                <span>{g.format}</span>
                {g.label && <><span className="text-white/40">·</span><span className="text-white/70">{g.label}</span></>}
              </div>
              {col.gridRows ? (
                <div className="grid" style={{ gridTemplateRows: `repeat(${col.gridRows}, ${SLOT_H_D}px)`, rowGap: `${ROW_GAP_D}px` }}>
                  {g.matches.map((m) => (
                    <div key={m.id} style={{ gridRow: `${m.gridStart} / span 2` }}>
                      {renderMatch(m, g.showMatchDate)}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {g.matches.map((m) => renderMatch(m, g.showMatchDate))}
                  {g.showRRStandings && renderRRStandings(g.matches)}
                </>
              )}
            </div>
          ))}
        </div>
      ))}
      {connPaths.length > 0 && (
        <svg
          className="pointer-events-none absolute top-0 left-0"
          width={svgSize.w} height={svgSize.h}
          style={{ overflow: 'visible' }}
        >
          {connPaths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />
          ))}
        </svg>
      )}
    </div>
    </div>
  );
};

// 그룹 스테이지 완전 탈락 집합 계산.
//   M19-M20 패자 + M16-M18 라운드로빈 2·3위 (승수 < 2인 팀).
const computeGroupEliminated = (matches, teamMap) => {
  const out = new Set();
  const shortOf = (v) => (v && teamMap[v]?.short) || (v && !teamMap[v] ? v : null);
  const loserOf = (m) => {
    if (!m?.winner) return null;
    const a = shortOf(m.a), b = shortOf(m.b);
    return m.winner === m.a || m.winner === a ? b : a;
  };
  // M19-M20 패자
  for (const id of ['M19', 'M20']) {
    const m = matches.find((x) => x.id === id);
    const l = loserOf(m); if (l) out.add(l);
  }
  // M16-M18 라운드로빈: 각 팀 승수 카운트
  const rr = matches.filter((m) => ['M16', 'M17', 'M18'].includes(m.id) && m.winner);
  if (rr.length === 3) {
    const wins = {};
    for (const m of rr) {
      const w = m.winner === m.a || m.winner === shortOf(m.a) ? shortOf(m.a) : shortOf(m.b);
      if (w) wins[w] = (wins[w] || 0) + 1;
    }
    Object.entries(wins).forEach(([short, w]) => { if (w < 2) out.add(short); });
    // 0승 팀도 wins 객체에 없으니 매치 참가자 중 wins에 없는 팀 추가
    const players = new Set();
    for (const m of rr) { const a = shortOf(m.a), b = shortOf(m.b); if (a) players.add(a); if (b) players.add(b); }
    for (const p of players) if (!wins[p]) out.add(p);
  }
  return out;
};

// 녹아웃 완전 탈락 집합 = GF 이외 매치의 패자.
const computeKnockoutEliminated = (matches, teamMap) => {
  const out = new Set();
  const shortOf = (v) => (v && teamMap[v]?.short) || (v && !teamMap[v] ? v : null);
  for (const m of matches) {
    if (m.id === 'GF' || !m.winner) continue;
    const a = shortOf(m.a), b = shortOf(m.b);
    const loser = m.winner === m.a || m.winner === a ? b : a;
    if (loser) out.add(loser);
  }
  return out;
};

const MsiBracket = ({ rounds, totalRows, connectors: connData, cardPrefix = '', wrapScroll = true, onTeamClick, groupGap = false }) => {
  const useGrid = !!totalRows;
  const colH = useGrid ? gridSlotTop(totalRows - 1) + 2 * ACTUAL_SLOT_H + 2 : undefined;
  const totalW = rounds.length * COL_W + (rounds.length - 1) * COL_GAP;
  const wrapRef = useRef(null);
  const [connPaths, setConnPaths] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (!connData?.length || !wrapRef.current) {
      setConnPaths([]);
      return;
    }
    const wrap = wrapRef.current;
    const wRect = wrap.getBoundingClientRect();
    // 슬롯 높이가 카드마다 달라(팀 39px·라벨 32px) 수식으로는 중심이 어긋나므로
    // 그리드 모드에서도 실제 DOM 위치를 측정해 연결선을 그린다.
    setSvgSize({ w: useGrid ? totalW : wrap.scrollWidth, h: useGrid ? colH : wrap.scrollHeight });

    const slotCenterY = (el, slot) => {
      const first = el.firstElementChild;
      const hasTitleEl = first?.hasAttribute('data-title');
      const slotAEl = hasTitleEl ? first.nextElementSibling : first;
      const slotBEl = slotAEl?.nextElementSibling?.nextElementSibling;
      if (!slotAEl || !slotBEl) {
        const r = el.getBoundingClientRect();
        return (r.top + r.bottom) / 2 - wRect.top;
      }
      const rA = slotAEl.getBoundingClientRect();
      const rB = slotBEl.getBoundingClientRect();
      const aCy = (rA.top + rA.bottom) / 2 - wRect.top;
      const bCy = (rB.top + rB.bottom) / 2 - wRect.top;
      if (slot === 'a') return aCy;
      if (slot === 'b') return bCy;
      return (aCy + bCy) / 2;
    };

    const allCards = Array.from(wrap.querySelectorAll('[data-card]'));
    // 카드 사각형(관통 판정용) — 그리드 모드에서는 카드 위 라벨(제목/시간)도 함께 체크한다
    const cardRects = [];
    for (const el of allCards) {
      const id = el.getAttribute('data-card');
      const r = el.getBoundingClientRect();
      cardRects.push({ id, x1: r.left - wRect.left, x2: r.right - wRect.left, y1: r.top - wRect.top, y2: r.bottom - wRect.top });
      const label = el.previousElementSibling;
      if (label && label.tagName === 'SPAN') {
        const lr = label.getBoundingClientRect();
        cardRects.push({ id, x1: lr.left - wRect.left, x2: lr.right - wRect.left, y1: lr.top - wRect.top, y2: lr.bottom - wRect.top });
      }
    }
    // 직선 세그먼트가 카드 내부를 관통하는지 (양 끝 카드는 제외)
    const hits = (pts, exclude) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [p1, p2] = [pts[i], pts[i + 1]];
        for (const r of cardRects) {
          if (exclude.includes(r.id)) continue;
          const pad = 3, rx1 = r.x1 + pad, rx2 = r.x2 - pad, ry1 = r.y1 + pad, ry2 = r.y2 - pad;
          if (Math.abs(p1[1] - p2[1]) < 0.5) { const y = p1[1], xa = Math.min(p1[0], p2[0]), xb = Math.max(p1[0], p2[0]); if (y > ry1 && y < ry2 && xa < rx2 && xb > rx1) return true; }
          else { const x = p1[0], ya = Math.min(p1[1], p2[1]), yb = Math.max(p1[1], p2[1]); if (x > rx1 && x < rx2 && ya < ry2 && yb > ry1) return true; }
        }
      }
      return false;
    };
    const paths = connData.map(([fR, fM, fS, tR, tM, tS]) => {
      const fromEl = wrap.querySelector(`[data-card="${fR}-${fM}"]`);
      const toEl = wrap.querySelector(`[data-card="${tR}-${tM}"]`);
      if (!fromEl || !toEl) return null;
      const fRect = fromEl.getBoundingClientRect();
      const tRect = toEl.getBoundingClientRect();
      const fx = fRect.right - wRect.left;
      const tx = tRect.left - wRect.left;
      const fy = slotCenterY(fromEl, fS);
      const ty = slotCenterY(toEl, tS);
      const flat = Math.abs(fy - ty) <= 2;
      if (flat) return `M ${fx} ${fy} L ${tx} ${ty}`;

      // 기본 경로(중간에서 한 번 꺾기). 카드를 관통하지 않으면 그대로 사용.
      const mx = (fx + tx) / 2;
      const exclude = [`${fR}-${fM}`, `${tR}-${tM}`];
      const simple = [[fx, fy], [mx, fy], [mx, ty], [tx, ty]];
      if (!hits(simple, exclude)) return `M ${fx} ${fy} L ${mx} ${fy} L ${mx} ${ty} L ${tx} ${ty}`;

      // 관통 시: 사이 카드들을 피해 위/아래 빈 공간으로 우회(세로 꺾임은 칸 사이 gap에서만).
      const loR = Math.min(fR, tR), hiR = Math.max(fR, tR);
      const between = cardRects.filter((r) => { const m = r.id.match(/^(\d+)-/); return m && +m[1] > loR && +m[1] < hiR; });
      if (between.length) {
        const minTop = Math.min(...between.map((r) => r.y1)), maxBottom = Math.max(...between.map((r) => r.y2));
        const above = minTop - 10, below = maxBottom + 10;
        const detourY = Math.abs(fy - above) + Math.abs(ty - above) <= Math.abs(fy - below) + Math.abs(ty - below) ? above : below;
        const gx1 = fx + COL_GAP / 2, gx2 = tx - COL_GAP / 2;
        return `M ${fx} ${fy} L ${gx1} ${fy} L ${gx1} ${detourY} L ${gx2} ${detourY} L ${gx2} ${ty} L ${tx} ${ty}`;
      }
      return `M ${fx} ${fy} L ${mx} ${fy} L ${mx} ${ty} L ${tx} ${ty}`;
    }).filter(Boolean);

    setConnPaths(paths);
  }, [useGrid, rounds, connData]);

  return (
    <div className={`pb-1${useGrid && wrapScroll ? ' msi-scroll' : ''}`} style={useGrid && wrapScroll ? { overflowX: 'auto' } : {}}>
      <div ref={wrapRef} style={{
        position: 'relative',
        display: 'flex',
        gap: COL_GAP,
        ...(useGrid ? { width: totalW, height: colH } : {}),
      }}>
        {/* 연결선 (그리드·비그리드 모두 DOM 실측 기반) */}
        {connPaths.length > 0 && (
          <svg style={{
            position: 'absolute', top: 0, left: 0,
            width: svgSize.w, height: svgSize.h,
            pointerEvents: 'none', overflow: 'visible',
          }}>
            {connPaths.map((d, i) => (
              <path key={i} d={d}
                stroke="rgba(255,255,255,0.2)" strokeWidth={1.5}
                fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
        )}

        {rounds.map((r, ri) => (
          <div key={ri}
            style={useGrid
              ? { position: 'relative', width: COL_W, flexShrink: 0, height: colH }
              : { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: groupGap ? 0 : 20, flex: 1, minWidth: 0 }}>
            {!useGrid && r.title && (
              <p className="text-[11px] font-black text-white/40 uppercase tracking-wider" style={groupGap ? { marginBottom: 4 } : undefined}>{r.title}</p>
            )}
            {r.matches.map((m, mi) => {
              const pred = matchPrediction(m.a, m.b);
              if (!useGrid) {
                // groupGap(스위스): 같은 기록(recordKey)은 헤더로 한 번만 표기, 그 안 경기는 작은 간격으로 구분
                const isGroupStart = groupGap && (mi === 0 || (m.recordKey || '') !== (r.matches[mi - 1].recordKey || ''));
                const card = (
                  <div data-card={`${ri}-${mi}`} {...(cardPrefix && { 'data-xcard': `${cardPrefix}${ri}-${mi}` })}
                    style={groupGap ? { marginTop: isGroupStart ? 0 : 8 } : undefined}
                    className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                    {!groupGap && (m.title || m.time) && (
                      <div data-title="" className="px-2.5 py-1.5 bg-white/10 text-[11px] font-black text-white/70 flex items-center gap-2">
                        <span>{m.title}</span>
                        {m.time && <span className="ml-auto text-white/40 font-semibold">{m.time}</span>}
                      </div>
                    )}
                    <MsiSlot s={m.a} predPct={pred?.pA} onTeamClick={onTeamClick} />
                    <div className="h-px bg-white/10" />
                    <MsiSlot s={m.b} predPct={pred?.pB} onTeamClick={onTeamClick} />
                  </div>
                );
                if (groupGap) {
                  return (
                    <React.Fragment key={mi}>
                      {isGroupStart && m.title && (
                        <p className="text-[11px] font-black text-white/70 uppercase tracking-wider" style={{ marginTop: mi > 0 ? 22 : 0, marginBottom: 5 }}>{m.title}</p>
                      )}
                      {card}
                    </React.Fragment>
                  );
                }
                return <React.Fragment key={mi}>{card}</React.Fragment>;
              }
              const sr = m.startRow ?? 0;
              const cardTop = gridSlotTop(sr);
              const labelTop = cardTop - LABEL_H;
              return (
                <React.Fragment key={mi}>
                  {(m.title || m.time) && (
                    <span style={{
                      position: 'absolute', top: labelTop, left: 0, right: 0, height: LABEL_H,
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {m.title}
                      {m.time && <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.32)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>{m.time}</span>}
                    </span>
                  )}
                  <div
                    data-card={`${ri}-${mi}`}
                    {...(cardPrefix && { 'data-xcard': `${cardPrefix}${ri}-${mi}` })}
                    className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
                    style={{ position: 'absolute', top: cardTop, left: 0, right: 0 }}>
                    <MsiSlot s={m.a} predPct={pred?.pA} onTeamClick={onTeamClick} />
                    <div className="h-px bg-white/10" />
                    <MsiSlot s={m.b} predPct={pred?.pB} onTeamClick={onTeamClick} />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// 섹션 간 연결선을 그리는 브래킷 그룹 컨테이너
const BracketGroup = ({ sections, crossConnectors, onTeamClick }) => {
  const wrapRef = useRef(null);
  const [crossPaths, setCrossPaths] = useState([]);

  const slotY = (el, slot, wRect) => {
    if (!el) return null;
    const first = el.firstElementChild;
    const hasTitleEl = first?.hasAttribute('data-title');
    const slotAEl = hasTitleEl ? first.nextElementSibling : first;
    const slotBEl = slotAEl?.nextElementSibling?.nextElementSibling;
    if (!slotAEl || !slotBEl) {
      const r = el.getBoundingClientRect();
      return (r.top + r.bottom) / 2 - wRect.top;
    }
    const rA = slotAEl.getBoundingClientRect();
    const rB = slotBEl.getBoundingClientRect();
    const aCy = (rA.top + rA.bottom) / 2 - wRect.top;
    const bCy = (rB.top + rB.bottom) / 2 - wRect.top;
    if (slot === 'a') return aCy;
    if (slot === 'b') return bCy;
    return (aCy + bCy) / 2;
  };

  useLayoutEffect(() => {
    if (!crossConnectors?.length || !wrapRef.current) { setCrossPaths([]); return; }
    const wrap = wrapRef.current;
    const wRect = wrap.getBoundingClientRect();
    const paths = crossConnectors.map(([fSec, fR, fM, fSlot, tSec, tR, tM, tSlot]) => {
      const fromEl = wrap.querySelector(`[data-xcard="s${fSec}-${fR}-${fM}"]`);
      const toEl = wrap.querySelector(`[data-xcard="s${tSec}-${tR}-${tM}"]`);
      if (!fromEl || !toEl) return null;
      const fRect = fromEl.getBoundingClientRect();
      const tRect = toEl.getBoundingClientRect();
      const fx = fRect.right - wRect.left;
      const tx = tRect.left - wRect.left;
      const fy = slotY(fromEl, fSlot, wRect);
      const ty = slotY(toEl, tSlot, wRect);
      if (fy == null || ty == null) return null;
      const flat = Math.abs(fy - ty) <= 2;
      if (flat) return `M ${fx} ${fy} L ${tx} ${ty}`;

      // 두 라운드 사이에 다른 라운드(매치)를 건너뛰는 연결선은 그 매치 카드를 관통하지 않도록
      // 칸 사이 빈 공간(gap)에서만 꺾이고, 가로 이동은 건너뛰는 매치들을 모두 피하는 y에서 한다
      const loRound = Math.min(fR, tR);
      const hiRound = Math.max(fR, tR);
      if (hiRound - loRound > 1) {
        const skipped = Array.from(wrap.querySelectorAll('[data-xcard]')).filter((el) => {
          const m = el.getAttribute('data-xcard').match(/^s\d+-(\d+)-/);
          return m && +m[1] > loRound && +m[1] < hiRound;
        });
        if (skipped.length) {
          // 매치 카드 바로 위에 떠 있는 라운드/매치 제목 라벨도 함께 피해야 글자를 가리지 않는다
          const rects = skipped.flatMap((el) => {
            const r = [el.getBoundingClientRect()];
            const label = el.previousElementSibling;
            if (label && label.tagName === 'SPAN') r.push(label.getBoundingClientRect());
            return r;
          });
          const minTop = Math.min(...rects.map((r) => r.top)) - wRect.top;
          const maxBottom = Math.max(...rects.map((r) => r.bottom)) - wRect.top;
          const above = minTop - 10;
          const below = maxBottom + 10;
          const detourY = Math.abs(fy - above) + Math.abs(ty - above) <= Math.abs(fy - below) + Math.abs(ty - below)
            ? above
            : below;
          const gx1 = fx + COL_GAP / 2;
          const gx2 = tx - COL_GAP / 2;
          return `M ${fx} ${fy} L ${gx1} ${fy} L ${gx1} ${detourY} L ${gx2} ${detourY} L ${gx2} ${ty} L ${tx} ${ty}`;
        }
      }

      const mx = (fx + tx) / 2;
      return `M ${fx} ${fy} L ${mx} ${fy} L ${mx} ${ty} L ${tx} ${ty}`;
    }).filter(Boolean);
    setCrossPaths(paths);
  }, [sections, crossConnectors]);

  return (
    <div className="pb-1 msi-scroll" style={{ overflowX: 'auto' }}>
      <div ref={wrapRef} className="flex flex-col gap-8" style={{ position: 'relative', width: 'max-content' }}>
        {crossPaths.length > 0 && (
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
            {crossPaths.map((d, i) => (
              <path key={i} d={d} stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
        )}
        {sections.map((sec, si) => (
          <div key={si}>
            {sec.name && <p className="text-xs font-black text-white/55 mb-3 pb-2 border-b border-white/10">{sec.name}</p>}
            <MsiBracket rounds={sec.rounds} totalRows={sec.totalRows} connectors={sec.connectors} cardPrefix={`s${si}-`} wrapScroll={false} onTeamClick={onTeamClick} />
          </div>
        ))}
      </div>
    </div>
  );
};

// 현재 순위 표 (그룹 단위로 재사용) — 승률 대신 예측 확률(PI+/PO/Worlds/우승)을 표기
// cols 가 주어지면 그 컬럼만 표시(단계별 뷰), 없으면 데이터 유무로 자동 판단
const StandingsTable = ({ rows, color, hasDiff, cols, onTeamClick }) => {
  const showDiff = cols ? !!cols.diff : hasDiff;
  const hasPiPlus = cols ? !!cols.piPlus : rows.some((r) => r.prob?.piPlus != null);
  const hasAdvance = cols ? !!cols.advance : rows.some((r) => r.prob);
  const hasChamp = cols ? !!cols.champ : rows.some((r) => r.prob);
  const hasWorlds = cols ? !!cols.worlds : rows.some((r) => r.prob?.worlds != null);
  // 확률 셀 (소수 2자리) — 값 + 막대 바
  const prob = (v, c, strong) => (
    <td className="py-2 px-2">
      <div className="flex items-center gap-2 justify-end">
        <div className="hidden sm:block w-14 h-1.5 rounded-full bg-white/5 overflow-hidden shrink-0">
          {v != null && (
            <div className="h-full rounded-full" style={{ width: `${Math.min(v, 100)}%`, backgroundColor: c }} />
          )}
        </div>
        <span className="font-mono tabular-nums w-16 text-right whitespace-nowrap"
          style={{ color: v != null ? c : '#6B7280', fontWeight: strong ? 800 : 500 }}>
          {v != null ? `${v.toFixed(2)}%` : '-'}
        </span>
      </div>
    </td>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-white/40 text-xs border-b border-white/10">
            <th className="text-center font-bold py-2 px-2 w-10">#</th>
            <th className="text-left font-bold py-2 pr-2">팀</th>
            <th className="text-center font-bold py-2 px-2">승-패</th>
            {showDiff && <th className="text-center font-bold py-2 px-2">득실차</th>}
            {hasPiPlus && <th className="text-right font-bold py-2 px-2">{cols?.labels?.piPlus || 'PI+ 진출'}</th>}
            {hasAdvance && <th className="text-right font-bold py-2 px-2">{cols?.labels?.advance || 'PO 진출'}</th>}
            {hasWorlds && <th className="text-right font-bold py-2 px-2">Worlds 진출</th>}
            {hasChamp && <th className="text-right font-bold py-2 px-2">우승</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, ri) => {
            const pending = !t.short && t.pendingLabel; // 미확정 슬롯(예: 플레이-인 승자)
            return (
              <tr
                key={t.short || `pending-${ri}`}
                className={`border-b border-white/5 transition-colors ${pending ? 'opacity-60' : 'cursor-pointer hover:bg-white/5'}`}
                onClick={() => !pending && onTeamClick?.(t.short)}
              >
                <td className="py-2 px-2 text-white/40 font-mono">
                  {t.seedGroup ? (
                    <span className="flex items-center justify-center gap-1">
                      <GroupSymbol group={t.seedGroup} />
                      {t.rank}
                    </span>
                  ) : (
                    <span className="block text-center">{t.rank}</span>
                  )}
                </td>
                <td className="py-2 pr-2">
                  {pending ? (
                    <span className="text-white/50 italic">{t.pendingLabel} (미정)</span>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamLogo src={logoByShort[t.short]} />
                      <span className="font-bold text-white/90 truncate">{nameByShort[t.short] || t.short}</span>
                    </div>
                  )}
                </td>
                <td className="py-2 px-2 text-center text-white/70 font-mono">{t.games ? `${t.w}-${t.l}` : '-'}</td>
                {showDiff && (
                  <td className="py-2 px-2 text-center font-mono"
                    style={{ color: t.gd > 0 ? '#34D399' : t.gd < 0 ? '#F87171' : '#9CA3AF' }}>
                    {t.gd != null ? `${t.gd > 0 ? '+' : ''}${t.gd}` : '-'}
                  </td>
                )}
                {hasPiPlus && prob(t.prob?.piPlus, '#9CA3AF')}
                {hasAdvance && prob(t.prob?.advance, lighten(color))}
                {hasWorlds && prob(t.prob?.worlds, '#60A5FA')}
                {hasChamp && prob(t.prob?.champ, '#E8C77E', true)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// 갱신 시각을 KST(시:분까지)로 표시. 날짜만 들어와도 그대로 출력
const fmtUpdated = (v) => {
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }) + ' KST';
};

// 단계별 뷰 설정 (LCK→LCK 에서 정규시즌/플레이-인/플레이오프 선택 시)
const STAGE_CFG = {
  '정규시즌': { cols: { diff: true, piPlus: true, advance: true, worlds: true, champ: true }, matches: false, heading: '정규시즌 순위', desc: '현재 순위 + 예상 진출·우승 확률.' },
  '플레이-인': { cols: { piPlus: true, advance: true }, matches: false, heading: '플레이-인 예측', desc: '레전드 5위 + 라이즈 1~3위 · 승자 2팀 플레이오프 진출 · 전 경기 Bo5' },
  '플레이오프': { cols: { advance: true, worlds: true, champ: true }, matches: false, heading: '플레이오프 예측', desc: '레전드 1~4위 + 플레이-인 통과 2팀 · 전 경기 Bo5' },
  '최종 순위': { cols: { diff: true }, matches: false, heading: '최종 순위', desc: '플레이오프 종료 후 확정' },
  '럼블 스테이지': { cols: { diff: true, piPlus: true, advance: true, worlds: true, champ: true, labels: { piPlus: '기사의 길+ 진출', advance: '플레이오프 진출' } }, matches: false, heading: '럼블 스테이지 순위', desc: '조별 Bo3 더블 라운드로빈 + 기사의 길+(기사의 길 또는 플레이오프 직행)/플레이오프/Worlds/우승 확률.' },
};

// LCP Split 3 단계별 설정 — 스위스 → 플레이-인 → 플레이오프
const LCP_STAGE_CFG = {
  '스위스 스테이지': {
    pred: true,
    cols: { advance: true, worlds: true, champ: true, labels: { advance: '플레이오프' } },
    heading: '스위스 스테이지 예측',
    desc: '3승 진출·3패 탈락. 플레이오프/Worlds/우승 확률(시뮬레이션).',
    bracketKey: 'swiss', bracketTitle: '스위스 대진 (라운드별)',
  },
  '플레이-인 스테이지': { bracketKey: 'playin', bracketTitle: '플레이-인 대진' },
  '플레이오프': { bracketKey: 'playoffs', bracketTitle: '플레이오프 대진' },
};

// LPL Split 3 단계별 대진 (API 자동 갱신) — 기사의 길(Knights Rivals) / 플레이오프
const LPL_STAGE_CFG = {
  '기사의 길': { bracketKey: 'knights', bracketTitle: '기사의 길 대진' },
  '플레이오프': { bracketKey: 'playoffs', bracketTitle: '플레이오프 대진' },
};

// LCK 플레이-인 대진표: 정규시즌 순위 기반 예상 팀을 1·2라운드 시드 슬롯에 채우고,
//   1·2라운드 결과(승패)가 나오면 파이널 라운드(1라운드 패자 vs 2라운드 승자)를 자동으로 채운다.
//   (플레이오프는 그대로 반환)
const buildLckBracket = (raw, stage, current) => {
  if (!raw) return raw;
  const legend = current.filter((t) => /레전드|Legend/.test(t.group || ''));
  const rise = current.filter((t) => /라이즈|Rise/.test(t.group || ''));
  const seedTeam = {
    '레전드 1위': legend[0], '레전드 2위': legend[1], '레전드 3위': legend[2], '레전드 4위': legend[3], '레전드 5위': legend[4],
    '라이즈 1위': rise[0], '라이즈 2위': rise[1], '라이즈 3위': rise[2],
  };
  const fill = (s) => {
    if (!s) return s;
    const c = { ...s };
    if (!c.short && seedTeam[c.seed]) c.short = seedTeam[c.seed].short;
    return c;
  };
  const rounds = raw.rounds.map((r) => ({ ...r, matches: r.matches.map((m) => ({ ...m, a: fill(m.a), b: fill(m.b) })) }));
  const outcome = (m) => {
    if (!m) return {};
    const aWin = m.a?.win || m.a?.msi, bWin = m.b?.win || m.b?.msi;
    if (aWin || bWin) return { winner: aWin ? m.a : m.b, loser: aWin ? m.b : m.a };
    if (m.a?.score != null && m.b?.score != null && m.a.score !== m.b.score) {
      const aBig = m.a.score > m.b.score;
      return { winner: aBig ? m.a : m.b, loser: aBig ? m.b : m.a };
    }
    return {};
  };
  // 플레이-인 파이널 자동 채움 — 1·2라운드 결과가 있을 때만
  if (stage === '플레이-인') {
    const fin = rounds[2]?.matches?.[0];
    if (fin) {
      const loser = outcome(rounds[0]?.matches?.[0]).loser;
      const winner = outcome(rounds[1]?.matches?.[0]).winner;
      if (fin.a && !fin.a.short && loser?.short) fin.a = { ...fin.a, short: loser.short };
      if (fin.b && !fin.b.short && winner?.short) fin.b = { ...fin.b, short: winner.short };
    }
  }
  // 플레이오프 후처리: UB R2 두 패자 → 시드 기반 LB R2 slot a(하위 시드) / LB R3 slot a(상위 시드) 자동 채움.
  //   한 매치만 완료됐어도 그 패자의 시드가 상대 매치 참가자들과 명확히 순위 결정되면 확정.
  //   자동 배치된 팀의 elim 플래그는 제거(다음 라운드 진출).
  if (stage === '플레이오프') {
    // 시드 번호 매핑: legend 1-4 → 1-4, 플레이-인 5=P1, 6=P2. 여기선 상대 비교용 순서만 필요하니
    // 팀별 시드 번호를 slot의 seed 라벨에서 역산. UB R1/UB R2 slot a는 항상 레전드 시드.
    // 각 매치별 slot을 훑어서 팀별 시드 번호 유추. 플레이-인 통과 팀은 5·6로 폴백.
    const seedNumByShort = {};
    for (const r of rounds) for (const m of r.matches) for (const s of [m.a, m.b]) {
      if (!s?.short) continue;
      const mLeg = /^레전드\s(\d+)위$/.exec(s.seed || '');
      if (mLeg) seedNumByShort[s.short] = parseInt(mLeg[1], 10);
    }
    // 플레이-인 진출 2팀에 5·6 부여 (UB R1의 b슬롯 = 플레이-인 진출)
    const pins = [];
    for (const m of rounds[0]?.matches || []) {
      const t = m.b?.short; if (t && !(t in seedNumByShort)) pins.push(t);
    }
    pins.forEach((t, i) => { seedNumByShort[t] = 5 + i; });
    const ub2m1 = rounds[1]?.matches?.[0], ub2m2 = rounds[1]?.matches?.[1];
    const l1 = outcome(ub2m1).loser?.short, l2 = outcome(ub2m2).loser?.short;
    const lbR2 = rounds[1]?.matches?.[2]; // LB R2
    const lbR3 = rounds[2]?.matches?.[1]; // LB R3 (r2m0=UB R3, r2m1=LB R3, r3m0=Lower Finals)
    let lowerShort = null, higherShort = null;
    if (l1 && l2) {
      const s1 = seedNumByShort[l1] ?? 99, s2 = seedNumByShort[l2] ?? 99;
      lowerShort = s1 > s2 ? l1 : l2;
      higherShort = s1 > s2 ? l2 : l1;
    } else if (l1 || l2) {
      // 한쪽만 완료 — 상대 매치 참가자들의 시드와 비교해 하위/상위 확정 가능하면 배치
      const done = l1 || l2;
      const other = l1 ? ub2m2 : ub2m1;
      const others = [other?.a?.short, other?.b?.short].filter(Boolean).map((s) => seedNumByShort[s] ?? 99);
      const doneSeed = seedNumByShort[done] ?? 99;
      if (others.length > 0 && doneSeed > Math.max(...others)) lowerShort = done;
      else if (others.length > 0 && doneSeed < Math.min(...others)) higherShort = done;
    }
    // UB R2 매치의 elim만 제거 (bracketFromColumns 오탐).
    //   실제 LB 스테이지 패배 elim은 유지해야 함 (예: KT가 LB R2에서 지면 진짜 탈락).
    const clearUB2Elim = (short) => {
      if (!short) return;
      for (const m of [ub2m1, ub2m2]) {
        if (!m) continue;
        for (const s of [m.a, m.b]) if (s?.short === short) delete s.elim;
      }
    };
    if (lbR2?.a && !lbR2.a.short && lowerShort) { lbR2.a = { ...lbR2.a, short: lowerShort }; }
    if (lbR3?.a && !lbR3.a.short && higherShort) { lbR3.a = { ...lbR3.a, short: higherShort }; }
    // UB R2 패자는 LB로 진출하므로 UB R2 매치의 elim만 제거. LB 매치의 elim은 유지.
    if (l1) clearUB2Elim(l1);
    if (l2) clearUB2Elim(l2);
  }
  return { ...raw, rounds };
};

// 시뮬레이션 결과(예측) 렌더
const SimulationView = ({ comp, sub, stage, onTeamClick }) => {
  const lcpSplit3 = comp.key === 'lcp' && sub === 'Split 3';
  const lcpCfg = lcpSplit3 ? (LCP_STAGE_CFG[stage] || LCP_STAGE_CFG['스위스 스테이지']) : null;
  const cfg = lcpSplit3 ? lcpCfg : (stage ? STAGE_CFG[stage] : null);
  // 현재 순위 — 해당 세부대회 공식 순위표가 있으면 우선, 없으면 GPR 전적으로 산출
  const leagueStd = officialStandings.standings[comp.key];
  // 서브탭이 있는 대회는 leagueStd[sub], 서브탭 없는 대회(예: DEMACIA)는 leagueStd 자체를 official로 사용
  const official = leagueStd ? (sub ? leagueStd[sub] : leagueStd) : null;
  const setDiff = (gw, gl) => (gw != null && gl != null ? gw - gl : null);
  const current = official?.rows?.length
    ? official.rows.map((r) => {
        const g = r.w + r.l;
        return { short: r.team, w: r.w, l: r.l, group: r.group, rank: r.rank, games: g, winRate: g ? r.w / g : 0, gd: setDiff(r.gw, r.gl) };
      })
    : (comp.teams || [])
        .map((t) => {
          const { w, l, gw, gl } = recordByShort[t.short] || { w: 0, l: 0 };
          const g = w + l;
          return { ...t, w, l, games: g, winRate: g ? w / g : 0, gd: setDiff(gw, gl) };
        })
        // LCP Split 3(미개막)는 전적 대신 시뮬 예측(플레이오프 확률) 순으로 정렬
        .sort((a, b) => {
          if (lcpSplit3) {
            const pa = comp.split3?.find((s) => s.team === a.short) || {};
            const pb = comp.split3?.find((s) => s.team === b.short) || {};
            return (pb.advance ?? -1) - (pa.advance ?? -1) || (pb.champ ?? 0) - (pa.champ ?? 0) || b.rating - a.rating;
          }
          return b.winRate - a.winRate || b.w - a.w || (b.gd ?? -99) - (a.gd ?? -99) || b.rating - a.rating;
        });
  const hasDiff = current.some((t) => t.gd != null);
  // Road to MSI(MSI 선발전): 정규 2R 기준 진출 6팀 명단만 표기, 시즌 예측 확률 컬럼은 생략
  const roadToMsi = comp.key === 'lck' && sub === 'Road to MSI';
  const lplSplit3 = comp.key === 'lpl' && sub === 'Split 3';
  const lplCfg = lplSplit3 && stage ? LPL_STAGE_CFG[stage] : null;
  const lplQualifier = comp.key === 'lpl' && sub === '대표 선발전';
  // 자체 대진표(토너먼트 포맷)가 있는 세부대회는 시즌 예측 확률 컬럼을 표기하지 않음 (LPL/LCP Split 3는 전용 확률을 표기하므로 예외)
  const noPredict = roadToMsi || (!!official?.bracket && !lplSplit3);
  // 팀 약칭 → 시뮬 예측 확률 (현재 순위표에 합쳐 표기) — LPL·LCP Split 3는 전용 시뮬 결과(comp.split3) 사용
  const probByShort = (lplSplit3 || lcpSplit3)
    ? Object.fromEntries((comp.split3 || []).map((s) => [s.team, s]))
    : Object.fromEntries((comp.standings || []).map((s) => [s.team, s]));
  // 브래킷 스테이지 여부 + 대진표에서 탈락(elim) 확정된 팀 집합 (참가팀 목록 회색 처리용)
  const isBracketStage = sub === '브래킷 스테이지';
  const eliminatedSet = useMemo(() => {
    const set = new Set();
    const secs = official?.bracket?.sections;
    const collect = (rounds) => {
      for (const r of rounds || [])
        for (const m of r.matches || [])
          for (const slot of [m.a, m.b])
            if (slot?.elim && slot?.short) set.add(slot.short);
    };
    if (secs) secs.forEach((sec) => collect(sec.rounds));
    else collect(official?.bracket?.rounds);
    return set;
  }, [official]);
  // 그룹이 있으면 그룹별로 분리하고 각 그룹 내 1위부터 재번호
  const grouped = !!official && current.some((t) => t.group);
  const withProb = (t, rank) => ({ ...t, rank, prob: probByShort[t.short] });
  // 그룹명 → 표시 라벨·배지. 알려진 LCK 그룹은 고정색, 그 외(LPL 그룹 스테이지 등)는 기본 팔레트 순환.
  const GROUP_META = {
    Legend: { label: '레전드 그룹', badge: { color: '#E8C77E', bg: 'rgba(200,150,62,0.2)' } },
    '레전드 그룹': { label: '레전드 그룹', badge: { color: '#E8C77E', bg: 'rgba(200,150,62,0.2)' } },
    Rise: { label: '라이즈 그룹', badge: { color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' } },
    '라이즈 그룹': { label: '라이즈 그룹', badge: { color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' } },
  };
  // 그룹 표시 순서 — 레전드 그룹을 먼저 (라이즈보다 위)
  const GROUP_ORDER = ['Legend', '레전드 그룹', 'Rise', '라이즈 그룹'];
  const FALLBACK_BADGES = [
    { color: '#E8C77E', bg: 'rgba(200,150,62,0.2)' },
    { color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
    { color: '#7EC8E8', bg: 'rgba(62,150,200,0.2)' },
  ];
  // LCK 플레이-인/플레이오프: MSI/LCP처럼 API 대진표(연결선)로 표기하고,
  //   참가 팀은 정규시즌 순위표로 대진표 위에 표기한다.
  let groups;
  // LCK 최종 순위: 전체 팀을 우승 → Worlds → PO 진출 순으로 정렬한 단일 표
  const lckFinalStage = comp.key === 'lck' && grouped && stage === '최종 순위';
  const lckBracketStage = comp.key === 'lck' && grouped && (stage === '플레이-인' || stage === '플레이오프');
  const lckBracket = lckBracketStage ? buildLckBracket(official?.[stage === '플레이-인' ? 'playin' : 'playoffs'], stage, current) : null;
  if (lckFinalStage) {
    // 실제 대진 결과가 확정되면 그 순위를 표기 (미확정이면 groups=[] → 안내만 표시).
    //   PO 6팀(더블 엘리미네이션): 1위=결승 승자, 2위=결승 패자, 3위=Lower Finals 패자,
    //     4위=LB R3 패자, 5위=LB R2 패자, 6위=LB R1 패자
    //   7·8위 = 플레이-인 탈락 2팀(2R 패자·파이널 패자)
    //   9·10위 = 정규시즌 라이즈 4·5위 (플레이-인 미진출)
    const winnerLoser = (m) => {
      if (!m) return {};
      const aWin = m.a?.win || m.a?.msi, bWin = m.b?.win || m.b?.msi;
      if (aWin) return { w: m.a.short, l: m.b?.short };
      if (bWin) return { w: m.b.short, l: m.a?.short };
      if (m.a?.score != null && m.b?.score != null && m.a.score !== m.b.score) {
        const aBig = m.a.score > m.b.score;
        return { w: aBig ? m.a.short : m.b.short, l: aBig ? m.b.short : m.a.short };
      }
      return {};
    };
    const playin = official?.playin, playoffs = official?.playoffs;
    const gf = winnerLoser(playoffs?.rounds?.[4]?.matches?.[0]);        // Grand Finals
    const lf = winnerLoser(playoffs?.rounds?.[3]?.matches?.[0]);        // Lower Finals
    const lbR3 = winnerLoser(playoffs?.rounds?.[2]?.matches?.[1]);      // col2 m1 = LB R3
    const lbR2 = winnerLoser(playoffs?.rounds?.[1]?.matches?.[2]);      // col1 m2 = LB R2
    const lbR1 = winnerLoser(playoffs?.rounds?.[0]?.matches?.[2]);      // col0 m2 = LB R1
    const piFinal = winnerLoser(playin?.rounds?.[2]?.matches?.[0]);
    const piR2 = winnerLoser(playin?.rounds?.[1]?.matches?.[0]);
    const rise = current.filter((t) => /라이즈|Rise/.test(t.group || '')).sort((a, b) => a.rank - b.rank);
    // 각 순위별 확정 팀 (미확정이면 undefined) — 확정된 것만 순위 순으로 표기
    const rankSlots = [
      { rank: 1, short: gf.w },
      { rank: 2, short: gf.l },
      { rank: 3, short: lf.l },
      { rank: 4, short: lbR3.l },
      { rank: 5, short: lbR2.l },
      { rank: 6, short: lbR1.l },
      { rank: 7, short: piFinal.l },
      { rank: 8, short: piR2.l },
      { rank: 9, short: rise[3]?.short },
      { rank: 10, short: rise[4]?.short },
    ];
    const teamOf = (short) => current.find((t) => t.short === short);
    const rows = rankSlots
      .filter((s) => s.short && teamOf(s.short))
      .map((s) => ({ ...teamOf(s.short), rank: s.rank }));  // 그룹 심볼 사용 안 함
    groups = rows.length ? [{ name: null, rows }] : [];
  } else if (lckBracketStage) {
    // 그룹 구분 없이 해당 단계 참가 팀만 한 표에 표기.
    //   등수 칸에는 그룹 심볼 + 그룹 내 시드(레전드 5위 / 라이즈 1~3위 등)를 표기.
    const legend = current.filter((t) => /레전드|Legend/.test(t.group || ''));
    const rise = current.filter((t) => /라이즈|Rise/.test(t.group || ''));
    const seeds = stage === '플레이-인'
      ? [{ t: legend[4], g: 'Legend', r: 5 }, { t: rise[0], g: 'Rise', r: 1 }, { t: rise[1], g: 'Rise', r: 2 }, { t: rise[2], g: 'Rise', r: 3 }]
      : [{ t: legend[0], g: 'Legend', r: 1 }, { t: legend[1], g: 'Legend', r: 2 }, { t: legend[2], g: 'Legend', r: 3 }, { t: legend[3], g: 'Legend', r: 4 }];
    // 플레이오프: 플레이-인 1라운드 승자(=5시드)와 파이널 라운드 승자(=6시드) 추가.
    //   플레이-인 대진에서 승자가 확정되면 그 팀의 정규시즌 순위 데이터를 가져와 표시.
    if (stage === '플레이오프') {
      const winnerOf = (m) => {
        if (!m) return null;
        if (m.a?.win || m.a?.msi) return m.a.short;
        if (m.b?.win || m.b?.msi) return m.b.short;
        if (m.a?.score != null && m.b?.score != null && m.a.score !== m.b.score) return m.a.score > m.b.score ? m.a.short : m.b.short;
        return null;
      };
      const playin = official?.playin;
      const r1Winner = winnerOf(playin?.rounds?.[0]?.matches?.[0]);       // 플레이-인 1라운드 승자 = PO 5시드
      const finalWinner = winnerOf(playin?.rounds?.[2]?.matches?.[0]);    // 파이널 라운드 승자 = PO 6시드
      const teamOf = (short) => short ? current.find((t) => t.short === short) : null;
      // 확정 시 그 팀의 정규시즌 그룹 심볼과 그룹 내 순위(예: 레전드 5위, 라이즈 1위)로 표기
      const gOf = (t) => /레전드|Legend/.test(t?.group || '') ? 'Legend' : /라이즈|Rise/.test(t?.group || '') ? 'Rise' : null;
      const r1Team = teamOf(r1Winner), finalTeam = teamOf(finalWinner);
      seeds.push({ t: r1Team, g: gOf(r1Team), r: r1Team?.rank ?? 5, pendingLabel: '플레이-인 1라운드 승자' });
      seeds.push({ t: finalTeam, g: gOf(finalTeam), r: finalTeam?.rank ?? 6, pendingLabel: '파이널 라운드 승자' });
    }
    groups = [{ name: null, rows: seeds.map((s) => s.t
      ? { ...withProb(s.t, s.r), seedGroup: s.g }
      : { rank: s.r, pendingLabel: s.pendingLabel, seedGroup: s.g }) }];
  } else {
    groups = grouped
      ? [...new Set(current.map((t) => t.group))]
          .sort((a, b) => {
            const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
          })
          .map((name, gi) => ({
          name: GROUP_META[name]?.label ?? name,
          badge: GROUP_META[name]?.badge ?? FALLBACK_BADGES[gi % FALLBACK_BADGES.length],
          rows: current.filter((t) => t.group === name).map((t, i) => (noPredict ? { ...t, rank: i + 1 } : withProb(t, i + 1))),
        }))
      : [{ name: null, rows: current.map((t, i) => (noPredict ? { ...t, rank: t.rank ?? i + 1 } : withProb(t, t.rank ?? i + 1))) }];
  }

  // LPL Split 3 단계별 표시: 럼블=조 순위만, 기사의 길/녹아웃=해당 대진표만
  // MSI는 별개 토너먼트라 지역 리그 전적(현재순위) 표는 숨긴다 (참가팀·대진표만 표기)
  const hideStandings = (lplSplit3 && stage && stage !== '럼블 스테이지') || (lcpSplit3 && !lcpCfg?.pred) || comp.key === 'msi' || lplQualifier;
  // 참가 팀 카드(MSI 전용). LCK 플레이-인/플레이오프는 정규시즌 순위표를 참가 팀으로 표기.
  const qualifiers = official?.qualifiers?.length ? official.qualifiers : null;
  // LPL Split 3는 이제 API 자동 대진(knights/playoffs)을 쓰므로 섹션형 bracket을 사용하지 않는다.
  const bracketSections = lplSplit3 ? undefined : official?.bracket?.sections;

  return (
    <div className="flex flex-col gap-8">
      {/* 메타 */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {(lplSplit3 || comp.stage || comp.format) && !lcpSplit3 && (
          <span className="text-white/50">형식: <strong className="text-white/80">{lplSplit3
            ? '그룹별 더블 라운드로빈 (Bo3) → 기사의 길 (Bo5) → 플레이오프 (Bo5)'
            : [comp.stage, comp.format].filter(Boolean).join(' · ')}</strong></span>
        )}
        {comp.iterations > 0 && <span className="text-white/50">반복: <strong className="text-white/80">{comp.iterations.toLocaleString()}회</strong></span>}
        {comp.generatedAt && <span className="text-white/50">생성: <strong className="text-white/80">{fmtUpdated(comp.generatedAt)}</strong></span>}
      </div>

      {/* LCP Split 3 진행 방식 안내 */}
      {lcpSplit3 && lcpCfg?.pred && (
        <section className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5 flex flex-col gap-3 text-sm">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">진행 방식</h3>
            <span className="text-xs text-white/40">8팀 · 스위스 스테이지 → 4팀 플레이오프</span>
          </div>
          <div className="flex flex-col gap-2 text-white/70 leading-relaxed">
            <p><strong className="text-white/90">① 스위스 스테이지</strong> (7/25~8/30) — Bo3·Bo5 혼합. <strong className="text-white/85">3승 시 플레이오프 진출, 3패 시 탈락.</strong> 1R은 Split 2 상위 4팀 vs 하위 4팀 무작위, 이후 같은 승패기록끼리 대진. 3승·3패가 걸린 경기는 Bo5.</p>
            <p><strong className="text-white/90">② 플레이오프</strong> (8/29~30, 타이베이) — 4팀 더블 엘리미네이션 Bo5. 우승팀이 LCP 챔피언.</p>
            <p><strong className="text-white/90">③ Worlds 진출 (3팀)</strong> — 플레이오프 결승 2팀 + 나머지 중 챔피언십 포인트 최다 1팀.</p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40 pt-1 border-t border-white/10">
            <span>챔피언십 포인트</span>
            <span>3-0 <b className="text-white/60">50</b></span>
            <span>3-1 <b className="text-white/60">40</b></span>
            <span>3-2 <b className="text-white/60">30</b></span>
            <span>2-3 <b className="text-white/60">15</b></span>
            <span>1-3 <b className="text-white/60">3</b></span>
            <span>0-3 <b className="text-white/60">0</b></span>
          </div>
        </section>
      )}

      {/* 현재 순위 / 단계별 예측 */}
      {current.length > 0 && !hideStandings && (
        <section className="flex flex-col gap-5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{lckBracketStage ? '참가 팀' : (cfg?.heading || (roadToMsi ? '진출 팀' : '현재 순위'))}</h3>
            <span className="text-xs text-white/40">{lckBracketStage ? '정규시즌 순위표 (진출 시드 확정 기준)' : (cfg?.desc || official?.stage)}</span>
          </div>
          {lckFinalStage && groups.length === 0 && (
            <p className="text-sm text-white/50 py-6 px-4 rounded-xl bg-white/5 border border-white/10">
              최종 순위는 플레이오프 결승 종료 후 확정됩니다.
            </p>
          )}
          {groups.map((grp) => (
            <div key={grp.name || 'all'}>
              {grp.name && (
                <span className="inline-block text-xs font-black px-2 py-0.5 rounded mb-2"
                  style={{ color: grp.badge.color, backgroundColor: grp.badge.bg }}>
                  {grp.name}
                </span>
              )}
              <StandingsTable rows={grp.rows} color={comp.color} hasDiff={hasDiff} cols={lckBracketStage ? (stage === '플레이-인' ? { diff: true, advance: true, worlds: true, champ: true } : { diff: true, worlds: true, champ: true }) : cfg?.cols} onTeamClick={onTeamClick} />
            </div>
          ))}
        </section>
      )}

      {/* 참가 팀 — 항상 대진표 위에 배치. DEMACIA는 별도 렌더링(스테이지별 필터).
          Worlds도 스테이지별 필터 적용. */}
      {qualifiers?.length > 0 && comp.key !== 'demacia' && (() => {
        const isWorlds = comp.key === 'worlds' && qualifiers.some((q) => q.stage);
        let groups;
        if (!isWorlds) {
          groups = [{ title: null, items: qualifiers }];
        } else if (stage === '플레이-인') {
          groups = [{ title: null, items: qualifiers.filter((q) => q.stage === 'playin') }];
        } else if (stage === '스위스 스테이지') {
          // POOL 배정 (2026 Worlds 규정): POOL 1 = LCK/LPL/LCS/LEC #1, POOL 2 = LCP/CBLOL #1 + LCK/LPL #2,
          //   POOL 3 = LCS/LEC #2 + LCK/LPL #3, POOL 4 = LCP #2 + LCK/LPL #4 + PI 생존.
          const POOLS = {
            'LCK #1': 1, 'LPL #1': 1, 'LCS #1': 1, 'LEC #1': 1,
            'LCP #1': 2, 'CBLOL #1': 2, 'LCK #2': 2, 'LPL #2': 2,
            'LCS #2': 3, 'LEC #2': 3, 'LCK #3': 3, 'LPL #3': 3,
            'LCP #2': 4, 'LCK #4': 4, 'LPL #4': 4, // '플레이-인 통과' = 4
          };
          const playin = official?.playin;
          const gf = playin?.rounds?.[playin.rounds.length - 1]?.matches?.[0];
          const winShort = gf?.a?.win || gf?.a?.msi ? gf?.a?.short : (gf?.b?.win || gf?.b?.msi ? gf?.b?.short : null);
          const items = [
            ...qualifiers.filter((q) => q.stage === 'swiss'),
            winShort ? { seed: '플레이-인 통과', short: winShort } : { seed: '플레이-인 통과', label: 'TBD' },
          ];
          // POOL 순으로 정렬 (POOL 1 위, POOL 4 아래). 같은 POOL 안에서는 기존 순서 유지.
          items.sort((a, b) => {
            const pa = POOLS[a.seed] ?? (a.seed === '플레이-인 통과' ? 4 : 99);
            const pb = POOLS[b.seed] ?? (b.seed === '플레이-인 통과' ? 4 : 99);
            return pa - pb;
          });
          groups = [{ title: null, items }];
        } else if (stage === '녹아웃 스테이지') {
          // 각 팀의 승패 카운트 → 3승 진출자를 3-0/3-1/3-2로 분류 (각각 최대 2/3/3팀).
          const swissB = official?.swiss;
          const wins = {}, losses = {};
          swissB?.rounds?.forEach((r) => r.matches.forEach((m) => {
            if (!m.a?.short || !m.b?.short) return;
            if (m.a.score != null && m.b.score != null && m.a.score !== m.b.score) {
              const aWin = m.a.score > m.b.score;
              const w = aWin ? m.a.short : m.b.short;
              const l = aWin ? m.b.short : m.a.short;
              wins[w] = (wins[w] || 0) + 1;
              losses[l] = (losses[l] || 0) + 1;
            }
          }));
          const advancers = Object.keys(wins).filter((t) => wins[t] >= 3);
          const byRec = { '3-0': [], '3-1': [], '3-2': [] };
          for (const t of advancers) { const l = losses[t] || 0; const k = `3-${l}`; if (byRec[k]) byRec[k].push(t); }
          const slots = [
            ...['3-0','3-0'].map((rec, i) => ({ rec, short: byRec['3-0'][i] || null })),
            ...['3-1','3-1','3-1'].map((rec, i) => ({ rec, short: byRec['3-1'][i] || null })),
            ...['3-2','3-2','3-2'].map((rec, i) => ({ rec, short: byRec['3-2'][i] || null })),
          ];
          const items = slots.map((s) => s.short ? { seed: s.rec, short: s.short } : { seed: s.rec, label: 'TBD' });
          groups = [{ title: null, items }];
        } else {
          groups = [{ title: null, items: qualifiers }];
        }
        const renderCard = (q, i) => {
          const p = q.short ? probByShort[q.short] : null;
          const probRow = (label, v, color, strong) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 w-8 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(v, 100)}%`, backgroundColor: color }} />
              </div>
              <span className="font-mono tabular-nums text-[11px] w-12 text-right shrink-0" style={{ color, fontWeight: strong ? 800 : 600 }}>{v}%</span>
            </div>
          );
          const eliminated = q.short && eliminatedSet.has(q.short);
          const showAdvance = !isBracketStage && p?.advance != null;
          return (
            <div key={i} className="flex flex-col gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">
              {q.short ? (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <div style={eliminated ? { filter: 'grayscale(1)', opacity: 0.4 } : undefined} className="shrink-0">
                      <TeamLogo src={logoByShort[q.short]} size={20} />
                    </div>
                    <span className={`font-bold truncate ${eliminated ? 'text-white/35' : 'text-white/90'}`}>{nameByShort[q.short] || q.short}</span>
                    {q.seed && <span className="text-[10px] text-white/40 shrink-0 ml-auto">{q.seed}</span>}
                  </div>
                  {(showAdvance || p?.champ != null) && (
                    <div className="flex flex-col gap-1">
                      {showAdvance && probRow('진출', p.advance, comp.color)}
                      {p?.champ != null && probRow('우승', p.champ, '#E8C77E', true)}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`truncate ${isWorlds ? 'text-white/35 font-bold' : 'text-white/55'}`}>{isWorlds ? 'TBD' : q.label}</span>
                  {isWorlds && q.seed && <span className="text-[10px] text-white/40 shrink-0 ml-auto">{q.seed}</span>}
                </div>
              )}
            </div>
          );
        };
        return (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">참가 팀</h3>
            {groups.map((g, gi) => (
              <div key={gi} className="flex flex-col gap-2">
                {g.title && <h4 className="text-xs font-bold text-white/60">{g.title}</h4>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {g.items.map((q, i) => renderCard(q, i))}
                </div>
              </div>
            ))}
          </section>
        );
      })()}

      {/* LCP Split 3 단계별 대진표 (스위스/플레이-인/플레이오프) */}
      {lcpSplit3 && lcpCfg?.bracketKey && official?.[lcpCfg.bracketKey]?.rounds?.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{lcpCfg.bracketTitle}</h3>
            <span className="text-xs text-white/40">경기 결과가 나오면 자동 갱신됩니다.</span>
          </div>
          <MsiBracket
            rounds={official[lcpCfg.bracketKey].rounds}
            totalRows={official[lcpCfg.bracketKey].totalRows}
            connectors={official[lcpCfg.bracketKey].connectors}
            onTeamClick={onTeamClick}
            groupGap={lcpCfg.bracketKey === 'swiss'}
          />
          <BracketLegend />
        </section>
      )}

      {/* Worlds 단계별 대진표 (플레이-인 / 스위스 / 녹아웃) — lolesports API 자동 갱신 */}
      {(() => {
        if (comp.key !== 'worlds') return null;
        const bracketKey = stage === '플레이-인' ? 'playin' : stage === '스위스 스테이지' ? 'swiss' : stage === '녹아웃 스테이지' ? 'knockout' : null;
        if (!bracketKey) return null;
        const br = official?.[bracketKey];
        if (!br?.rounds?.length) {
          return (
            <section className="rounded-xl bg-white/5 border border-white/10 p-4 text-center text-sm text-white/50">
              대진 정보가 아직 확정되지 않았습니다. 대회 진행 시 자동 갱신됩니다.
            </section>
          );
        }
        const titles = { playin: '플레이-인 대진', swiss: '스위스 스테이지 (16팀 · 3승 진출 · 3패 탈락)', knockout: '녹아웃 스테이지 (8팀 싱글 엘리미네이션 Bo5)' };
        return (
          <section>
            <div className="flex items-baseline gap-2 flex-wrap mb-4">
              <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{titles[bracketKey]}</h3>
              <span className="text-xs text-white/40">경기 결과가 나오면 자동 갱신됩니다.</span>
            </div>
            <MsiBracket rounds={br.rounds} totalRows={br.totalRows} connectors={br.connectors} onTeamClick={onTeamClick} groupGap={bracketKey === 'swiss'} />
            <BracketLegend goldLabel={bracketKey === 'knockout' ? '우승' : '진출'} />
          </section>
        );
      })()}

      {/* LPL Split 3 단계별 대진표 (기사의 길 / 플레이오프) — API 자동 갱신 */}
      {lplSplit3 && lplCfg?.bracketKey && official?.[lplCfg.bracketKey]?.rounds?.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{lplCfg.bracketTitle}</h3>
            <span className="text-xs text-white/40">경기 결과가 나오면 자동 갱신됩니다.</span>
          </div>
          <MsiBracket rounds={official[lplCfg.bracketKey].rounds} totalRows={official[lplCfg.bracketKey].totalRows} connectors={official[lplCfg.bracketKey].connectors} onTeamClick={onTeamClick} />
          <BracketLegend />
        </section>
      )}

      {/* DEMACIA 참가 팀 — 대진표 위에 배치. 녹아웃 스테이지에서는 진출 8팀만 표시. */}
      {(() => {
        if (comp.key !== 'demacia' || !qualifiers?.length) return null;
        const gm = official?.group?.matches || [];
        const teamMap = Object.fromEntries((official?.teams || []).map((t) => [t.slot, t]));
        const shortOf = (v) => (v && teamMap[v]?.short) || (v && !teamMap[v] ? v : null);
        const winnerShortOf = (m) => {
          if (!m?.winner) return null;
          const a = shortOf(m.a), b = shortOf(m.b);
          return m.winner === m.a || m.winner === a ? a : b;
        };
        const advancing = new Set();
        ['M7','M8','M9','M13','M14','M15','M19','M20'].forEach((id) => {
          const w = winnerShortOf(gm.find((x) => x.id === id));
          if (w) advancing.add(w);
        });
        const rrWins = {};
        for (const id of ['M16','M17','M18']) {
          const w = winnerShortOf(gm.find((x) => x.id === id));
          if (w) rrWins[w] = (rrWins[w] || 0) + 1;
        }
        Object.entries(rrWins).forEach(([s, w]) => { if (w >= 2) advancing.add(s); });
        const list = stage === '녹아웃 스테이지' ? qualifiers.filter((q) => q.short && advancing.has(q.short)) : qualifiers;
        if (!list.length) return null;
        return (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">참가 팀</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {list.map((q, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">
                  {q.short ? (
                    <>
                      <TeamLogo src={logoByShort[q.short]} size={20} />
                      <span className="font-bold truncate text-white/90">{nameByShort[q.short] || q.short}</span>
                      {q.seed && <span className="text-[10px] text-white/40 shrink-0 ml-auto">{q.seed}</span>}
                    </>
                  ) : (
                    <span className="text-white/55 truncate">{q.label || q.seed}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* DEMACIA 그룹/녹아웃 스테이지 — 다른 대진표와 일관된 카드/색상 규칙 사용 */}
      {(() => {
        if (comp.key !== 'demacia') return null;
        const groupMatches = official?.group?.matches || [];
        const knockoutMatches = official?.knockout?.matches || [];
        const teamMap = Object.fromEntries((official?.teams || []).map((t) => [t.slot, t]));
        const shortOf = (v) => (v && teamMap[v]?.short) || (v && !teamMap[v] ? v : null);
        const winnerShortOf = (m) => {
          if (!m?.winner) return null;
          const a = shortOf(m.a), b = shortOf(m.b);
          return m.winner === m.a || m.winner === a ? a : b;
        };
        const gfMatch = knockoutMatches.find((m) => m.id === 'GF');
        const championShort = winnerShortOf(gfMatch);
        const makeLegend = (goldLabel) => (
          <div className="mt-3 flex items-center gap-4 text-xs text-white/60 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(232,199,126,0.7)' }} /> {goldLabel}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }} /> 라운드 승리</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(248,113,113,0.6)' }} /> 탈락</span>
          </div>
        );
        if (stage === '그룹 스테이지' && groupMatches.length > 0) {
          const elimSet = computeGroupEliminated(groupMatches, teamMap);
          // 녹아웃 진출자(msi) = M7-M9, M13-M15, M19-M20 승자 + M16-M18 라운드로빈 1위(2승)
          const msiSet = new Set();
          ['M7','M8','M9','M13','M14','M15','M19','M20'].forEach((id) => {
            const w = winnerShortOf(groupMatches.find((x) => x.id === id));
            if (w) msiSet.add(w);
          });
          const rrWins = {};
          for (const id of ['M16','M17','M18']) {
            const w = winnerShortOf(groupMatches.find((x) => x.id === id));
            if (w) rrWins[w] = (rrWins[w] || 0) + 1;
          }
          Object.entries(rrWins).forEach(([s, w]) => { if (w >= 2) msiSet.add(s); });
          return (
            <section>
              <div className="flex items-baseline gap-2 flex-wrap mb-4">
                <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">온라인 그룹 스테이지</h3>
                <span className="text-xs text-white/40">스위스 시스템(0-2: 싱글 라운드 로빈) · 8팀 진출</span>
              </div>
              <DemaciaBracket
                columns={[
                  { groups: [{ day: '10/3', format: 'Bo1', label: '0-0', matches: groupMatches.filter((m) => m.bracket === '0-0') }] },
                  { groups: [
                    { day: '10/4', format: 'Bo3', label: '1-0', matches: groupMatches.filter((m) => m.bracket === '1-0') },
                    { day: '10/5', format: 'Bo3', label: '0-1', matches: groupMatches.filter((m) => m.bracket === '0-1') },
                  ] },
                  { groups: [
                    { day: '10/6', format: 'Bo3', label: '1-1', matches: groupMatches.filter((m) => m.bracket === '1-1') },
                    { day: '10/7', format: 'Bo3', label: '0-2 RR', matches: groupMatches.filter((m) => m.bracket === '0-2 RR'), showRRStandings: true },
                  ] },
                  { groups: [{ day: '10/8', format: 'Bo3', label: '1-2 & 0-2 1st', matches: groupMatches.filter((m) => m.bracket === '1-2 & 0-2 1st') }] },
                ]}
                teams={official.teams}
                msiSet={msiSet}
                elimSet={elimSet}
                onTeamClick={onTeamClick}
              />
              {makeLegend('진출')}
            </section>
          );
        }
        if (stage === '녹아웃 스테이지' && knockoutMatches.length > 0) {
          const elimSet = computeKnockoutEliminated(knockoutMatches, teamMap);
          const msiSet = new Set(); if (championShort) msiSet.add(championShort);
          // 싱글 엘리미네이션 라운드 정의 (라운드 순 → 매치 리스트). 각 라운드 매치는
          //   gridStart = 2^roundIdx + i * 2^(roundIdx+1) 규칙으로 상위 라운드가 중앙에 정렬.
          const rounds = [
            { label: '8강',   matches: knockoutMatches.filter((m) => m.round === '8강') },
            { label: '4강',   matches: knockoutMatches.filter((m) => m.round === '4강') },
            { label: '결승',  matches: knockoutMatches.filter((m) => m.round === '결승') },
          ];
          const firstCount = rounds[0].matches.length;
          const gridRows = firstCount * 2;
          const columns = rounds.map((r, ri) => ({
            gridRows,
            groups: [{
              format: 'Bo5',
              label: r.label,
              matches: r.matches.map((m, i) => ({ ...m, gridStart: Math.pow(2, ri) + i * Math.pow(2, ri + 1) })),
              showMatchDate: true,
            }],
          }));
          return (
            <section>
              <div className="flex items-baseline gap-2 flex-wrap mb-4">
                <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">오프라인 녹아웃 스테이지</h3>
                <span className="text-xs text-white/40">싱글 엘리미네이션 · Bo5</span>
              </div>
              <DemaciaBracket
                columns={columns}
                teams={official.teams}
                msiSet={msiSet}
                elimSet={elimSet}
                connectors={[
                  ['M21', 'M25', 'a'], ['M22', 'M25', 'b'],
                  ['M23', 'M26', 'a'], ['M24', 'M26', 'b'],
                  ['M25', 'GF', 'a'], ['M26', 'GF', 'b'],
                ]}
                onTeamClick={onTeamClick}
              />
              {makeLegend('우승')}
            </section>
          );
        }
        return null;
      })()}

      {/* LPL 대표 선발전 — 대진 탭 */}
      {lplQualifier && stage === '대진' && official?.qualifier?.rounds?.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">대표 선발전 대진</h3>
            <span className="text-xs text-white/40">경기 결과가 나오면 자동 갱신됩니다.</span>
          </div>
          <MsiBracket rounds={official.qualifier.rounds} totalRows={official.qualifier.totalRows} connectors={official.qualifier.connectors} onTeamClick={onTeamClick} />
          <BracketLegend />
        </section>
      )}

      {/* LPL 대표 선발전 — 챔피언십 포인트 탭 */}
      {lplQualifier && stage === '챔피언십 포인트' && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">챔피언십 포인트</h3>
            <span className="text-xs text-white/40">2026 시즌 Split 1·2·3 성적 누적</span>
          </div>
          {official?.points?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-white/40 text-xs border-b border-white/10">
                    <th className="text-center font-bold py-2 px-2 w-10">#</th>
                    <th className="text-left font-bold py-2 pr-2">팀</th>
                    {official.points[0]?.split1 != null && <th className="text-center font-bold py-2 px-2">Split 1</th>}
                    {official.points[0]?.split2 != null && <th className="text-center font-bold py-2 px-2">Split 2</th>}
                    {official.points[0]?.split3 != null && <th className="text-center font-bold py-2 px-2">Split 3</th>}
                    <th className="text-right font-bold py-2 px-2">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {official.points.map((p, i) => (
                    <tr key={p.team} className="border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => onTeamClick?.(p.team)}>
                      <td className="py-2 px-2 text-center text-white/40 font-mono">{i + 1}</td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <TeamLogo src={logoByShort[p.team]} />
                          <span className="font-bold text-white/90 truncate">{nameByShort[p.team] || p.team}</span>
                        </div>
                      </td>
                      {p.split1 != null && <td className="py-2 px-2 text-center text-white/60 font-mono">{p.split1}</td>}
                      {p.split2 != null && <td className="py-2 px-2 text-center text-white/60 font-mono">{p.split2}</td>}
                      {p.split3 != null && <td className="py-2 px-2 text-center text-white/60 font-mono">{p.split3}</td>}
                      <td className="py-2 px-2 text-right font-mono font-black text-white">{p.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-white/50 py-6 px-4 rounded-xl bg-white/5 border border-white/10">
              챔피언십 포인트 데이터는 곧 게재됩니다.
            </p>
          )}
        </section>
      )}

      {/* 대진표 (LCK 플레이-인/플레이오프) — API 대진 + 연결선 (MSI/LCP와 동일 형식) */}
      {lckBracket?.rounds?.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">대진표</h3>
            <span className="text-xs text-white/40">{cfg?.desc || '경기 결과가 나오면 자동 갱신됩니다.'}</span>
          </div>
          <MsiBracket rounds={lckBracket.rounds} totalRows={lckBracket.totalRows} connectors={lckBracket.connectors} onTeamClick={onTeamClick} />
          <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-white/50">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(232,199,126,0.7)' }} /> 우승/진출</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }} /> 라운드 승리</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(248,113,113,0.6)' }} /> 탈락</span>
          </div>
        </section>
      )}

      {/* Road to MSI(선발전) 대진표 — 실제 결과 */}
      {roadToMsi && official?.bracket && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">대진표</h3>
            {official.bracket.desc && <span className="text-xs text-white/40">{official.bracket.desc}</span>}
          </div>
          <MsiBracket rounds={official.bracket.rounds} totalRows={official.bracket.totalRows} connectors={official.bracket.connectors} />
          <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-white/50">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(232,199,126,0.7)' }} /> MSI 진출</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }} /> 라운드 승리</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(248,113,113,0.6)' }} /> 탈락</span>
          </div>
        </section>
      )}

      {/* MSI/LPL 스테이지 대진표 — 섹션 구조 (단계 선택 시 해당 섹션만) */}
      {bracketSections?.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">대진표</h3>
            {official.bracket.desc && <span className="text-xs text-white/40">{official.bracket.desc}</span>}
          </div>
          <BracketGroup sections={bracketSections} crossConnectors={official.bracket.crossConnectors} onTeamClick={onTeamClick} />
          {official.bracket.legend?.length > 0 ? (
            <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-white/50">
              {official.bracket.legend.map((lg, i) => (
                <span key={i} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: lg.color }} /> {lg.label}</span>
              ))}
            </div>
          ) : (
            <BracketLegend />
          )}
        </section>
      )}

      {/* 대진별 예측 — 진행중인 리그에서만 (단계별 대진표가 있으면 생략) */}
    {comp.status === 'ongoing' && (!cfg || cfg.matches) && !lckBracketStage && !roadToMsi && comp.matches?.length > 0 && !(comp.key === 'lpl' && sub === 'Split 3') && !lplQualifier && (
      <section>
        <h3 className="text-sm font-black text-[#E8C77E] mb-4 uppercase tracking-wider">대진별 예측</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {comp.matches.map((m, i) => (
            <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-sm">
              <span className={`flex-1 flex items-center justify-end gap-1.5 font-bold truncate ${m.winner === m.a ? 'text-[#E8C77E]' : 'text-white/60'}`}>
                {m.winner === m.a && <Trophy size={12} className="shrink-0" />}
                <span className="truncate">{nameByShort[m.a] || m.a}</span>
                <TeamLogo src={logoByShort[m.a]} size={18} />
              </span>
              <span className="px-2 py-0.5 rounded bg-white/10 text-[11px] font-black text-white/70 shrink-0">{m.pA}%</span>
              <span className={`flex-1 flex items-center justify-start gap-1.5 font-bold truncate ${m.winner === m.b ? 'text-[#E8C77E]' : 'text-white/60'}`}>
                <TeamLogo src={logoByShort[m.b]} size={18} />
                <span className="truncate">{nameByShort[m.b] || m.b}</span>
                {m.winner === m.b && <Trophy size={12} className="shrink-0" />}
              </span>
            </div>
          ))}
        </div>
      </section>
      )}
    </div>
  );
};

// 종료된 대회의 실제 결과 렌더
const ResultView = ({ comp }) => {
  const fr = comp.finalResult;
  return (
    <div className="flex flex-col gap-8">
      {fr?.champion && (
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#C8963E]/20 to-transparent border border-[#C8963E]/30">
          <Crown size={32} className="text-[#E8C77E] shrink-0" />
          <div>
            <p className="text-xs text-white/50 font-bold uppercase tracking-wider">우승</p>
            <p className="text-2xl font-black text-[#E8C77E]">{fr.champion}</p>
            {fr.runnerUp && <p className="text-sm text-white/50 mt-0.5">준우승 {fr.runnerUp}</p>}
          </div>
        </div>
      )}

      {fr?.standings?.length > 0 && (
        <section>
          <h3 className="text-sm font-black text-[#E8C77E] mb-4 uppercase tracking-wider">최종 순위</h3>
          <div className="flex flex-col gap-2">
            {fr.standings.map((row, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="w-7 text-center font-black text-white/40 font-mono shrink-0">{row.rank ?? i + 1}</span>
                <span className="font-bold text-white/90">{row.team}</span>
                {row.note && <span className="ml-auto text-xs text-white/40">{row.note}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const NotReady = ({ comp }) => (
  <div className="py-16 text-center border-2 border-dashed border-white/10 rounded-3xl">
    <Hourglass size={28} className="mx-auto text-white/30 mb-3" />
    <p className="text-white/50 font-bold mb-1">
      {comp.status === 'finished' ? '결과 정리 중' : '시뮬레이션 준비 중'}
    </p>
    <p className="text-white/30 text-sm">
      {comp.status === 'finished'
        ? '종료된 대회의 실제 결과를 곧 게재합니다.'
        : 'GPR 팀별 점수를 반영한 몬테카를로 예측을 곧 게재합니다.'}
    </p>
  </div>
);

const GPR_TAB = { key: 'gpr', name: 'GPR 순위', scope: 'data', color: '#E8C77E' };

// 탭 로고 (LoL Esports / 각 대회). 출처: static.lolesports.com
const LOLESPORTS_LOGO = 'https://static.lolesports.com/leagues/1693555886600_lolesports_icon_ice-01.png';
const COMP_LOGO = {
  lck: 'https://static.lolesports.com/leagues/lck-color-on-black.png',
  lpl: 'https://static.lolesports.com/leagues/1592516115322_LPL-01-FullonDark.png',
  lec: 'https://static.lolesports.com/leagues/1592516184297_LEC-01-FullonDark.png',
  lcp: 'https://static.lolesports.com/leagues/1733468139601_lcp-color-golden.png',
  lcs: 'https://static.lolesports.com/leagues/1706356907418_LCSNew-01-FullonDark.png',
  cblol: 'https://static.lolesports.com/leagues/cblol-logo-symbol-offwhite.png',
  fst: 'https://static.lolesports.com/leagues/1740042025201_RG_LOL_FIRST_STAND_LOGO_VOLT_ALPHA.png',
  msi: 'https://static.lolesports.com/leagues/1592594634248_MSIDarkBG.png',
  demacia: demaciaLogo,
  worlds: 'https://static.lolesports.com/leagues/1592594612171_WorldsDarkBG.png',
};
const tabLogo = (key) => (key === 'gpr' ? LOLESPORTS_LOGO : COMP_LOGO[key]);

// 지역 리그별 세부 대회 (2026 기준)
const SUBTABS = {
  lck: ['LCK CUP', 'LCK', 'Road to MSI'],
  lpl: ['Split 1', 'Split 2', 'Split 3', '대표 선발전'],
  lec: ['Versus', 'Spring', 'Summer'],
  lcp: ['Split 1', 'Split 2', 'Split 3'],
  lcs: ['Lock-In', 'Spring', 'Summer'],
  cblol: ['Copa', 'Split 1', 'Split 2'],
  msi: ['플레이-인 스테이지', '브래킷 스테이지'],
};
// 세부 대회 기본 선택(현재 진행/직전 완료된 대회)
const SUBTAB_DEFAULT = { lck: 'LCK', lpl: 'Split 3', lec: 'Summer', lcp: 'Split 3', lcs: 'Summer', cblol: 'Split 2', msi: '브래킷 스테이지' };
// 아직 시작하지 않은 세부 대회 → "예정" 표시
const SUB_UPCOMING = {
  lec: ['Summer'],
  lcs: ['Summer'],
  cblol: ['Split 2'],
};
// 세부 대회별 상태 배지 오버라이드 — 리그 전체 상태(comp.status)와 무관하게 표시할 값
const SUB_STATUS = {
  'lpl|Split 1': 'finished',
  'lpl|Split 2': 'finished',
  'lpl|Split 3': 'ongoing',
  'lpl|대표 선발전': 'upcoming',
  'lec|Versus': 'finished',
  'lec|Spring': 'finished',
  'lec|Summer': 'upcoming',
  'lcp|Split 1': 'finished',
  'lcp|Split 2': 'finished',
  'lcp|Split 3': 'finished',
  'lcs|Lock-In': 'finished',
  'lcs|Spring': 'finished',
  'lcs|Summer': 'upcoming',
  'cblol|Copa': 'finished',
  'cblol|Split 1': 'finished',
  'cblol|Split 2': 'upcoming',
  'lck|Road to MSI': 'finished',
};
// 세부대회 안에서 단계(스테이지) 선택 — `${comp.key}|${sub}` → 단계 목록
const STAGE_TABS = {
  'lck|LCK': ['정규시즌', '플레이-인', '플레이오프', '최종 순위'],
  'lpl|Split 3': ['럼블 스테이지', '기사의 길', '플레이오프'],
  'lpl|대표 선발전': ['대진', '챔피언십 포인트'],
  demacia: ['그룹 스테이지', '녹아웃 스테이지'],
  'lcp|Split 3': ['스위스 스테이지', '플레이-인 스테이지', '플레이오프'],
  worlds: ['플레이-인', '스위스 스테이지', '녹아웃 스테이지'],
};
// 기본 선택 단계(탭 순서와 별개로 진입 시 표시할 단계) — 없으면 첫 단계
const STAGE_DEFAULT = {
  'lck|LCK': '플레이오프',
  'lpl|Split 3': '플레이오프',
};

const PredictionPage = () => {
  const comps = sim.competitions;
  const tabs = [GPR_TAB, ...comps];
  const validKeys = useMemo(() => [GPR_TAB.key, ...comps.map((c) => c.key)], [comps]);

  // 탭 = URL 경로(/lol/prediction/:tab), 세부 대회 = 쿼리(?sub=) → 새로고침해도 유지
  const { tab } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTeam, setSelectedTeam] = useState(null);
  const handleTeamClick = (short) => {
    if (selectedTeam === short) {
      navigate(`/lol/prediction/team/${short}`);
    } else {
      setSelectedTeam(short);
    }
  };

  const activeKey = tab && validKeys.includes(tab) ? tab : 'gpr';
  // 알 수 없는 탭 경로는 기본 탭으로 정리
  useEffect(() => {
    if (tab && !validKeys.includes(tab)) navigate('/lol/prediction/gpr', { replace: true });
  }, [tab, validKeys, navigate]);

  const setActiveKey = (key) => navigate(`/lol/prediction/${key}`);

  const isGpr = activeKey === 'gpr';
  const comp = useMemo(() => comps.find((c) => c.key === activeKey), [comps, activeKey]);
  const subTabs = comp ? SUBTABS[comp.key] : null;
  const subParam = searchParams.get('sub');
  const activeSub = subTabs
    ? (subParam && subTabs.includes(subParam) ? subParam : (SUBTAB_DEFAULT[comp.key] || subTabs[0]))
    : null;
  const setActiveSub = (s) => setSearchParams({ sub: s }, { replace: true });
  const subUpcoming = !!(comp && activeSub && SUB_UPCOMING[comp.key]?.includes(activeSub));
  // 세부 대회별 상태 오버라이드가 있으면 리그 전체 상태(comp.status) 대신 그 값으로 배지를 표시
  const subStatus = comp && activeSub ? SUB_STATUS[`${comp.key}|${activeSub}`] : null;
  const st = comp ? (statusMeta[subStatus || comp.status] || statusMeta.upcoming) : null;
  // 제목 접미사: 점(·) 없이 공백으로 이어붙이되, 리그명이 sub에 중복되면 제거
  // 예) LPL+'Split 2' → "Split 2", LCK+'LCK' → "", LCK+'LCK CUP' → "CUP"
  const subSuffix = (() => {
    if (!subTabs || !activeSub) return '';
    const lg = comp.name.replace('2026 ', '');
    if (activeSub === lg) return '';
    const t = activeSub.startsWith(lg + ' ') ? activeSub.slice(lg.length + 1) : activeSub;
    return ` ${t}`;
  })();
  // CBLOL 예외 표기: "CBLOL 2026" 기준, Copa는 앞에 → "Copa CBLOL 2026", 그 외 세부는 뒤에
  const title = (() => {
    if (comp?.key === 'cblol') {
      const base = 'CBLOL 2026';
      if (activeSub === 'Copa') return `Copa ${base}`;
      if (activeSub && activeSub !== 'CBLOL') return `${base} ${activeSub}`;
      return base;
    }
    return `${comp?.name ?? ''}${subSuffix}`;
  })();
  // 세부대회 내 단계 선택(LCK→LCK, LPL→Split 3 등)
  // stage 목록: 서브탭이 있으면 `key|sub`으로, 서브탭이 없는 대회는 key만으로도 조회
  const stageList = comp ? (STAGE_TABS[`${comp.key}|${activeSub}`] || (!subTabs && STAGE_TABS[comp.key])) : null;
  const showStages = !!stageList;
  const defaultStage = (comp && STAGE_DEFAULT[`${comp.key}|${activeSub}`]) || (stageList ? stageList[0] : null);
  const activeStage = showStages
    ? (stageList.includes(searchParams.get('stage')) ? searchParams.get('stage') : defaultStage)
    : null;
  const setActiveStage = (s) =>
    setSearchParams((p) => { const n = new URLSearchParams(p); n.set('stage', s); return n; }, { replace: true });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] p-6 md:p-12 text-white">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 bg-[#C8963E] rounded-xl flex items-center justify-center shrink-0">
            <Target color="white" size={22} />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white">LoL 승부예측</h1>
        </div>

        {/* 탭 선택 (GPR 순위 + 9개 대회) */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((c) => {
            const active = c.key === activeKey;
            return (
              <button
                key={c.key}
                onClick={() => setActiveKey(c.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-black border transition-all ${
                  active ? '' : 'text-white/60 border-white/15 hover:border-white/40 bg-transparent'
                }`}
                style={active ? { backgroundColor: c.color, borderColor: c.color, color: textOn(c.color) } : {}}
              >
                <img src={tabLogo(c.key)} alt="" width={18} height={18}
                  className="object-contain shrink-0"
                  style={{ width: 18, height: 18, filter: active ? (c.key === 'worlds' ? 'brightness(0)' : 'brightness(0) invert(1)') : 'none', opacity: active ? 0.9 : 1 }}
                  onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                {c.tabName || c.name.replace('2026 ', '')}
              </button>
            );
          })}
        </div>

        {/* 선택된 탭 카드 */}
        <div className="rounded-3xl bg-white/5 border border-white/10 p-6 md:p-8">
          {isGpr ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#C8963E]">
                  <img src={LOLESPORTS_LOGO} alt="GPR" width={24} height={24} className="object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">GPR 팀 랭킹</h2>
                  <p className="text-xs text-white/40">Global Power Rankings · {gprTeams.teams.length}팀 · 갱신 {gprTeams.updatedAt}</p>
                </div>
              </div>
              <GprTable selectedTeam={selectedTeam} onTeamClick={handleTeamClick} />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: comp.color }}>
                    <img src={COMP_LOGO[comp.key]} alt={comp.name} width={24} height={24} className="object-contain"
                      style={{ filter: comp.key === 'worlds' ? 'brightness(0)' : 'brightness(0) invert(1)' }}
                      onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">{title}</h2>
                    <p className="text-xs text-white/40">{comp.scope === 'intl' ? '국제 대회' : '지역 리그'}</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg text-xs font-black" style={{ color: st.color, backgroundColor: st.bg }}>
                  {st.label}
                </span>
              </div>

              {/* 세부 대회 선택 */}
              {subTabs && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {subTabs.map((s) => {
                    const on = s === activeSub;
                    return (
                      <button
                        key={s}
                        onClick={() => setActiveSub(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          on ? 'bg-white/15 text-white border-white/30' : 'text-white/45 border-white/10 hover:border-white/30 hover:text-white/70'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 단계 선택 (LCK→LCK 전용) */}
              {showStages && (
                <div className="inline-flex bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
                  {stageList.map((s) => {
                    const on = s === activeStage;
                    return (
                      <button
                        key={s}
                        onClick={() => setActiveStage(s)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                          on ? 'bg-[#C8963E] text-[#1e2328]' : 'text-white/50 hover:text-white/80'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              )}

              {isContentTbd(comp.key, activeSub) ? (
                <div className="py-20 text-center border-2 border-dashed border-white/10 rounded-3xl">
                  <Hourglass size={32} className="mx-auto text-white/30 mb-4" />
                  <p className="text-white/60 font-black text-lg mb-2">추후 제공 예정</p>
                  <p className="text-white/30 text-sm">해당 대회 정보를 준비 중입니다.</p>
                </div>
              ) : subUpcoming ? (
                <div className="py-16 text-center border-2 border-dashed border-white/10 rounded-3xl">
                  <Hourglass size={28} className="mx-auto text-white/30 mb-3" />
                  <p className="text-white/50 font-bold mb-1">아직 시작하지 않은 대회입니다</p>
                  <p className="text-white/30 text-sm">{activeSub}가 시작되면 순위·예측을 게재합니다.</p>
                </div>
              ) : !comp.ready ? (
                <NotReady comp={comp} />
              ) : comp.status === 'finished' ? (
                <ResultView comp={comp} />
              ) : (
                <SimulationView comp={comp} sub={activeSub} stage={activeStage} onTeamClick={handleTeamClick} />
              )}
            </>
          )}
        </div>

        {/* GPR 지역 점수 참고 */}
        <section className="mt-8 p-5 rounded-2xl bg-white/5 border border-white/10">
          <h2 className="text-sm font-black text-[#E8C77E] mb-4 uppercase tracking-wider">참고 · 지역별 GPR 점수</h2>
          <div className="flex flex-col gap-2">
            {gpr.regions.map((r) => {
              const max = Math.max(...gpr.regions.map((x) => x.score));
              return (
                <div key={r.key} className="flex items-center gap-3">
                  <span className="w-14 text-sm font-black shrink-0" style={{ color: lighten(r.color) }}>{r.name}</span>
                  <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full flex items-center justify-end pr-2 text-[10px] font-black text-white/90"
                      style={{ width: `${(r.score / max) * 100}%`, backgroundColor: r.color }}>
                      {r.score}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 안내 · 레이팅 출처 (하단) */}
        <div className="mt-10 pt-6 border-t border-white/10">
          <a
            href={sim.source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/40 text-xs hover:text-[#E8C77E] inline-flex items-center gap-1"
          >
            레이팅 출처: lolesports.com Global Power Rankings <ExternalLink size={11} /> · 갱신 {fmtUpdated(sim.updatedAt)}
          </a>
          <p className="text-white/30 text-[11px] mt-2">
            TotalDU는 Riot Games의 서비스가 아닌 개인의 비공식 서비스이며 Riot Games 또는 리그 오브 레전드의 공개 데이터를 활용합니다. 리그 오브 레전드 및 Riot Games는 Riot Games, Inc.의 상표 또는 등록 상표입니다.
            <br />
            League of Legends © Riot Games, Inc.
          </p>
        </div>
      </div>
      {selectedTeam && (
        <TeamPanel
          teamShort={selectedTeam}
          onClose={() => setSelectedTeam(null)}
          onNavigate={() => navigate(`/lol/prediction/team/${selectedTeam}`)}
        />
      )}
    </div>
  );
};

export default PredictionPage;
