// scripts/fetchStandings.mjs
// lolesports.com 공식 API에서 각 리그의 "현재 스플릿 정규시즌" 순위와 일정을 받아
// client/src/data/lolStandings.json 을 갱신한다.
//
// 핵심: 순위(rank·시리즈 W-L)는 getStandingsV3 의 regular_season 스테이지에서 가져오므로
//   토너먼트 스테이지·플레이오프·플레이인·결승은 구조적으로 제외된다.
//   세트(게임) 승패 gw/gl 은 일정 경기에서 집계하되, 위 포스트시즌 블록을 키워드로 걸러낸다.
//   집계한 시리즈 W-L 이 공식 순위와 다르면 경고하고 gw/gl 은 비워 둔다(잘못된 값 방지).
//
// 실행: node scripts/fetchStandings.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '..', 'client', 'src', 'data', 'lolStandings.json');

const API = 'https://esports-api.lolesports.com/persisted/gw';
const KEY = '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z';
const HL = 'ko-KR';

// 갱신 대상: 국내(지역) 정규리그 6개. 국제전(FST·MSI·Worlds)은 정규시즌 개념이 없어 제외.
// key = lolStandings.json 의 리그 키, sub = 세부대회 키(PredictionPage SUBTAB_DEFAULT 와 일치해야 함).
const MSI_LEAGUE_ID = '98767991325878492'; // MSI 리그 ID
const LEAGUES = [
  { key: 'lck', sub: 'LCK', id: '98767991310872058', groups: true },
  { key: 'lpl', sub: 'Split 3', id: '98767991314006698', sectionAlias: { 'Group Ascend': '등봉조', 'Group Nirvana': '열반조' } },
  { key: 'lec', sub: 'Summer', id: '98767991302996019' },
  { key: 'lcp', sub: 'Split 2', id: '113476371197627891' },
  { key: 'lcs', sub: 'Summer', id: '98767991299243165' },
  { key: 'cblol', sub: 'Split 2', id: '98767991332355509' },
];

// 포스트시즌(정규시즌 이후) — 순위표 성적에서 제외. 블록명/스테이지명/슬러그에 키워드 포함 검사.
const POSTSEASON = [
  '토너먼트', '플레이오프', '플레이-인', '플레이 인', '플레이인', '결승', '승강', '승격', '선발',
  'playoff', 'play_in', 'play-in', 'play in', 'playin', 'knockout', 'final', 'bracket',
  'gauntlet', 'promotion', 'relegation', 'road_to', 'road to',
];
const isPostseason = (s) => {
  const b = (s || '').toLowerCase();
  return POSTSEASON.some((k) => b.includes(k));
};

// 포스트시즌 스테이지의 columns(브래킷)를 대진표 데이터로 변환.
// 그래프 기반 판정(포맷 무관): 매치 승자가 이후 매치에 안 쓰이면 '진출(msi=금)',
//   쓰이면 '라운드 승리(win=파랑)'. 패자가 이후에 안 쓰이면 '탈락(elim=빨강)'.
function bracketFromColumns(columns) {
  const roundOf = {};            // structuralId → 라운드명
  const referenced = new Set();  // `${structuralId}#${slot}` (1=승자, 2=패자)
  const all = [];
  for (const col of columns) for (const cell of col.cells || []) for (const m of cell.matches || []) {
    roundOf[m.structuralId] = cell.name;
    all.push(m);
  }
  for (const m of all) for (const t of m.teams || []) {
    const o = t.origin;
    if (o && o.type === 'match') referenced.add(`${o.structuralId}#${o.slot}`);
  }
  const adv = (sid, slot) => referenced.has(`${sid}#${slot}`);
  const labelOf = (t) => {
    const o = t.origin;
    if (!o) return '';
    if (o.type === 'seeding') return `${o.slot}위`;
    if (o.type === 'match') return `${roundOf[o.structuralId] || ''} ${o.slot === 1 ? '승자' : '패자'}`.trim();
    return '';
  };
  const slotOf = (m, t) => {
    if (!t) return { seed: '' };
    const done = m.state === 'completed';
    const win = t.result?.outcome === 'win';
    let flag = {};
    if (done) {
      if (win) flag = adv(m.structuralId, 1) ? { win: true } : { msi: true };
      else flag = adv(m.structuralId, 2) ? {} : { elim: true };
    }
    const o = { seed: labelOf(t) };
    if (t.code && t.code !== 'TBD') o.short = t.code; // 미정 슬롯(TBD)은 라벨만
    if (done && t.result?.gameWins != null) o.score = t.result.gameWins;
    return { ...o, ...flag };
  };
  // structuralId → {colIdx, matchIdx} (connector 계산용)
  const matchPos = {};
  for (let ci = 0; ci < columns.length; ci++) {
    let mi = 0;
    for (const cell of columns[ci].cells || []) {
      for (const m of cell.matches || []) { matchPos[m.structuralId] = { ci, mi }; mi++; }
    }
  }

  const rounds = [];
  const connectors = [];
  let roundIdx = 0;
  for (let ci = 0; ci < columns.length; ci++) {
    const matches = [];
    let mi = 0;
    for (const cell of columns[ci].cells || []) {
      for (const m of cell.matches || []) {
        const [a, b] = m.teams || [];
        matches.push({ id: m.id, title: cell.name, a: slotOf(m, a), b: slotOf(m, b) });
        // origin이 다른 match인 팀 슬롯 → connector 생성
        for (const [t, slot] of [[a, 'a'], [b, 'b']]) {
          const o = t?.origin;
          if (o?.type === 'match' && matchPos[o.structuralId] != null) {
            const src = matchPos[o.structuralId];
            connectors.push([src.ci, src.mi, 'mid', ci, mi, slot]);
          }
        }
        mi++;
      }
    }
    if (matches.length) { rounds.push({ title: '', matches }); roundIdx++; }
  }
  return { rounds, connectors };
}

// 시드 라벨 → 랭크(작을수록 상위). null이면 우열 없음.
//   LCK: 레전드 N위 = N, 라이즈 N위 = 5+N
//   LPL: 등봉조 N위 = N, 열반조 N위 = 8+N
//   기타: "N위" → N
function seedRank(seed) {
  if (!seed) return null;
  const m1 = seed.match(/^(레전드|라이즈)\s?(\d+)위$/);
  if (m1) return (m1[1] === '레전드' ? 0 : 5) + parseInt(m1[2], 10);
  const m2 = seed.match(/^(등봉|열반)조\s?(\d+)위$/);
  if (m2) return (m2[1] === '등봉' ? 0 : 8) + parseInt(m2[2], 10);
  const m3 = seed.match(/^(\d+)위$/);
  if (m3) return parseInt(m3[1], 10);
  return null;
}

// 싱글 엘리미네이션 표준 그리드 레이아웃 — 라운드 k, 매치 i에서
//   startRow = 2^k - 1 + i * 2^(k+1) 규칙으로 상위 라운드 매치가
//   하위 라운드 두 매치의 y좌표 중앙에 정렬된다. totalRows = 2 * (첫 라운드 매치 수).
//   8팀 SE: 8강 startRow=0/2/4/6, 4강=1/5, 결승=3 → totalRows=8.
function applySingleElimLayout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  const firstCount = bracket.rounds[0].matches.length;
  const totalRows = firstCount * 2;
  return {
    totalRows,
    rounds: bracket.rounds.map((r, ri) => ({
      ...r,
      matches: r.matches.map((m, i) => ({ ...m, startRow: Math.pow(2, ri) - 1 + i * Math.pow(2, ri + 1) })),
    })),
    connectors: bracket.connectors,
  };
}

// 4팀 더블 엘리미네이션(4rounds: 상위 4강×2 / 상위 결승·하위 4강 / 하위 결승 / 결승) 표준 그리드 레이아웃.
//   LCP 플레이오프·MSI 플레이-인·Worlds 플레이-인 등 4팀 DE 브래킷 공통 배치.
//   totalRows=8 · 상위 4강 좌상단(0,2) / 상위 결승 중상단(1) / 하위 4강 우상단(6) /
//   하위 결승 중하단(6) / 결승 우측 중앙(3).
function apply4TeamDELayout(bracket) {
  if (!bracket?.rounds || bracket.rounds.length < 4) return bracket;
  const P = bracket.rounds;
  const ubSF1 = P[0].matches[0], ubSF2 = P[0].matches[1];
  const ubF = P[1].matches[0], lbSF = P[1].matches[1];
  const lbF = P[2].matches[0], gf = P[3].matches[0];
  if (!ubSF1 || !ubSF2 || !ubF || !lbSF || !lbF || !gf) return bracket;
  return {
    totalRows: 8,
    rounds: [
      { title: '', matches: [{ ...ubSF1, startRow: 0 }, { ...ubSF2, startRow: 2 }] },
      { title: '', matches: [{ ...ubF, startRow: 1 }, { ...lbSF, startRow: 6 }] },
      { title: '', matches: [{ ...lbF, startRow: 6 }] },
      { title: '', matches: [{ ...gf, startRow: 3 }] },
    ],
    connectors: bracket.connectors,
  };
}

// 결승(마지막 매치)이 아닌 매치의 승자 msi 플래그를 win으로 강등.
//   bracketFromColumns 는 승자가 이후 매치에서 참조되지 않으면 msi(진출/우승)로 표시하지만,
//   자동 채움 후 참조 매칭이 안 될 수 있어 오탐이 발생. 최종 결승 승자만 우승(msi)로 남긴다.
function normalizeAdvancementFlags(bracket) {
  if (!bracket?.rounds?.length) return;
  const lastRound = bracket.rounds[bracket.rounds.length - 1];
  const finalMatch = lastRound?.matches?.[lastRound.matches.length - 1];
  for (const r of bracket.rounds) for (const m of r.matches) {
    for (const s of [m.a, m.b]) {
      if (!s?.msi) continue;
      if (m !== finalMatch) { delete s.msi; s.win = true; }
    }
  }
}

// 매치 슬롯 a/b를 시드 상위가 상단이 되도록 정리. connectors의 dest slot도 함께 반전.
//   두 슬롯 모두 시드 랭크 있으면 상위 시드를 a로.
//   한 쪽만 시드 랭크 있으면(예: 시드 팀 vs "플레이-인 진출") 시드 팀을 a로.
function applySeedOrder(bracket) {
  if (!bracket?.rounds) return;
  const conn = bracket.connectors || [];
  bracket.rounds.forEach((r, ci) => r.matches.forEach((m, mi) => {
    const ra = seedRank(m.a?.seed), rb = seedRank(m.b?.seed);
    let swap = false;
    if (ra != null && rb != null) swap = rb < ra;
    else if (ra == null && rb != null) swap = true;  // b쪽만 시드 있음 → a로 이동
    if (!swap) return;
    const t = m.a; m.a = m.b; m.b = t;
    conn.forEach((c) => { if (c[3] === ci && c[4] === mi) c[5] = c[5] === 'a' ? 'b' : 'a'; });
  }));
}

async function api(endpoint, params) {
  const url = `${API}/${endpoint}?` + new URLSearchParams({ hl: HL, ...params });
  const res = await fetch(url, { headers: { 'x-api-key': KEY } });
  if (!res.ok) throw new Error(`${endpoint} 실패: HTTP ${res.status}`);
  return res.json();
}

// 현재(또는 가장 최근 시작된) 2026 토너먼트 선택
function pickCurrentTournament(tournaments) {
  const today = new Date().toISOString().slice(0, 10);
  const y2026 = tournaments.filter((t) => t.endDate >= '2026-01-01');
  const ongoing = y2026.filter((t) => t.startDate <= today && t.endDate >= today);
  const pool = ongoing.length ? ongoing : y2026.filter((t) => t.startDate <= today);
  return pool.sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0] || null;
}

// 일정 페이지를 토너먼트 시작일까지 거슬러 받아 정규시즌 완료 경기만 모은다
async function collectRegularMatches(leagueId, tour) {
  const matches = [];
  let token = null;
  for (let guard = 0; guard < 20; guard++) {
    const params = { leagueId };
    if (token) params.pageToken = token;
    const { data } = await api('getSchedule', params);
    const events = data.schedule.events || [];
    for (const e of events) {
      if (e.type !== 'match' || e.state !== 'completed') continue;
      // 승자 없는(0-0 등) 비정상 완료 경기 제외 — 세트 집계가 순위표와 어긋나 득실 생략되는 문제 방지
      if (!e.match?.teams?.some((t) => t.result?.outcome === 'win')) continue;
      const day = (e.startTime || '').slice(0, 10);
      if (day < tour.startDate || day > tour.endDate) continue; // 다른 스플릿 제외
      if (isPostseason(e.blockName)) continue;                   // 포스트시즌 제외
      matches.push(e.match);
    }
    const oldest = events[0]?.startTime?.slice(0, 10);
    token = data.schedule.pages?.older;
    if (!token || (oldest && oldest < tour.startDate)) break;    // 토너먼트 시작 이전이면 중단
  }
  return matches;
}

// 특정 토너먼트의 정규시즌 팀별 기록(시리즈 W-L + 세트 gw/gl) 추출 — 대회 합산용
async function tournamentRecords(leagueId, tour) {
  const out = {};
  const sjson = await api('getStandingsV3', { tournamentId: tour.id });
  const standing = sjson.data?.standings?.[0];
  if (!standing) return out;
  const reg = standing.stages
    .filter((s) => !isPostseason(s.slug) && !isPostseason(s.name))
    .map((s) => ({ s, n: s.sections.reduce((a, x) => a + x.rankings.length, 0) }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)[0]?.s;
  if (!reg) return out;
  const set = {}; const bump = (c) => (set[c] = set[c] || { gw: 0, gl: 0, sw: 0, sl: 0 });
  const matches = await collectRegularMatches(leagueId, tour);
  for (const m of matches) {
    const [a, b] = m.teams;
    if (!a?.code || !b?.code) continue;
    const A = bump(a.code), B = bump(b.code);
    A.gw += a.result.gameWins; A.gl += b.result.gameWins;
    B.gw += b.result.gameWins; B.gl += a.result.gameWins;
    if (a.result.outcome === 'win') { A.sw++; B.sl++; } else { B.sw++; A.sl++; }
  }
  for (const sec of reg.sections) for (const r of sec.rankings) for (const t of r.teams) {
    const s = set[t.code]; const w = t.record.wins, l = t.record.losses;
    const ok = s && s.sw === w && s.sl === l;
    out[t.code] = { w, l, gw: ok ? s.gw : null, gl: ok ? s.gl : null };
  }
  return out;
}

async function buildLeague(lg) {
  const tjson = await api('getTournamentsForLeague', { leagueId: lg.id });
  const tour = pickCurrentTournament(tjson.data.leagues[0].tournaments);
  if (!tour) throw new Error(`${lg.label}: 현재 토너먼트 없음`);

  const sjson = await api('getStandingsV3', { tournamentId: tour.id });
  const standing = sjson.data.standings[0];
  // 정규시즌 스테이지 = 포스트시즌이 아니면서 순위가 가장 많은 스테이지(정규 리그/그룹 스테이지)
  const regCandidates = standing.stages
    .filter((s) => !isPostseason(s.slug) && !isPostseason(s.name))
    .map((s) => ({ s, n: s.sections.reduce((a, x) => a + x.rankings.length, 0) }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);
  if (!regCandidates.length) throw new Error(`${lg.label}: 정규시즌 스테이지 없음`);
  const reg = regCandidates[0].s;
  // 섹션이 2개 이상이면 그룹 스테이지 → 섹션명을 그룹으로 사용
  const multi = reg.sections.length > 1;

  // 세트 승패 집계 (정규시즌 완료 경기)
  const set = {}; // code -> {gw, gl, sw, sl}  (sw/sl = 시리즈 검증용)
  const bump = (c) => (set[c] = set[c] || { gw: 0, gl: 0, sw: 0, sl: 0 });
  const matches = await collectRegularMatches(lg.id, tour);
  for (const m of matches) {
    const [a, b] = m.teams;
    if (!a?.code || !b?.code) continue;
    const A = bump(a.code), B = bump(b.code);
    A.gw += a.result.gameWins; A.gl += b.result.gameWins;
    B.gw += b.result.gameWins; B.gl += a.result.gameWins;
    if (a.result.outcome === 'win') { A.sw++; B.sl++; } else { B.sw++; A.sl++; }
  }

  // 공식 순위 + 집계 세트로 행 구성. 시리즈 W-L 불일치 시 gw/gl 생략.
  let mismatches = 0;
  const rows = [];
  for (const sec of reg.sections) {
    for (const r of sec.rankings) {
      for (const t of r.teams) {
        const s = set[t.code];
        const w = t.record.wins, l = t.record.losses;
        const ok = s && s.sw === w && s.sl === l;
        if (!ok) mismatches++;
        const row = { rank: r.ordinal, team: t.code, w, l };
        if (ok) { row.gw = s.gw; row.gl = s.gl; }
        else if (!s && w === 0 && l === 0) { row.gw = 0; row.gl = 0; } // 미시작 → 득실차 0 표기
        if (multi) row.group = (lg.sectionAlias?.[sec.name]) || sec.name;
        rows.push(row);
      }
    }
  }
  rows.sort((a, b) => (a.group || '').localeCompare(b.group || '') || a.rank - b.rank);
  // LCK는 단일 섹션이지만 포맷상 상위5 레전드 / 하위5 라이즈로 분할
  if (lg.groups && !multi) rows.forEach((row, i) => { row.group = i < 5 ? 'Legend' : 'Rise'; });

  // LCK: 2026 LCK는 Split 2(1·2R)+Split 3(3·4R)가 한 시즌 → Split 2 기록을 합산해 누적 반영.
  //   (Split 3 순위표는 그룹 구조만 제공하고 아직 0-0이므로, 1·2R 승패·득실을 더한다)
  if (lg.key === 'lck') {
    const s2 = tjson.data.leagues[0].tournaments.find((t) => /split_2_2026/.test(t.slug));
    if (s2) {
      const rec2 = await tournamentRecords(lg.id, s2);
      for (const row of rows) {
        const r = rec2[row.team];
        if (!r) continue;
        row.w += r.w; row.l += r.l;
        if (row.gw != null && r.gw != null) { row.gw += r.gw; row.gl += r.gl; }
        else if (r.gw != null) { row.gw = r.gw; row.gl = r.gl; }
      }
      // 합산 기록으로 그룹 내 재정렬 + 순위 재부여
      const gd = (r) => (r.gw != null && r.gl != null ? r.gw - r.gl : -999);
      rows.sort((a, b) => (a.group || '').localeCompare(b.group || '') || b.w - a.w || gd(b) - gd(a) || a.rank - b.rank);
      const rk = {};
      for (const row of rows) { rk[row.group] = (rk[row.group] || 0) + 1; row.rank = rk[row.group]; }
    }
  }

  // LCK 진행 단계 라벨 — 2026 LCK는 한 시즌(1·2R=Split2, 3·4R=Split3)
  let stage = `${standing.name} 정규시즌`;
  if (lg.key === 'lck') {
    const maxG = Math.max(...rows.map((r) => r.w + r.l));
    stage = maxG <= 18
      ? '2026 LCK · 정규 1·2R 종료 (3·4R 진행 예정)'
      : '2026 LCK · 정규 3·4R 진행';
  }

  // 포스트시즌 브래킷(LCK Road to MSI 등) — columns 있는 비정규 스테이지를 대진표로 변환
  let road = null;
  let roadMsiTeam = null; // Road to MSI 우승팀 (LCK MSI 플레이-인 진출)
  if (lg.key === 'lck') {
    const rs = standing.stages.find((s) => s.slug === 'road_to_msi');
    const cols = rs?.sections?.[0]?.columns;
    if (cols?.length) {
      const top6 = [...rows].sort((a, b) => a.rank - b.rank).slice(0, 6)
        .map(({ group, ...r }) => r); // 진출 6팀(그룹 라벨 제거)
      const { rounds: apiRounds, connectors: apiConnectors } = bracketFromColumns(cols);
      // MSI 우승팀 추출 (msi: true 플래그) — API rounds에서 직접 추출
      for (const r of apiRounds) for (const m of r.matches) {
        if (m.a?.msi && m.a?.short) roadMsiTeam = m.a.short;
        if (m.b?.msi && m.b?.short) roadMsiTeam = m.b.short;
      }
      // 기존 bracket 구조 보존: API가 컬럼을 1:1로 매핑(예: 5열)하더라도
      // lolStandings.json에 이미 "컴팩트 구조"(열 합산, totalRows 포함)가 있으면
      // startRow/totalRows/connectors는 유지하고 경기 결과만 갱신한다.
      const prevBracket = data.standings.lck?.['Road to MSI']?.bracket;
      const isCompact = prevBracket?.rounds && prevBracket.rounds.length < apiRounds.length;
      let bracketRounds, bracketConnectors, bracketTotalRows;
      if (isCompact) {
        const apiByTitle = {};
        for (const r of apiRounds) for (const m of r.matches) {
          if (m.title) apiByTitle[m.title] = m;
        }
        bracketRounds = prevBracket.rounds.map((r) => ({
          ...r,
          matches: r.matches.map((m) => {
            const fresh = m.title ? apiByTitle[m.title] : null;
            return fresh ? { ...fresh, startRow: m.startRow } : m;
          }),
        }));
        bracketConnectors = prevBracket.connectors;
        bracketTotalRows = prevBracket.totalRows;
      } else {
        bracketRounds = apiRounds;
        bracketConnectors = apiConnectors;
        bracketTotalRows = undefined;
      }
      road = {
        stage: `${standing.name} · MSI 선발전 (상위 6팀)`,
        rows: top6,
        bracket: {
          desc: '상위 6팀 사다리식 · 전 경기 Bo5 · 금색=MSI 진출, 파랑=라운드 승리, 빨강=탈락',
          ...(bracketTotalRows != null ? { totalRows: bracketTotalRows } : {}),
          rounds: bracketRounds,
          connectors: bracketConnectors,
        },
      };
    }
  }

  return { tour, rows, mismatches, stage, road, roadMsiTeam };
}

// MSI 진출팀 갱신: getStandingsV3로 각 스테이지의 확정 팀을 가져와
// lolStandings.json 의 msi[stage].qualifiers 를 업데이트한다.
// 미확정(TBD) 슬롯은 기존 label 표기를 유지한다.
async function buildMsiQualifiers(prevMsi) {
  const tjson = await api('getTournamentsForLeague', { leagueId: MSI_LEAGUE_ID });
  // pickCurrentTournament 은 진행 중/과거만 보므로 MSI는 별도로 선택.
  // 올해(2026) 대회를 우선 선택하되, 아직 시작 전(미래)이어도 허용.
  const today = new Date().toISOString().slice(0, 10);
  const all = tjson.data.leagues[0].tournaments || [];
  const y2026 = all.filter((t) => t.endDate >= '2026-01-01' && t.startDate <= '2026-12-31');
  // 가장 가까운 2026 대회 (진행 중 우선, 없으면 다음 예정)
  const tour = y2026.sort((a, b) => {
    const da = Math.abs(new Date(a.startDate) - new Date(today));
    const db = Math.abs(new Date(b.startDate) - new Date(today));
    return da - db;
  })[0] || null;
  if (!tour) return null;

  const sjson = await api('getStandingsV3', { tournamentId: tour.id });
  const standing = sjson.data.standings[0];
  const result = {};

  for (const stage of standing.stages || []) {
    const slug = (stage.slug || stage.name || '').toLowerCase();
    const stageKey = slug.includes('play') ? '플레이-인 스테이지' : '브래킷 스테이지';
    const prevStage = prevMsi[stageKey];
    if (!prevStage) continue;

    const prevQual = prevStage.qualifiers || [];
    const slots = [];

    // 1) 순위표 기반 (그룹 스테이지)
    for (const sec of stage.sections || []) {
      const ranked = [...(sec.rankings || [])].sort((a, b) => a.ordinal - b.ordinal);
      for (const r of ranked) {
        for (const t of r.teams || []) {
          slots.push(t.code && t.code !== 'TBD' ? { short: t.code } : null);
        }
      }
    }

    // 2) 브래킷 시딩 기반 (순위표 없을 때)
    if (!slots.length) {
      const seen = new Map(); // seed → code
      for (const sec of stage.sections || []) {
        for (const col of sec.columns || []) {
          for (const cell of col.cells || []) {
            for (const m of cell.matches || []) {
              for (const t of m.teams || []) {
                if (t.origin?.type === 'seeding') {
                  const seed = t.origin.slot;
                  if (!seen.has(seed)) seen.set(seed, t.code && t.code !== 'TBD' ? t.code : null);
                }
              }
            }
          }
        }
      }
      [...seen.keys()].sort((a, b) => a - b).forEach((s) => {
        const code = seen.get(s);
        slots.push(code ? { short: code } : null);
      });
    }

    if (!slots.length) continue;

    // API 슬롯이 prevQual보다 짧을 수 있으므로 prevQual 길이 기준으로 iterate
    // null 슬롯 또는 범위 초과 슬롯 → 기존 label 유지
    const qualifiers = Array.from({ length: prevQual.length }, (_, i) => {
      const s = i < slots.length ? slots[i] : null;
      return s ?? prevQual[i] ?? null;
    }).filter(Boolean);

    result[stageKey] = qualifiers;
    const confirmed = qualifiers.filter((q) => q.short).length;
    const names = qualifiers.filter((q) => q.short).map((q) => q.short).join(', ');
    console.log(`MSI ${stageKey}: ${confirmed}/${qualifiers.length}팀 확정 (${names || '없음'})`);
  }

  return Object.keys(result).length ? result : null;
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
data.standings = data.standings || {};
data.source = data.source || {};

// 리그별 Road to MSI 우승팀 수집: lgKey → team code
const roadMsiByLeague = {};

for (const lg of LEAGUES) {
  try {
    const { tour, rows, mismatches, stage, road, roadMsiTeam } = await buildLeague(lg);
    // 기존 수동 키(Road to MSI 등)를 보존하기 위해 통째로 덮어쓰지 않고 병합
    const prev = data.standings[lg.key] || {};
    data.standings[lg.key] = { ...prev, [lg.sub]: { ...(prev[lg.sub] || {}), stage, rows } };
    if (road) data.standings[lg.key]['Road to MSI'] = road; // 대진표 자동 갱신
    data.source[lg.key] = `https://lolesports.com/ko-KR/leagues/${lg.key === 'cblol' ? 'cblol-brazil' : lg.key}`;
    const warn = mismatches ? ` ⚠️ 세트 불일치 ${mismatches}팀(gw/gl 생략)` : '';
    const br = road ? ` · 대진표 ${road.bracket.rounds.length}R` : '';
    console.log(`${lg.key.toUpperCase()}: ${tour.slug} · ${rows.length}팀 · 1위 ${rows[0].team} ${rows[0].w}-${rows[0].l}${warn}${br}`);
    if (roadMsiTeam) roadMsiByLeague[lg.key] = roadMsiTeam;
  } catch (e) {
    console.warn(`${lg.label} 실패 — 기존 값 유지: ${e.message}`);
  }
}

// MSI 진출팀 갱신 — 두 단계로 시도:
// 1) label 텍스트의 "리그 · 팀A vs 팀B 승자/패자" 패턴으로 스케줄 직접 조회 (즉시 반영)
// 2) MSI API 직접 조회 (대회 시작 후 순위표가 생기면 반영)

// 리그명(한글/영문 prefix) → LEAGUES leagueId 맵
const LABEL_TO_LEAGUE = Object.fromEntries(
  LEAGUES.map((lg) => [lg.key.toUpperCase(), lg.id])
);

// label에서 "리그 · TEAM1 vs TEAM2 승자/패자" 파싱
// 단순형: team1+team2 직접 반환
// 괄호형 "(T1·T2 승자/패자) vs TEAM3": parenTeam1/2/Want + team2 반환
function parseMsiLabel(label) {
  // 단순 패턴: "LEAGUE · TEAM1 vs TEAM2 승자/패자"
  const simple = label.match(/^([A-Z]+)\s·\s+(\w+)\s+vs\s+(\w+)\s+(승자|패자)$/);
  if (simple) return { lgKey: simple[1], team1: simple[2], team2: simple[3], want: simple[4] };

  // 괄호형 패턴: "LEAGUE · (TEAM1·TEAM2 승자/패자) vs TEAM3 승자/패자"
  const paren = label.match(/^([A-Z]+)\s·\s+\((\w+)·(\w+)\s+(승자|패자)\)\s+vs\s+(\w+)\s+(승자|패자)$/);
  if (paren) return { lgKey: paren[1], parenTeam1: paren[2], parenTeam2: paren[3], parenWant: paren[4], team2: paren[5], want: paren[6] };

  return null;
}

// 해당 리그 스케줄에서 특정 매치 결과 조회
// team1+team2 둘 다 주어지면 두 팀 모두 포함된 경기만 찾음
// afterDate(ISO 문자열)가 있으면 그 날짜 이후 경기만 인정
async function findMatchResult(leagueId, team1, team2, afterDate = null) {
  let token = null;
  for (let guard = 0; guard < 6; guard++) {
    const params = { leagueId };
    if (token) params.pageToken = token;
    const { data: d } = await api('getSchedule', params);
    const events = d.schedule.events || [];
    for (const e of events) {
      if (e.type !== 'match' || e.state !== 'completed') continue;
      if (afterDate && e.startTime && e.startTime < afterDate) continue;
      const teams = e.match?.teams || [];
      const codes = teams.map((t) => t.code);
      if (team1 && team2) {
        if (!codes.includes(team1) || !codes.includes(team2)) continue;
      } else {
        if (!codes.includes(team2)) continue;
      }
      const winner = teams.find((t) => t.result?.outcome === 'win')?.code;
      const loser  = teams.find((t) => t.result?.outcome === 'loss')?.code;
      if (winner && loser) return { winner, loser };
    }
    token = d.schedule.pages?.older;
    if (!token) break;
  }
  return null;
}

// MSI 플레이-인 브래킷 경기 결과 자동 반영.
// 수동 레이아웃(상위/하위조 sections·연결선)은 그대로 두고, 각 슬롯의 점수(score)와
// 승패 플래그(win/elim/msi)만 lolesports 스케줄에서 가져와 덮어쓴다.
// 슬롯 팀은 라벨 의존관계("M1 승자"·"하위조 진출팀")로 해석하며, 플래그 규칙은
// bracketFromColumns 와 동일: 승자가 이후 경기에 쓰이면 win, 안 쓰이면 msi(진출);
// 패자가 이후 경기에 안 쓰이면 elim(탈락).
async function fillMsiPlayinResults(prevMsi) {
  const stage = prevMsi['플레이-인 스테이지'];
  const sections = stage?.bracket?.sections;
  if (!sections) return false;

  // 1) MSI 스케줄에서 올해(2026) 플레이-인 완료 경기만 수집
  //    (2024·2025 동일 대진과 혼동되지 않도록 연도·블록명으로 필터)
  const completed = [];
  let token = null;
  for (let guard = 0; guard < 8; guard++) {
    const params = { leagueId: MSI_LEAGUE_ID };
    if (token) params.pageToken = token;
    const { data: d } = await api('getSchedule', params);
    for (const e of d.schedule.events || []) {
      if (e.type !== 'match' || e.state !== 'completed') continue;
      if (!e.startTime || e.startTime < '2026-01-01') continue;
      if (!/플레이|play/i.test(e.blockName || '')) continue;
      const teams = e.match?.teams || [];
      if (teams.length !== 2) continue;
      const [x, y] = teams;
      if (!x.code || !y.code || x.code === 'TBD' || y.code === 'TBD') continue;
      completed.push({
        date: e.startTime.slice(0, 10), // YYYY-MM-DD (UTC)
        score: { [x.code]: x.result?.gameWins ?? 0, [y.code]: y.result?.gameWins ?? 0 },
        winner: teams.find((t) => t.result?.outcome === 'win')?.code || null,
        loser: teams.find((t) => t.result?.outcome === 'loss')?.code || null,
      });
    }
    token = d.schedule.pages?.older;
    if (!token) break;
  }
  // 브래킷 매치 제목의 "(M/D)" → 2026-MM-DD (같은 대진이 여러 번 열릴 때 날짜로 구분)
  const dateOf = (title) => {
    const m = (title || '').match(/\((\d{1,2})\/(\d{1,2})/); // 시간 접미사(HH:MM) 허용
    return m ? `2026-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
  };
  // 날짜가 주어지면 그 날짜의 완료 경기만 인정(예: T1-TLAW 가 6/28 M1·7/1 최종전 두 번 열려도
  //   각각의 경기에 올바로 매칭). 이미 사용한 경기는 제외해 중복 매칭도 방지.
  const used = new Set();
  const findResult = (t1, t2, date) => {
    const ok = (m) => !used.has(m) && m.score[t1] != null && m.score[t2] != null && m.winner;
    const chosen = date ? completed.find((m) => ok(m) && m.date === date)
                        : completed.find(ok);
    if (chosen) used.add(chosen);
    return chosen || null;
  };

  // 2) 매치를 번호로 수집: 제목의 "Match N", 최종 진출전은 'F'
  const byNum = {};
  for (const sec of sections) {
    for (const round of sec.rounds || []) {
      for (const mt of round.matches || []) {
        const mm = (mt.title || '').match(/Match\s*(\d+)/);
        if (mm) byNum[mm[1]] = mt;
        else if (/최종\s*진출전/.test(mt.title || '')) byNum.F = mt;
      }
    }
  }

  // 3) 라벨 참조 집합: 승자(#1)/패자(#2)가 이후 경기에 쓰이는지
  const referenced = new Set();
  const addRef = (lbl) => {
    const m = (lbl || '').match(/^M(\d+)\s*(승자|패자)$/);
    if (m) referenced.add(`${m[1]}#${m[2] === '승자' ? 1 : 2}`);
    if (lbl === '하위조 진출팀') referenced.add('5#1'); // 하위조 최종(M5) 승자
  };
  for (const num of Object.keys(byNum)) { addRef(byNum[num].a?.label); addRef(byNum[num].b?.label); }

  // 4) 슬롯 팀 해석: short 있으면 그대로, 라벨이면 이전 결과(resolved)에서
  const resolved = {};
  const resolveShort = (slot) => {
    if (slot?.short) return slot.short;
    const lbl = slot?.label || '';
    const m = lbl.match(/^M(\d+)\s*(승자|패자)$/);
    if (m) { const r = resolved[m[1]]; return r ? (m[2] === '승자' ? r.winner : r.loser) : null; }
    if (lbl === '하위조 진출팀') { const r = resolved['5']; return r ? r.winner : null; }
    return null;
  };

  // 5) 의존성 순서대로 결과·플래그 기입
  const snap = (sl) => JSON.stringify([sl.short, sl.score, !!sl.win, !!sl.elim, !!sl.msi]);
  // 미진행 경기 슬롯: 확정된 팀(시드)만 채우고 점수·플래그는 비운다.
  // → 다음 대진이 "M3 패자" 대신 실제 팀으로 표시되고, 승부예측 %도 산출된다.
  const seedSlot = (slot, short) => {
    if (!short) return;
    const before = snap(slot);
    slot.short = short;
    delete slot.score; delete slot.win; delete slot.elim; delete slot.msi;
    if (snap(slot) !== before) changed = true;
  };

  let changed = false;
  for (const num of ['1', '2', '3', '4', '5', 'F']) {
    const mt = byNum[num];
    if (!mt) continue;
    const ta = resolveShort(mt.a), tb = resolveShort(mt.b);
    const res = ta && tb ? findResult(ta, tb, dateOf(mt.title)) : null;
    if (!res) {
      // 아직 안 끝난(또는 한쪽만 확정된) 경기 → 확정된 팀만 시드로 채움
      seedSlot(mt.a, ta);
      seedSlot(mt.b, tb);
      continue;
    }
    resolved[num] = { winner: res.winner, loser: res.loser };
    const flagNum = num === 'F' ? null : num; // 최종전 승자는 항상 진출(msi)
    const apply = (slot, short) => {
      const before = snap(slot);
      slot.short = short;
      slot.score = res.score[short];
      delete slot.win; delete slot.elim; delete slot.msi;
      if (short === res.winner) {
        if (flagNum && referenced.has(`${flagNum}#1`)) slot.win = true; else slot.msi = true;
      } else if (!(flagNum && referenced.has(`${flagNum}#2`))) {
        slot.elim = true;
      }
      if (snap(slot) !== before) changed = true;
    };
    apply(mt.a, ta);
    apply(mt.b, tb);
  }
  return changed;
}

// MSI 브래킷 스테이지(8팀 더블 엘리미네이션) 대진·결과 자동 반영.
//   라운드1(M1~M4)은 스케줄의 확정 대진을 날짜순으로 배정하고, 이후 라운드는 라벨
//   의존관계(M# 승자/패자)로 해석한다. 완료 경기는 점수·플래그, 미진행은 팀만 채운다.
async function fillMsiBracketResults(prevMsi) {
  const stage = prevMsi['브래킷 스테이지'];
  const sections = stage?.bracket?.sections;
  if (!sections) return false;

  const seedByShort = {};
  for (const q of stage.qualifiers || []) if (q.short && q.seed) seedByShort[q.short] = q.seed;

  // 1) 스케줄에서 브래킷(토너먼트)·결승 경기 수집 — 팀이 배정된 경기만, 시간순
  const sched = [];
  let token = null;
  for (let guard = 0; guard < 8; guard++) {
    const params = { leagueId: MSI_LEAGUE_ID };
    if (token) params.pageToken = token;
    const { data: d } = await api('getSchedule', params);
    for (const e of d.schedule.events || []) {
      if (e.type !== 'match' || !e.startTime || e.startTime < '2026-07-01') continue;
      const blk = e.blockName || '';
      if (/플레이|play/i.test(blk)) continue;                 // 플레이-인 제외
      if (!/토너먼트|bracket|결승|final/i.test(blk)) continue; // 브래킷·결승만
      const teams = e.match?.teams || [];
      if (teams.length !== 2) continue;
      const [x, y] = teams;
      if (!x.code || !y.code || x.code === 'TBD' || y.code === 'TBD') continue;
      sched.push({
        date: e.startTime.slice(0, 10),
        startTime: e.startTime,
        a: x.code, b: y.code,
        completed: e.state === 'completed',
        score: { [x.code]: x.result?.gameWins ?? 0, [y.code]: y.result?.gameWins ?? 0 },
        winner: teams.find((t) => t.result?.outcome === 'win')?.code || null,
        loser: teams.find((t) => t.result?.outcome === 'loss')?.code || null,
      });
    }
    token = d.schedule.pages?.older;
    if (!token) break;
  }
  sched.sort((p, q) => (p.startTime < q.startTime ? -1 : 1));

  const dateOf = (title) => {
    const m = (title || '').match(/\((\d{1,2})\/(\d{1,2})/); // 시간 접미사(HH:MM) 허용
    return m ? `2026-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
  };

  // 2) 매치 수집: "Match N" / "Grand Finals"(결승)→'GF'
  const byNum = {};
  for (const sec of sections)
    for (const r of sec.rounds || [])
      for (const m of r.matches || []) {
        const mm = (m.title || '').match(/Match\s*(\d+)/);
        const key = mm ? mm[1] : (/Grand\s*Finals|결승/i.test(m.title || '') ? 'GF' : null);
        if (key) byNum[key] = m;
      }

  // 3) 라벨 참조 집합(승자#1/패자#2가 이후 경기에 쓰이는지)
  const referenced = new Set();
  const addRef = (lbl) => { const m = (lbl || '').match(/^M(\d+)\s*(승자|패자)$/); if (m) referenced.add(`${m[1]}#${m[2] === '승자' ? 1 : 2}`); };
  for (const k of Object.keys(byNum)) { addRef(byNum[k].a?.label); addRef(byNum[k].b?.label); }

  const isSeedPlaceholder = (sl) => !sl.short && !/^M\d+\s*(승자|패자)$/.test(sl.label || '');
  const resolved = {};
  const resolveShort = (slot) => {
    if (slot?.short) return slot.short;
    const m = (slot?.label || '').match(/^M(\d+)\s*(승자|패자)$/);
    if (m) { const r = resolved[m[1]]; return r ? (m[2] === '승자' ? r.winner : r.loser) : null; }
    return null;
  };

  const snap = (sl) => JSON.stringify([sl.short, sl.score, !!sl.win, !!sl.elim, !!sl.msi, sl.seed]);
  const usedSched = new Set();
  let changed = false;

  // 4) 숫자 오름차순(M1..M13) → 결승(GF) 순으로 처리 (의존관계 만족)
  const order = Object.keys(byNum).filter((k) => k !== 'GF').sort((a, b) => +a - +b).concat(byNum.GF ? ['GF'] : []);
  for (const num of order) {
    const mt = byNum[num];
    const date = dateOf(mt.title);
    let ta, tb, s = null;
    if (isSeedPlaceholder(mt.a) && isSeedPlaceholder(mt.b)) {
      // 라운드1: 스케줄 확정 대진을 날짜로 배정
      s = sched.find((x) => !usedSched.has(x) && x.date === date);
      if (!s) continue;
      ta = s.a; tb = s.b;
    } else {
      ta = resolveShort(mt.a); tb = resolveShort(mt.b);
      if (!ta || !tb) continue;
      s = sched.find((x) => !usedSched.has(x) && x.date === date && ((x.a === ta && x.b === tb) || (x.a === tb && x.b === ta)))
       || sched.find((x) => !usedSched.has(x) && ((x.a === ta && x.b === tb) || (x.a === tb && x.b === ta)));
    }
    if (s) usedSched.add(s);
    const flagNum = num === 'GF' ? null : num;
    const setSlot = (slot, short) => {
      const before = snap(slot);
      slot.short = short;
      if (seedByShort[short]) slot.seed = seedByShort[short];
      else if (slot.seed && /\?\?\?/.test(slot.seed)) delete slot.seed; // "??? #1" 플레이스홀더 제거
      if (s && s.completed && s.winner) {
        slot.score = s.score[short];
        delete slot.win; delete slot.elim; delete slot.msi;
        if (short === s.winner) { if (flagNum && referenced.has(`${flagNum}#1`)) slot.win = true; else slot.msi = true; }
        else if (!(flagNum && referenced.has(`${flagNum}#2`))) slot.elim = true;
      } else {
        delete slot.score; delete slot.win; delete slot.elim; delete slot.msi;
      }
      if (snap(slot) !== before) changed = true;
    };
    setSlot(mt.a, ta);
    setSlot(mt.b, tb);
    if (s && s.completed && s.winner) resolved[num] = { winner: s.winner, loser: s.loser };
  }
  return changed;
}

try {
  const prevMsi = data.standings.msi || {};
  let anyChanged = false;

  for (const stageKey of ['플레이-인 스테이지', '브래킷 스테이지']) {
    const prevStage = prevMsi[stageKey];
    if (!prevStage?.qualifiers) continue;

    for (let i = 0; i < prevStage.qualifiers.length; i++) {
      const q = prevStage.qualifiers[i];
      if (q.short || !q.label) continue;

      // "리그 · TEAM1 vs TEAM2 승자/패자" 패턴 → 스케줄 직접 조회
      const parsed = parseMsiLabel(q.label);
      if (!parsed) continue;
      const leagueId = LABEL_TO_LEAGUE[parsed.lgKey];
      if (!leagueId) continue;

      if (!parsed.team1) {
        // 괄호형: 선행 경기(parenTeam1 vs parenTeam2) 결과로 team1 확정 후 최종 경기 조회
        if (!parsed.parenTeam1) continue;
        const preResult = await findMatchResult(leagueId, parsed.parenTeam1, parsed.parenTeam2, q.after);
        if (!preResult) continue; // 선행 경기 미완료
        const resolvedTeam1 = parsed.parenWant === '승자' ? preResult.winner : preResult.loser;
        if (!resolvedTeam1) continue;
        const result = await findMatchResult(leagueId, resolvedTeam1, parsed.team2, q.after);
        if (!result) continue;
        const code = parsed.want === '승자' ? result.winner : result.loser;
        if (code) { prevStage.qualifiers[i] = { short: code }; anyChanged = true; }
        continue;
      }
      const result = await findMatchResult(leagueId, parsed.team1, parsed.team2, q.after);
      if (!result) continue;

      const code = parsed.want === '승자' ? result.winner : result.loser;
      if (code) { prevStage.qualifiers[i] = { short: code }; anyChanged = true; }
    }
  }

  if (anyChanged) {
    data.standings.msi = prevMsi;
    for (const stageKey of ['플레이-인 스테이지', '브래킷 스테이지']) {
      const confirmed = (prevMsi[stageKey]?.qualifiers || [])
        .filter((q) => q.short).map((q) => q.short).join(', ');
      if (confirmed) console.log(`MSI ${stageKey}: ${confirmed}`);
    }
  }
} catch (e) {
  console.warn(`MSI 진출팀 갱신 실패 — 기존 값 유지: ${e.message}`);
}

// 2단계: MSI API 직접 조회 (대회 시작 후 순위표가 생기면 반영)
try {
  const prevMsi = data.standings.msi || {};
  const msiQual = await buildMsiQualifiers(prevMsi);
  if (msiQual) {
    for (const [stageKey, qualifiers] of Object.entries(msiQual)) {
      if (prevMsi[stageKey]) prevMsi[stageKey] = { ...prevMsi[stageKey], qualifiers };
    }
    data.standings.msi = prevMsi;
  }
} catch (e) {
  console.warn(`MSI API 갱신 실패 — 기존 값 유지: ${e.message}`);
}

// MSI 브래킷 매치 제목의 "(M/D)"에 경기 시각(KST)을 붙여 "(M/D HH:MM)"로 표기.
//   팀이 확정된 경기는 팀+날짜로, 미확정 경기는 날짜+순서로 스케줄과 매칭한다.
async function applyMsiScheduleTimes(prevMsi) {
  // 모든 MSI 경기(플레이-인·브래킷·결승) 수집 — TBD 포함, startTime 기준 정렬
  const games = [];
  const seen = new Set();
  let token = null;
  for (let guard = 0; guard < 8; guard++) {
    const params = { leagueId: MSI_LEAGUE_ID };
    if (token) params.pageToken = token;
    const { data: d } = await api('getSchedule', params);
    for (const e of d.schedule.events || []) {
      if (e.type !== 'match' || !e.startTime || e.startTime < '2026-01-01') continue;
      const teams = (e.match?.teams || []).map((t) => t.code).filter((c) => c && c !== 'TBD');
      const key = `${e.startTime}|${teams.slice().sort().join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      games.push({ startTime: e.startTime, teams });
    }
    token = d.schedule.pages?.older;
    if (!token) break;
  }
  games.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));

  // UTC ISO → KST "M/D HH:MM"
  const kst = (iso) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const mdOf = (iso) => { const k = kst(iso); return `${k.getUTCMonth() + 1}/${k.getUTCDate()}`; };
  const labelOf = (iso) => {
    const k = kst(iso);
    return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
  };

  const used = new Set();
  let changed = false;
  const assign = (m) => {
    const md = (m.title || '').match(/\((\d{1,2}\/\d{1,2})[^)]*\)/);
    if (!md) return;
    const wantMD = md[1];
    const shorts = [m.a?.short, m.b?.short].filter(Boolean);
    // 팀 확정 시 팀+날짜 우선, 아니면 날짜순으로 매칭
    let g = shorts.length === 2
      ? games.find((x) => !used.has(x) && x.teams.length === 2 && x.teams.includes(shorts[0]) && x.teams.includes(shorts[1]) && mdOf(x.startTime) === wantMD)
      : null;
    if (!g) g = games.find((x) => !used.has(x) && mdOf(x.startTime) === wantMD);
    if (!g) return;
    used.add(g);
    const nt = (m.title || '').replace(/\(\d{1,2}\/\d{1,2}[^)]*\)/, `(${labelOf(g.startTime)})`);
    if (nt !== m.title) { m.title = nt; changed = true; }
  };

  for (const stageKey of ['플레이-인 스테이지', '브래킷 스테이지']) {
    const secs = prevMsi[stageKey]?.bracket?.sections;
    if (!secs) continue;
    for (const sec of secs)
      for (const r of sec.rounds || [])
        for (const m of r.matches || []) assign(m);
  }
  return changed;
}

// 플레이-인 생존팀(최종 진출전 승자)을 브래킷 스테이지 참가팀 목록의 "생존팀" 슬롯에 반영.
// 시드는 생존팀의 플레이-인 시드(예: LCK #2)를 그대로 표기한다.
function fillMsiSurvivorQualifier(prevMsi) {
  const pi = prevMsi['플레이-인 스테이지'];
  const br = prevMsi['브래킷 스테이지'];
  if (!pi?.bracket?.sections || !br?.qualifiers) return false;
  let survivor = null;
  for (const sec of pi.bracket.sections)
    for (const r of sec.rounds || [])
      for (const m of r.matches || [])
        if (/최종\s*진출전/.test(m.title || '')) {
          if (m.a?.msi && m.a?.short) survivor = m.a.short;
          if (m.b?.msi && m.b?.short) survivor = m.b.short;
        }
  if (!survivor) return false;
  const piSeed = (pi.qualifiers || []).find((q) => q.short === survivor)?.seed || '플레이-인';
  // 아직 라벨 상태이거나 이미 생존팀으로 채워진 슬롯 모두 대상
  const slot = br.qualifiers.find((q) => q.short === survivor || (!q.short && /생존팀/.test(q.label || '')));
  if (!slot) return false;
  let changed = false;
  if (slot.label) { delete slot.label; changed = true; }
  if (slot.short !== survivor) { slot.short = survivor; changed = true; }
  if (slot.seed !== piSeed) { slot.seed = piSeed; changed = true; }
  return changed;
}

// 3단계: MSI 플레이-인 + 브래킷 스테이지 대진·결과(점수·승패) 자동 반영
try {
  const prevMsi = data.standings.msi || {};
  const piChanged = await fillMsiPlayinResults(prevMsi);
  // 생존팀 시드를 먼저 확정해야 브래킷 대진 슬롯에도 같은 시드(LCK #2 등)가 반영된다
  const survChanged = fillMsiSurvivorQualifier(prevMsi);
  const brChanged = await fillMsiBracketResults(prevMsi);
  const timeChanged = await applyMsiScheduleTimes(prevMsi);
  const changed = piChanged || brChanged || survChanged || timeChanged;
  if (changed) {
    data.standings.msi = prevMsi;
    console.log(`MSI 브래킷 갱신됨 (플레이-인 ${piChanged ? 'O' : 'X'} / 브래킷 스테이지 ${brChanged ? 'O' : 'X'})`);
  } else {
    console.log('MSI 브래킷 결과 변경 없음');
  }
} catch (e) {
  console.warn(`MSI 브래킷 결과 갱신 실패 — 기존 값 유지: ${e.message}`);
}

// 4단계: LCP 2026 Split 3 — 스위스/플레이-인/플레이오프 3단계 대진을 API에서 가져와 저장
try {
  const LCP_S3_TOURNAMENT = '115570728597462574';
  const j = await api('getStandingsV3', { tournamentId: LCP_S3_TOURNAMENT });
  const st = j.data?.standings?.[0];
  if (st?.stages) {
    const bySlug = {};
    for (const s of st.stages) {
      const cols = s.sections?.[0]?.columns || [];
      bySlug[s.slug] = bracketFromColumns(cols);
    }
    // 스위스: 위치별 승패 기록(대진)을 표기(TBD 경기 포함)하고, 누적 결과로 색 부여.
    //   승자 파랑(win), 패자는 실제 3패 탈락일 때만 빨강(elim). 그 전엔 색 없음.
    //   기록 라벨은 8팀 first-to-3 스위스 표준 구조(라운드별 4·4·4·3·1경기) 기준.
    const SWISS_RECORDS = [
      ['0-0', '0-0', '0-0', '0-0'],
      ['1-0', '1-0', '0-1', '0-1'],
      ['2-0', '1-1', '1-1', '0-2'],
      ['2-1', '2-1', '1-2'],
      ['2-2'],
    ];
    const recLabel = (rec) => { const [w, l] = rec.split('-'); return `${w}승 ${l}패`; };
    const swiss = bySlug['swiss'];
    if (swiss) {
      const wl = {}; // short → {w,l} 누적
      swiss.rounds.forEach((round, ri) => {
        round.title = `${ri + 1}라운드`;
        round.matches.forEach((m, mi) => {
          // 대진 기록 라벨: 위치별 표준 기록(있으면), 없으면 알려진 팀의 실제 기록
          const structRec = SWISS_RECORDS[ri]?.[mi];
          if (structRec) m.title = recLabel(structRec);
          else { const s = m.a?.short || m.b?.short; const r = (s && wl[s]) || { w: 0, l: 0 }; m.title = s ? `${r.w}승 ${r.l}패` : ''; }
          m.recordKey = structRec || ''; // 같은 기록 그룹 판별용
          // 결과 반영 + 플래그
          delete m.a?.msi; delete m.a?.elim; delete m.b?.msi; delete m.b?.elim;
          if (m.a?.short && m.b?.short && m.a.score != null && m.b.score != null && m.a.score !== m.b.score) {
            const aWin = m.a.score > m.b.score;
            const winner = aWin ? m.a : m.b, loser = aWin ? m.b : m.a;
            wl[winner.short] = wl[winner.short] || { w: 0, l: 0 };
            wl[loser.short] = wl[loser.short] || { w: 0, l: 0 };
            wl[winner.short].w++; wl[loser.short].l++;
            winner.win = true;
            if (wl[loser.short].l >= 3) loser.elim = true; // 3패 = 실제 탈락
          }
        });
      });
    }
    // LCP 플레이오프: 4팀 더블 엘리미네이션 표준 레이아웃.
    const lcpPlayoffs = apply4TeamDELayout(bySlug['playoffs']);
    data.standings.lcp = data.standings.lcp || {};
    data.standings.lcp['Split 3'] = {
      stage: '2026 LCP Split 3 · 스위스 → 플레이-인 → 플레이오프',
      rows: [],
      swiss: swiss || null,
      playin: bySlug['play_ins'] || null,
      playoffs: lcpPlayoffs || null,
    };
    const cnt = (b) => b ? b.rounds.reduce((n, r) => n + r.matches.length, 0) : 0;
    console.log(`LCP Split 3 대진 갱신 (스위스 ${cnt(swiss)}경기 / 플레이-인 ${cnt(bySlug['play_ins'])} / 플레이오프 ${cnt(bySlug['playoffs'])})`);
  }
} catch (e) {
  console.warn(`LCP Split 3 대진 갱신 실패 — 기존 값 유지: ${e.message}`);
}

// 4-2단계: 2026 Worlds — 플레이-인 · 스위스 · 녹아웃 3단계를 lolesports API에서 fetch.
//   대진이 확정되면 API에 데이터가 뜨므로 별도 리포지토리 없이 자동 갱신.
try {
  const WORLDS_2026_TOURNAMENT = '115660540725177488';
  const j = await api('getStandingsV3', { tournamentId: WORLDS_2026_TOURNAMENT });
  const st = j.data?.standings?.[0];
  if (st?.stages) {
    const bySlug = {};
    for (const s of st.stages) {
      const cols = s.sections?.[0]?.columns || [];
      bySlug[s.slug] = bracketFromColumns(cols);
    }
    // 스위스 스테이지: 16팀 first-to-3 (라운드별 8·8·8·6·2경기).
    // 16팀 first-to-3 실제 매치 분포:
    //   R1 0-0×8 / R2 1-0×4·0-1×4 / R3 2-0×2·1-1×4·0-2×2 / R4 2-1×3·1-2×3 / R5 2-2×3
    const SWISS_RECORDS_16 = [
      ['0-0','0-0','0-0','0-0','0-0','0-0','0-0','0-0'],
      ['1-0','1-0','1-0','1-0','0-1','0-1','0-1','0-1'],
      ['2-0','2-0','1-1','1-1','1-1','1-1','0-2','0-2'],
      ['2-1','2-1','2-1','1-2','1-2','1-2'],
      ['2-2','2-2','2-2'],
    ];
    const recLabel = (r) => { const [w, l] = r.split('-'); return `${w}승 ${l}패`; };
    const swiss = bySlug['swiss'];
    if (swiss) {
      const wl = {};
      swiss.rounds.forEach((round, ri) => {
        round.title = `${ri + 1}라운드`;
        round.matches.forEach((m, mi) => {
          const structRec = SWISS_RECORDS_16[ri]?.[mi];
          if (structRec) m.title = recLabel(structRec);
          else { const s = m.a?.short || m.b?.short; const r = (s && wl[s]) || { w: 0, l: 0 }; m.title = s ? `${r.w}승 ${r.l}패` : ''; }
          m.recordKey = structRec || '';
          delete m.a?.msi; delete m.a?.elim; delete m.b?.msi; delete m.b?.elim;
          if (m.a?.short && m.b?.short && m.a.score != null && m.b.score != null && m.a.score !== m.b.score) {
            const aWin = m.a.score > m.b.score;
            const winner = aWin ? m.a : m.b, loser = aWin ? m.b : m.a;
            wl[winner.short] = wl[winner.short] || { w: 0, l: 0 };
            wl[loser.short] = wl[loser.short] || { w: 0, l: 0 };
            wl[winner.short].w++; wl[loser.short].l++;
            winner.win = true;
            if (wl[loser.short].l >= 3) loser.elim = true;
          }
        });
      });
    }
    // Worlds 참가팀 시드 라벨 (LCK 4 + LPL 4 + LEC 3 + LCS 3 + LCP 3 + CBLOL 2 = 19팀).
    //   플레이-인 4팀: LPL#4, LCS#3, LEC#3, LCP#3. 나머지 15팀은 스위스 직행.
    //   각 리그 최종 순위에서 자동 채움. LPL은 대회별 세부 규칙 반영, LCP는 대회 규정으로 하드코딩.
    const SUB_PRIORITY = {
      lck: ['LCK'], lpl: ['Split 3'],
      lec: ['Summer', 'Spring'], lcs: ['Summer', 'Spring'],
      lcp: ['Split 3', 'Split 2'], cblol: ['Split 2', 'Split 1'],
    };
    const rowsFor = (k) => { const lg = data.standings[k]; if (!lg) return []; for (const sub of SUB_PRIORITY[k] || []) if (lg[sub]?.rows?.length) return lg[sub].rows; return []; };
    const teamAtRank = (rows, rank) => rows.find((r) => r.rank === rank)?.team;
    const winnerOf = (m) => {
      if (!m) return null;
      if (m.a?.win || m.a?.msi) return m.a.short;
      if (m.b?.win || m.b?.msi) return m.b.short;
      if (m.a?.score != null && m.b?.score != null && m.a.score !== m.b.score) return m.a.score > m.b.score ? m.a.short : m.b.short;
      return null;
    };
    // LCK 최종 순위(플레이오프 결과) → Worlds #1~#4 시드.
    //   #1 = GF 승자, #2 = GF 패자, #3 = Lower Finals 패자, #4 = LB R3 패자.
    const lckPO = data.standings.lck?.LCK?.playoffs;
    const loserOf = (m) => {
      const w = winnerOf(m); if (!w) return null;
      return m.a?.short === w ? m.b?.short : m.a?.short;
    };
    const lckGF = lckPO?.rounds?.[6]?.matches?.[0];
    const lckLF = lckPO?.rounds?.[5]?.matches?.[0];
    const lckLB3 = lckPO?.rounds?.[3]?.matches?.[0];
    const lck1 = winnerOf(lckGF), lck2 = loserOf(lckGF), lck3 = loserOf(lckLF), lck4 = loserOf(lckLB3);
    // LPL 세부 시드 규칙
    const lplPO = data.standings.lpl?.['Split 3']?.playoffs;
    const lplGF = lplPO?.rounds?.[4]?.matches?.[0]; // MATCH 12 = GF
    const lpl1 = winnerOf(lplGF); // Split 3 우승 = LPL #1
    const lplPtsW = data.standings.lpl?.['대표 선발전']?.points || [];
    const lpl2 = lpl1 ? (lplPtsW.find((p) => p.team !== lpl1)?.team || null) : null; // 챔피언십 포인트 1위 (우승팀 제외)
    const lplRQ2 = data.standings.lpl?.['대표 선발전']?.qualifier;
    const lpl3 = winnerOf(lplRQ2?.rounds?.[0]?.matches?.[0]); // 대표 선발전 1R M1 승자 = LPL #3
    const lpl4 = winnerOf(lplRQ2?.rounds?.[1]?.matches?.[0]); // 대표 선발전 2R 승자 = LPL #4
    const seedMap = {
      'LCK #1': lck1, 'LCK #2': lck2, 'LCK #3': lck3, 'LCK #4': lck4,
      'LPL #1': lpl1, 'LPL #2': lpl2, 'LPL #3': lpl3, 'LPL #4': lpl4,
      // LEC/LCS/CBLOL 시드는 사용자가 직접 제공 (대회별 배정 규칙 상이).
      'LEC #1': null, 'LEC #2': null, 'LEC #3': null,
      'LCS #1': null, 'LCS #2': null, 'LCS #3': null,
      // LCP 시드는 대회 규정으로 확정.
      'LCP #1': 'TSW', 'LCP #2': 'CFO', 'LCP #3': 'MVK',
      'CBLOL #1': null, 'CBLOL #2': null,
    };
    // 참가팀 순서: 스위스 직행 15팀 → 플레이-인 4팀. UI에서 두 그룹으로 나눠 표기.
    const swissSeeds = ['LCK #1','LCK #2','LCK #3','LCK #4','LPL #1','LPL #2','LPL #3','LPL #4','LEC #1','LEC #2','LCS #1','LCS #2','LCP #1','LCP #2','CBLOL #1'];
    const playinSeeds = ['LCS #3','LEC #3','LCP #3','CBLOL #2'];
    const buildQ = (seeds, stage) => seeds.map((seed) => {
      const team = seedMap[seed];
      return team ? { seed, short: team, stage } : { seed, label: seed, stage };
    });
    const qualifiers = [...buildQ(swissSeeds, 'swiss'), ...buildQ(playinSeeds, 'playin')];
    data.standings.worlds = {
      stage: '2026 Worlds · 플레이-인 → 스위스 → 녹아웃',
      qualifiers,
      playin: apply4TeamDELayout(bySlug['play_ins']),
      swiss: swiss || null,
      knockout: applySingleElimLayout(bySlug['knockouts']),
    };
    const cnt = (b) => b ? b.rounds.reduce((n, r) => n + r.matches.length, 0) : 0;
    console.log(`Worlds 대진 갱신 (플레이-인 ${cnt(bySlug['play_ins'])}경기 / 스위스 ${cnt(swiss)}경기 / 녹아웃 ${cnt(bySlug['knockouts'])}경기 · 참가팀 자동 ${qualifiers.filter((q) => q.short).length}/${qualifiers.length}팀)`);
  }
} catch (e) {
  console.warn(`Worlds 대진 갱신 실패 — 기존 값 유지: ${e.message}`);
}

// 5단계: LCK 플레이-인 · 지역별 챔피언십(플레이오프) 대진을 API에서 가져와 저장.
//   MSI/LCP와 동일하게 bracketFromColumns 로 연결선을 만들고, 첫 라운드 시드 라벨은
//   LCK 포맷(레전드/라이즈 그룹 순위)에 맞춰 주입한다(API는 시드 확정 전까지 라벨을 안 줌).
try {
  const LCK_S3_TOURNAMENT = '115548147890329817';
  const j = await api('getStandingsV3', { tournamentId: LCK_S3_TOURNAMENT });
  const st = j.data?.standings?.[0];
  if (st?.stages) {
    const bySlug = {};
    for (const s of st.stages) {
      if (s.slug !== 'play_ins' && s.slug !== 'regional_championship') continue;
      const cols = s.sections?.[0]?.columns || [];
      bySlug[s.slug] = bracketFromColumns(cols);
    }
    // 경기 시간: LCK 일정에서 match id → 시작시각을 모아 각 대진 매치에 KST 라벨(m.time)로 붙인다.
    // API 시간이 실제와 다른 날짜는 KST 시:분을 보정한다(예: 결승/로어파이널 = 14:00, API는 17:00 오기입).
    const TIME_OVERRIDE_KST = { '2026-09-12': '14:00', '2026-09-13': '14:00' };
    const kstLabel = (iso) => {
      const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
      const dow = ['일', '월', '화', '수', '목', '금', '토'][k.getUTCDay()];
      const ymd = `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}-${String(k.getUTCDate()).padStart(2, '0')}`;
      const hm = TIME_OVERRIDE_KST[ymd] || `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
      return `${k.getUTCMonth() + 1}/${k.getUTCDate()} (${dow}) ${hm}`;
    };
    const timeById = {};
    try {
      let token = null;
      for (let g = 0; g < 8; g++) {
        const params = { leagueId: '98767991310872058' };
        if (token) params.pageToken = token;
        const { data: sd } = await api('getSchedule', params);
        for (const e of sd.schedule.events || []) {
          if (e.type === 'match' && e.match?.id && e.startTime) timeById[e.match.id] = e.startTime;
        }
        token = sd.schedule.pages?.newer;
        if (!token) break;
      }
    } catch (e) { console.warn(`LCK 일정 시간 조회 실패: ${e.message}`); }
    for (const key of ['play_ins', 'regional_championship']) {
      const b = bySlug[key];
      if (!b) continue;
      for (const r of b.rounds) for (const m of r.matches) if (m.id && timeById[m.id]) m.time = kstLabel(timeById[m.id]);
    }
    // 빈 시드 슬롯에만 라벨 주입 (팀 확정 시 API 라벨/코드 우선)
    const setSeed = (slot, label) => { if (slot && !slot.seed && !slot.short) slot.seed = label; };
    // 플레이-인: 1라운드(레전드5 vs 라이즈1)·2라운드(라이즈2 vs 라이즈3)·파이널 라운드를
    //   각각 별도 컬럼(x)으로 분리한다. (API는 1·2경기를 같은 컬럼에 둔다)
    let playin = bySlug['play_ins'];
    if (playin?.rounds?.length >= 2 && playin.rounds[0].matches.length >= 2) {
      const [m1, m2] = playin.rounds[0].matches;    // 1라운드·2라운드 경기
      const fin = playin.rounds[1].matches[0];       // 파이널 라운드 경기
      // 팀별 정규시즌 그룹·순위로 시드 라벨/랭크 조회, 시드 상위가 상단(a)에 오도록 정렬.
      const lckRows = data.standings.lck?.LCK?.rows || [];
      const rowByShort = {};
      lckRows.forEach((r) => { rowByShort[r.team] = r; });
      const teamSeed = (short) => {
        const r = rowByShort[short];
        if (!r?.group) return null;
        const isLegend = /레전드|Legend/.test(r.group), isRise = /라이즈|Rise/.test(r.group);
        if (!isLegend && !isRise) return null;
        return { label: (isLegend ? '레전드' : '라이즈') + ' ' + r.rank + '위', rank: (isLegend ? 0 : 5) + r.rank };
      };
      const orderByTeamSeed = (m, defaultSeedA, defaultSeedB) => {
        if (m?.a?.short && m?.b?.short) {
          let sa = teamSeed(m.a.short), sb = teamSeed(m.b.short);
          if (sa && sb && sa.rank > sb.rank) { const t = m.a; m.a = m.b; m.b = t; [sa, sb] = [sb, sa]; }
          if (sa) m.a.seed = sa.label; if (sb) m.b.seed = sb.label;
        } else {
          setSeed(m.a, defaultSeedA); setSeed(m.b, defaultSeedB);
        }
      };
      orderByTeamSeed(m1, '레전드 5위', '라이즈 1위'); m1.title = '1라운드';
      orderByTeamSeed(m2, '라이즈 2위', '라이즈 3위'); m2.title = '2라운드';
      if (fin) {
        fin.title = '파이널 라운드';
        // API 원본은 a=2R 승자, b=1R 패자 순서로 준다. 이미지 형식(a=1R 패자, b=2R 승자)로 스왑.
        const oldA = fin.a, oldB = fin.b;
        if (oldA && oldB) { fin.a = { ...oldB, seed: '1라운드 패자' }; fin.b = { ...oldA, seed: '2라운드 승자' }; }
        else { if (fin.a) fin.a.seed = '1라운드 패자'; if (fin.b) fin.b.seed = '2라운드 승자'; }
      }
      // 세로 배치(공식 대진표 형식): 1라운드=상단, 2라운드=하단, 파이널=중앙.
      //   그리드(totalRows) 기준 startRow로 y를 고정한다(매치=2행).
      playin = {
        totalRows: 6,
        rounds: [
          { title: '', matches: [{ ...m1, startRow: 0 }] },                    // col0: 1라운드(상단)
          { title: '', matches: [{ ...m2, startRow: 4 }] },                    // col1: 2라운드(하단)
          ...(fin ? [{ title: '', matches: [{ ...fin, startRow: 2 }] }] : []), // col2: 파이널(중앙)
        ],
        // 1라운드 패자 → 파이널 a, 2라운드 승자 → 파이널 b
        connectors: fin ? [[0, 0, 'mid', 2, 0, 'a'], [1, 0, 'mid', 2, 0, 'b']] : [],
      };
    }
    // 플레이오프(지역별 챔피언십): 공식 대진표 형식(UPPER 상단 / LOWER 하단 / 결승 우측 중앙)으로
    //   재구성한다. API 원본 구조(라운드별)에서 10경기를 꺼내 5개 컬럼 + 그리드 startRow로 배치하고,
    //   조건 라벨과 매치 제목(UB R1 M1 등)을 이미지에 맞춰 붙인다. (팀/결과는 API 값 유지)
    let playoffs = bySlug['regional_championship'];
    if (playoffs?.rounds?.length >= 7) {
      const P = playoffs.rounds;
      const ubR1M1 = P[0].matches[0], ubR1M2 = P[0].matches[1];
      const ubR2M1 = P[1].matches[0], ubR2M2 = P[1].matches[1], lbR1 = P[1].matches[2];
      const lbR2 = P[2].matches[0], lbR3 = P[3].matches[0], ubR3 = P[4].matches[0];
      const lowerFinals = P[5].matches[0], grandFinals = P[6].matches[0];
      // 조건/시드 라벨 — API 원본 슬롯 순서에 맞춰 부여.
      //   UB R1: API가 a=플레이-인 진출(미정), b=시드 팀 순서로 준다.
      //   UB R2: API가 a=시드 팀, b=UB R1 승자(미정) 순서.
      //   그 후 applySeedOrder가 시드 상위(레전드 시드)를 상단(a)으로 자동 스왑.
      const lab = (s, l) => { if (s) s.seed = l; };
      lab(ubR1M1.a, '플레이-인 진출'); lab(ubR1M1.b, '레전드 3위');
      lab(ubR1M2.a, '플레이-인 진출'); lab(ubR1M2.b, '레전드 4위');
      // API 원본 슬롯 순서:
      //   UB R2 M1 = slot1(레전드 시드 1) / slot2(UB R1 승자)
      //   UB R2 M2 = slot1(UB R1 승자) / slot2(레전드 시드 2)
      // 각 매치의 원본 슬롯 순서에 맞춰 라벨을 붙이고, applySeedOrder가 시드 상위(rank 있음)를
      // a로 자동 정렬한다.
      lab(ubR2M1.a, '레전드 1위'); lab(ubR2M1.b, 'UB R1 승자');
      lab(ubR2M2.a, 'UB R1 승자'); lab(ubR2M2.b, '레전드 2위');
      lab(lbR1.a, 'UB R1 패자'); lab(lbR1.b, 'UB R1 패자');
      lab(lbR2.a, 'UB R2 패자'); lab(lbR2.b, 'LB R1 승자');
      // LB R3: API가 slot1=LB R2 승자, slot2=UB R2 패자 순서로 반환. UI에서는 UB R2 패자를 상단에 두어야
      //   상위 시드 패자·LB R2 승자 순서가 자연스러워지므로 슬롯 스왑 후 라벨 부여.
      if (lbR3?.a && lbR3?.b) { const t = lbR3.a; lbR3.a = lbR3.b; lbR3.b = t; }
      lab(lbR3.a, 'UB R2 패자'); lab(lbR3.b, 'LB R2 승자');
      lab(ubR3.a, 'UB R2 승자'); lab(ubR3.b, 'UB R2 승자');
      lab(lowerFinals.a, 'UB R3 패자'); lab(lowerFinals.b, 'LB R3 승자');
      lab(grandFinals.a, 'UB R3 승자'); lab(grandFinals.b, '결승 진출전 승자');
      // 매치 제목
      ubR1M1.title = 'UB R1 M1'; ubR1M2.title = 'UB R1 M2';
      ubR2M1.title = 'UB R2 M1'; ubR2M2.title = 'UB R2 M2'; ubR3.title = 'UB R3';
      lbR1.title = 'LB R1'; lbR2.title = 'LB R2'; lbR3.title = 'LB R3';
      lowerFinals.title = 'Lower Finals'; grandFinals.title = 'Grand Finals';
      // 5개 컬럼 + startRow: UPPER=상단(0)/하단(4), UB R3=중앙(2), LOWER=최하단(8), 결승=우측 중앙(5)
      playoffs = {
        totalRows: 10,
        rounds: [
          { title: '', matches: [{ ...ubR1M1, startRow: 0 }, { ...ubR1M2, startRow: 4 }, { ...lbR1, startRow: 8 }] }, // col0
          { title: '', matches: [{ ...ubR2M1, startRow: 0 }, { ...ubR2M2, startRow: 4 }, { ...lbR2, startRow: 8 }] }, // col1
          { title: '', matches: [{ ...ubR3, startRow: 2 }, { ...lbR3, startRow: 8 }] },                               // col2
          { title: '', matches: [{ ...lowerFinals, startRow: 8 }] },                                                  // col3
          { title: '', matches: [{ ...grandFinals, startRow: 5 }] },                                                  // col4
        ],
        connectors: [
          [0, 0, 'mid', 1, 0, 'b'], [0, 1, 'mid', 1, 1, 'b'], // UB R1 승자 → UB R2
          [0, 2, 'mid', 1, 2, 'b'],                            // LB R1 승자 → LB R2
          [1, 2, 'mid', 2, 1, 'b'],                            // LB R2 승자 → LB R3
          [1, 0, 'mid', 2, 0, 'a'], [1, 1, 'mid', 2, 0, 'b'], // UB R2 승자 → UB R3
          [2, 0, 'mid', 3, 0, 'a'],                            // UB R3 패자 → Lower Finals
          [2, 1, 'mid', 3, 0, 'b'],                            // LB R3 승자 → Lower Finals
          [2, 0, 'mid', 4, 0, 'a'],                            // UB R3 승자 → Grand Finals
          [3, 0, 'mid', 4, 0, 'b'],                            // Lower Finals 승자 → Grand Finals
        ],
      };
    }
    data.standings.lck = data.standings.lck || {};
    applySeedOrder(playin); applySeedOrder(playoffs);
    normalizeAdvancementFlags(playin); normalizeAdvancementFlags(playoffs);
    data.standings.lck['LCK'] = { ...(data.standings.lck['LCK'] || {}), playin: playin || null, playoffs: playoffs || null };
    const cnt = (b) => (b ? b.rounds.reduce((n, r) => n + r.matches.length, 0) : 0);
    console.log(`LCK 대진 갱신 (플레이-인 ${cnt(playin)}경기 / 플레이오프 ${cnt(playoffs)}경기)`);
  }
} catch (e) {
  console.warn(`LCK 대진 갱신 실패 — 기존 값 유지: ${e.message}`);
}

// 6단계: LPL Split 3 — 기사의 길(Knights Rivals)·플레이오프 대진을 API에서 가져와 자동 갱신.
//   기존 수동 bracket(sections)을 대체하고, LCP/LCK와 동일하게 bracketFromColumns 로 생성한다.
try {
  const tj = await api('getTournamentsForLeague', { leagueId: '98767991314006698' });
  const tours = tj.data.leagues[0].tournaments || [];
  const tour = tours.find((t) => /split_3_2026/.test(t.slug)) || pickCurrentTournament(tours);
  if (!tour) throw new Error('LPL Split 3 토너먼트 없음');
  const sj = await api('getStandingsV3', { tournamentId: tour.id });
  const st = sj.data?.standings?.[0];
  if (st?.stages) {
    const byKind = {};
    for (const s of st.stages) {
      const cols = s.sections?.[0]?.columns || [];
      if (!cols.length) continue;
      if (/knights_rival/.test(s.slug)) byKind.knights = bracketFromColumns(cols);
      else if (s.slug === 'playoffs') byKind.playoffs = bracketFromColumns(cols);
      else if (s.slug === 'regional_qualifier') byKind.qualifier = bracketFromColumns(cols);
    }
    // 경기 시간(KST) 부착
    const kstLabel = (iso) => {
      const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
      const dow = ['일', '월', '화', '수', '목', '금', '토'][k.getUTCDay()];
      return `${k.getUTCMonth() + 1}/${k.getUTCDate()} (${dow}) ${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
    };
    const timeById = {};
    try {
      let token = null;
      for (let g = 0; g < 10; g++) {
        const params = { leagueId: '98767991314006698' };
        if (token) params.pageToken = token;
        const { data: sd } = await api('getSchedule', params);
        for (const e of sd.schedule.events || []) if (e.type === 'match' && e.match?.id && e.startTime) timeById[e.match.id] = e.startTime;
        token = sd.schedule.pages?.newer;
        if (!token) break;
      }
    } catch (e) { console.warn(`LPL 일정 시간 조회 실패: ${e.message}`); }
    // 기사의 길: 두 경기 제목 정리 + 시드 규칙에 맞춰 예상 팀 채움
    //   규칙: 1경기 = 등봉조 8위 vs 열반조 1위, 2경기 = 등봉조 7위 vs 열반조 2위
    if (byKind.knights) {
      byKind.knights.rounds.forEach((r) => r.matches.forEach((m, i) => { m.title = `기사의 길 ${i + 1}`; }));
      const lplRows = data.standings.lpl?.['Split 3']?.rows || rows;
      const asc = lplRows.filter((r) => /등봉/.test(r.group || '')).sort((a, b) => a.rank - b.rank);
      const nir = lplRows.filter((r) => /열반/.test(r.group || '')).sort((a, b) => a.rank - b.rank);
      const seedTeam = (list, rank) => list.find((r) => r.rank === rank);
      const setSeed = (slot, label, team) => {
        if (!slot || slot.short) return;
        slot.seed = label;
        if (team) slot.short = team.team;
      };
      const knMatches = byKind.knights.rounds.flatMap((r) => r.matches);
      if (knMatches[0]) { setSeed(knMatches[0].a, '등봉조 8위', seedTeam(asc, 8)); setSeed(knMatches[0].b, '열반조 1위', seedTeam(nir, 1)); }
      if (knMatches[1]) { setSeed(knMatches[1].a, '등봉조 7위', seedTeam(asc, 7)); setSeed(knMatches[1].b, '열반조 2위', seedTeam(nir, 2)); }
    }
    // 플레이오프: 이미지 배치(UPPER 상단 / LOWER 하단 / 결승 우측 중앙)로 그리드 재구성.
    //   실제 대회 진행 방식:
    //   - 상위권 8강 = 2경기만 진행 (등봉조 1·2위는 상위권 4강 직행)
    //   - 하위권 1R에는 기사의 길 생존 2팀 + 상위권 8강 패자 2팀이 들어감
    //   API 원본은 상위권 8강 4경기 · 여러 시드 slot origin을 주지만,
    //   이 규칙에 맞춰 매치·시드·연결선을 처음부터 재구성한다(팀·시간·id는 유지).
    if (byKind.playoffs) {
      const P = byKind.playoffs.rounds;
      // 원본 매치 재활용 — 8강은 앞 2경기만 사용, 나머지는 각 라운드에서 첫 매치 재활용
      const ub8_1 = P[0].matches[0], ub8_2 = P[0].matches[1];
      const ub4_1 = P[1].matches[0], ub4_2 = P[1].matches[1];
      const lb1_1 = P[1].matches[2], lb1_2 = P[1].matches[3];
      const ubFinal = P[2].matches[0];
      const lb8_1 = P[2].matches[1], lb8_2 = P[2].matches[2];
      const lb4 = P[3].matches[0], lbFinal = P[4].matches[0], grandFinal = P[5].matches[0];
      // 매치 제목 (공식 대진표와 동일하게 MATCH 1~12로 통일)
      if (ub8_1) ub8_1.title = 'MATCH 1'; if (ub8_2) ub8_2.title = 'MATCH 2';
      if (ub4_1) ub4_1.title = 'MATCH 3'; if (ub4_2) ub4_2.title = 'MATCH 4';
      if (lb1_1) lb1_1.title = 'MATCH 5'; if (lb1_2) lb1_2.title = 'MATCH 6';
      if (lb8_1) lb8_1.title = 'MATCH 7'; if (lb8_2) lb8_2.title = 'MATCH 8';
      if (ubFinal) ubFinal.title = 'MATCH 9';
      if (lb4) lb4.title = 'MATCH 10';
      if (lbFinal) lbFinal.title = 'MATCH 11';
      if (grandFinal) grandFinal.title = 'MATCH 12';
      // 시드/라벨 재설정 — 공식 대진표(이미지) 슬롯 순서에 맞게. 슬롯 a=이전 매치 승자/패자, b=시드 팀.
      //   MATCH 번호 매핑: ub8_1=M1, ub8_2=M2, ub4_1=M3, ub4_2=M4, lb1_1=M5, lb1_2=M6,
      //   lb8_1=M7, lb8_2=M8, ubFinal=M9, lb4=M10, lbFinal=M11, grandFinal=M12.
      const setLabel = (slot, label, teamShort) => {
        if (!slot) return;
        slot.seed = label;  // 라벨은 항상 덮어써서 화면 표기 정리
        if (!slot.short && teamShort) slot.short = teamShort;
      };
      const lplRows = data.standings.lpl?.['Split 3']?.rows || rows;
      const asc = lplRows.filter((r) => /등봉/.test(r.group || '')).sort((a, b) => a.rank - b.rank);
      const seedAt = (pos) => asc[pos - 1]?.team;
      // 상위권 8강: M1 = 3위 vs 6위, M2 = 4위 vs 5위
      if (ub8_1) { setLabel(ub8_1.a, '등봉조 3위', seedAt(3)); setLabel(ub8_1.b, '등봉조 6위', seedAt(6)); }
      if (ub8_2) { setLabel(ub8_2.a, '등봉조 4위', seedAt(4)); setLabel(ub8_2.b, '등봉조 5위', seedAt(5)); }
      // 상위권 4강: M3 = M1 승자 vs 등봉 2위, M4 = M2 승자 vs 등봉 1위
      if (ub4_1) { setLabel(ub4_1.a, 'M1 승자'); setLabel(ub4_1.b, '등봉조 2위', seedAt(2)); }
      if (ub4_2) { setLabel(ub4_2.a, 'M2 승자'); setLabel(ub4_2.b, '등봉조 1위', seedAt(1)); }
      // 하위권 1R: M5 = M1 패자 vs IG, M6 = M2 패자 vs NIP (이미지 배정 — API의 NIP/IG는 반대라 강제 스왑)
      if (lb1_1) {
        setLabel(lb1_1.a, 'M1 패자');
        setLabel(lb1_1.b, '기사의 길 1 승자');
        if (lb1_1.b.short === 'NIP') lb1_1.b.short = 'IG';
      }
      if (lb1_2) {
        setLabel(lb1_2.a, 'M2 패자');
        setLabel(lb1_2.b, '기사의 길 2 승자');
        if (lb1_2.b.short === 'IG') lb1_2.b.short = 'NIP';
      }
      // 하위권 8강: M7 = M5 승자 vs M4 패자, M8 = M6 승자 vs M3 패자
      if (lb8_1) { setLabel(lb8_1.a, 'M5 승자'); setLabel(lb8_1.b, 'M4 패자'); }
      if (lb8_2) { setLabel(lb8_2.a, 'M6 승자'); setLabel(lb8_2.b, 'M3 패자'); }
      // 상위권 결승(M9): M3 승자 vs M4 승자
      if (ubFinal) { setLabel(ubFinal.a, 'M3 승자'); setLabel(ubFinal.b, 'M4 승자'); }
      // 하위권 4강(M10): M7 승자 vs M8 승자
      if (lb4) { setLabel(lb4.a, 'M7 승자'); setLabel(lb4.b, 'M8 승자'); }
      // 하위권 결승(M11): M9 패자 vs M10 승자
      if (lbFinal) { setLabel(lbFinal.a, 'M9 패자'); setLabel(lbFinal.b, 'M10 승자'); }
      // 결승(M12): M9 승자 vs M11 승자
      if (grandFinal) { setLabel(grandFinal.a, 'M9 승자'); setLabel(grandFinal.b, 'M11 승자'); }
      if (lb4) { setLabel(lb4.a, '하위권 8강 M1 승자'); setLabel(lb4.b, '하위권 8강 M2 승자'); }
      if (lbFinal) { setLabel(lbFinal.a, '상위권 결승 패자'); setLabel(lbFinal.b, '하위권 4강 승자'); }
      if (grandFinal) { setLabel(grandFinal.a, '상위권 결승 승자'); setLabel(grandFinal.b, '하위권 결승 승자'); }
      // 이미지 배치 — 총 5개 컬럼.
      //   col0: M1·M2·M5·M6 (좌측 4매치 세로 나열)
      //   col1: M3·M4·M7·M8 (col0 오른쪽, 세로 4매치)
      //   col2: M9(상)·M10(하)
      //   col3: M11 (중앙)
      //   col4: M12 (결승)
      byKind.playoffs = {
        totalRows: 14,
        rounds: [
          { title: '', matches: [
            { ...ub8_1, startRow: 0 }, { ...ub8_2, startRow: 4 },
            ...(lb1_1 ? [{ ...lb1_1, startRow: 8 }] : []),
            ...(lb1_2 ? [{ ...lb1_2, startRow: 12 }] : []),
          ] },
          { title: '', matches: [
            { ...ub4_1, startRow: 0 }, { ...ub4_2, startRow: 4 },
            ...(lb8_1 ? [{ ...lb8_1, startRow: 8 }] : []),
            ...(lb8_2 ? [{ ...lb8_2, startRow: 12 }] : []),
          ] },
          { title: '', matches: [
            { ...ubFinal, startRow: 2 },
            ...(lb4 ? [{ ...lb4, startRow: 10 }] : []),
          ] },
          { title: '', matches: [{ ...lbFinal, startRow: 6 }] },
          { title: '', matches: [{ ...grandFinal, startRow: 6 }] },
        ],
        // 연결선 (승자/패자 라벨은 항상 슬롯 a=상단)
        //   col0 인덱스: M1=0, M2=1, M5=2, M6=3
        //   col1 인덱스: M3=0, M4=1, M7=2, M8=3
        connectors: [
          [0, 0, 'mid', 1, 0, 'a'],  // M1승 → M3 a
          [0, 1, 'mid', 1, 1, 'a'],  // M2승 → M4 a
          [1, 0, 'mid', 2, 0, 'a'],  // M3승 → M9 a
          [1, 1, 'mid', 2, 0, 'b'],  // M4승 → M9 b
          [0, 2, 'mid', 1, 2, 'a'],  // M5승 → M7 a
          [0, 3, 'mid', 1, 3, 'a'],  // M6승 → M8 a
          [1, 2, 'mid', 2, 1, 'a'],  // M7승 → M10 a
          [1, 3, 'mid', 2, 1, 'b'],  // M8승 → M10 b
          [2, 0, 'mid', 3, 0, 'a'],  // M9패 → M11 a
          [2, 1, 'mid', 3, 0, 'b'],  // M10승 → M11 b
          [2, 0, 'mid', 4, 0, 'a'],  // M9승 → M12 a
          [3, 0, 'mid', 4, 0, 'b'],  // M11승 → M12 b
        ],
      };
    }
    for (const b of [byKind.knights, byKind.playoffs, byKind.qualifier]) {
      if (!b) continue;
      for (const r of b.rounds) for (const m of r.matches) if (m.id && timeById[m.id]) m.time = kstLabel(timeById[m.id]);
    }
    // 기사의 길 시간 보정: API가 15:00·18:00으로 오지만 실제 시간은 14:00·17:00.
    if (byKind.knights) {
      const knM = byKind.knights.rounds.flatMap((r) => r.matches);
      const override = ['14:00', '17:00'];
      knM.forEach((m, i) => { if (m?.time && override[i]) m.time = m.time.replace(/\d{2}:\d{2}$/, override[i]); });
    }
    // 대표 선발전: LCK 플레이-인처럼 1라운드 2경기(상단/하단)·2라운드 1경기(중앙) 그리드로 재구성.
    if (byKind.qualifier?.rounds?.length >= 2 && byKind.qualifier.rounds[0].matches.length >= 2) {
      const q = byKind.qualifier;
      const [q1, q2] = q.rounds[0].matches;
      const qFinal = q.rounds[1].matches[0];
      if (q1) q1.title = '1라운드 M1';
      if (q2) q2.title = '1라운드 M2';
      if (qFinal) {
        qFinal.title = '2라운드';
        if (qFinal.a && !qFinal.a.short) qFinal.a.seed = '1R M1 승자';
        if (qFinal.b && !qFinal.b.short) qFinal.b.seed = '1R M2 승자';
      }
      byKind.qualifier = {
        totalRows: 6,
        rounds: [
          { title: '', matches: [{ ...q1, startRow: 0 }, { ...q2, startRow: 4 }] },
          ...(qFinal ? [{ title: '', matches: [{ ...qFinal, startRow: 2 }] }] : []),
        ],
        connectors: qFinal ? [[0, 0, 'mid', 1, 0, 'a'], [0, 1, 'mid', 1, 0, 'b']] : [],
      };
    }
    data.standings.lpl = data.standings.lpl || {};
    const prev = data.standings.lpl['Split 3'] || {};
    delete prev.bracket; // 수동 bracket 제거 (자동 대진으로 대체)
    delete prev.qualifier; // 대표 선발전은 별도 서브탭으로 분리
    applySeedOrder(byKind.knights); applySeedOrder(byKind.playoffs); applySeedOrder(byKind.qualifier);
    normalizeAdvancementFlags(byKind.knights); normalizeAdvancementFlags(byKind.playoffs); normalizeAdvancementFlags(byKind.qualifier);
    data.standings.lpl['Split 3'] = { ...prev, knights: byKind.knights || null, playoffs: byKind.playoffs || null };
    // 대표 선발전은 Split 3과 별도의 세부대회(서브탭)로 저장
    if (byKind.qualifier) {
      // 챔피언십 포인트 계산: Split 1·2 순위(고정) + Split 3 순위(진행 중이면 미포함)로 합산
      const S1_RANK = ['BLG', 'JDG', 'WBG', 'AL', 'TES', 'IG', 'NIP', 'WE'];
      const S2_RANK = ['BLG', 'TES', 'WE', 'AL', 'JDG', 'LGD', 'EDG', 'TT'];
      const S1_PT = [80, 50, 40, 20, 10, 10, 5, 5];
      const S2_PT = [110, 80, 50, 30, 15, 15, 10, 10];
      const S3_PT = [null, 110, 80, 50, 30, 30, 15, 15]; // 1등은 별도(LPL 1시드 자동)
      const pointsMap = {};
      const bump = (short, key, pt) => { pointsMap[short] = pointsMap[short] || { team: short, split1: 0, split2: 0, split3: 0 }; pointsMap[short][key] = pt; };
      S1_RANK.forEach((t, i) => bump(t, 'split1', S1_PT[i]));
      S2_RANK.forEach((t, i) => bump(t, 'split2', S2_PT[i]));
      // Split 3 순위: 플레이오프 결승 승자가 확정된 경우만 반영
      const po = byKind.playoffs;
      const winnerOf = (m) => {
        if (!m) return {};
        if (m.a?.win || m.a?.msi) return { w: m.a.short, l: m.b?.short };
        if (m.b?.win || m.b?.msi) return { w: m.b.short, l: m.a?.short };
        if (m.a?.score != null && m.b?.score != null && m.a.score !== m.b.score) {
          const aBig = m.a.score > m.b.score;
          return { w: aBig ? m.a.short : m.b.short, l: aBig ? m.b.short : m.a.short };
        }
        return {};
      };
      const s3Rank = [null, null, null, null, null, null, null, null]; // 1~8위
      // po.rounds[5]=결승, [4]=하위결승, [3]=하위4강, ...
      const gfM = po?.rounds?.[5]?.matches?.[0];
      const gf = winnerOf(gfM);
      if (gf.w) {
        s3Rank[0] = gf.w; s3Rank[1] = gf.l;
        s3Rank[2] = winnerOf(po?.rounds?.[4]?.matches?.[0]).l;      // 하위 결승 패자 = 3위
        s3Rank[3] = winnerOf(po?.rounds?.[3]?.matches?.[0]).l;      // 하위 4강 패자 = 4위
        s3Rank[4] = winnerOf(po?.rounds?.[2]?.matches?.[1]).l;      // 하위 8강 M1 패자
        s3Rank[5] = winnerOf(po?.rounds?.[2]?.matches?.[2]).l;      // 하위 8강 M2 패자
        s3Rank[6] = winnerOf(po?.rounds?.[1]?.matches?.[2]).l;      // 하위 1R M1 패자
        s3Rank[7] = winnerOf(po?.rounds?.[1]?.matches?.[3]).l;      // 하위 1R M2 패자
      }
      s3Rank.forEach((t, i) => { if (t && S3_PT[i] != null) bump(t, 'split3', S3_PT[i]); });
      const points = Object.values(pointsMap).map((p) => ({
        team: p.team, split1: p.split1 || 0, split2: p.split2 || 0, split3: p.split3 || 0,
        total: (p.split1 || 0) + (p.split2 || 0) + (p.split3 || 0),
      })).sort((a, b) => b.total - a.total);
      data.standings.lpl['대표 선발전'] = {
        stage: '2026 LPL 대표 선발전',
        rows: [],
        qualifier: byKind.qualifier,
        points,
        pointsNote: 'LPL 1시드=Split 3 우승 / 2시드=(1시드 제외) 포인트 합산 1등 / 대표 선발전 진출=합산 2~5등',
      };
    }
    const cnt = (b) => (b ? b.rounds.reduce((n, r) => n + r.matches.length, 0) : 0);
    console.log(`LPL Split 3 대진 갱신 (기사의 길 ${cnt(byKind.knights)}경기 / 플레이오프 ${cnt(byKind.playoffs)}경기 / 대표 선발전 ${cnt(byKind.qualifier)}경기)`);
  }
} catch (e) {
  console.warn(`LPL Split 3 대진 갱신 실패 — 기존 값 유지: ${e.message}`);
}

// DEMACIA 대회 정보 (참가팀·그룹·녹아웃) 외부 API에서 fetch.
//   참가팀 short는 사용자가 demacia-data_2026 리포지토리에서 직접 관리.
try {
  const DEMACIA_API = 'https://raw.githubusercontent.com/totaldu/demacia-data_2026/main/demacia.json';
  const res = await fetch(DEMACIA_API);
  if (res.ok) {
    const api = await res.json();
    const dem = data.standings.demacia || (data.standings.demacia = {});
    if (Array.isArray(api.teams)) {
      dem.teams = api.teams;
      // qualifiers는 API teams에서 파생: short 있으면 팀 표시, 없으면 시드 라벨.
      dem.qualifiers = api.teams.map((t) => (
        t.short ? { seed: t.seed, short: t.short } : { seed: t.seed, label: t.seed }
      ));
    }
    if (api.group) dem.group = api.group;
    if (api.knockout) dem.knockout = api.knockout;
    if (api.format) dem.format = api.format;
    if (api.updatedAt) dem.apiUpdatedAt = api.updatedAt;
    // prev 참조에 따라 매치 팀 자동 전파 (M1 승자 확정 시 M7 슬롯 자동 채움 등)
    const all = [...(dem.group?.matches || []), ...(dem.knockout?.matches || [])];
    const byId = Object.fromEntries(all.map((m) => [m.id, m]));
    const resolveRef = (ref) => {
      if (!ref || typeof ref !== 'string') return null;
      const m = ref.match(/^(\w+):(W|L)$/); if (!m) return null;
      const src = byId[m[1]]; if (!src || !src.winner) return null;
      if (m[2] === 'W') return src.winner;
      return src.winner === src.a ? src.b : src.a;
    };
    for (const m of all) {
      if (!m.a && m.prev?.a) { const t = resolveRef(m.prev.a); if (t) m.a = t; }
      if (!m.b && m.prev?.b) { const t = resolveRef(m.prev.b); if (t) m.b = t; }
    }
    // knockout advancing seeds → 팀 short 자동 채움
    if (dem.group?.advancing?.seeds) {
      for (const s of dem.group.advancing.seeds) {
        if (!s.short) { const t = resolveRef(s.from); if (t) s.short = t; }
      }
    }
    const g = dem.group?.matches?.length || 0;
    const k = dem.knockout?.matches?.length || 0;
    console.log(`DEMACIA API 반영: 그룹 ${g}경기 / 녹아웃 ${k}경기`);
  } else {
    console.warn(`DEMACIA API 접근 실패: ${res.status}`);
  }
} catch (e) {
  console.warn(`DEMACIA API 갱신 실패 — 기존 값 유지: ${e.message}`);
}

data.updatedAt = new Date().toISOString().slice(0, 10);
data.note = '리그별 → 세부대회별 공식 현재 순위표(정규시즌만, 토너먼트/플레이오프 제외). 있으면 우선 사용, 없으면 GPR 전적으로 대체. gw/gl은 세트(게임) 승-패.';
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log('lolStandings.json 갱신 완료');
