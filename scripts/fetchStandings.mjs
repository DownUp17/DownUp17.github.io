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

// 대회별 그룹명 표시 변경 (API 원본명 → 표시명). `${key}|${sub}` 기준.
const GROUP_RENAME = {
  'lck|LCK CUP': { '알파조': '바론 그룹', '오메가조': '장로 그룹' },
  'lpl|Split 1': { 'S 그룹': '등봉조', 'A조': '인내조', 'B조': '열반조' },
};
const renameGroups = (rows, key) => {
  const map = GROUP_RENAME[key];
  if (map) for (const r of rows || []) if (r.group && map[r.group]) r.group = map[r.group];
  return rows;
};

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

// 6팀 더블 엘리미네이션(LCK 플레이오프형)을 LCK PO 대진표 모양으로 재배치.
//   LCK PO 기준 그리드: totalRows=10 · UB 3라운드(상단) / LB 3라운드+로어파이널(하단) / 그랜드파이널(우측 중앙).
//   col0: UB R1 M1(sr0)·UB R1 M2(sr4)·LB R1(sr8)
//   col1: UB R2 M1(sr0)·UB R2 M2(sr4)·LB R2(sr8)
//   col2: UB R3(sr2)·LB R3(sr8)   col3: Lower Finals(sr8)   col4: Grand Finals(sr5)
//   LCK CUP PO(상위권/하위권 대진)의 매치 제목을 UB/LB 라운드로 매핑해 같은 모양을 만든다.
//   제목이 이 스킴과 맞지 않으면 원본(흐름 배치)을 그대로 반환한다.
function lckPoStyleLayout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  // 상위권 첫 라운드(8강/1라운드/UB R1) 존재 여부. 없고 상위 4강이 4개인 경우(CBLOL Copa 등): 앞 2개=UB R1, 뒤 2개=UB R2.
  //   2025 LCK처럼 상위 1R이 접두어 없이 "1라운드"로 오는 케이스도 인식.
  // '상위권 대진 - N라운드' 접두어 표기가 있으면 접두어 없는 plain "N라운드"는 상위권으로 보지 않는다
  //   (LEC처럼 상위/하위가 섞인 다른 구조 오적용 방지). LCK/LCP 2025는 상위 라운드가 plain "N라운드"라 허용.
  const hasPrefixedUpperR1 = bracket.rounds.some((r) => r.matches.some((m) => /상위권.*(8강|1라운드)/i.test(m.title || '')));
  const isUpperR1 = (t) => /상위권.*(8강|1라운드)|UB\s*R1/i.test(t) || (!hasPrefixedUpperR1 && /^1라운드$/.test(t));
  const hasUpper8 = bracket.rounds.some((r) => r.matches.some((m) => isUpperR1(m.title || '')));
  // 제목(+동일 제목 내 순서 k) → [목표 col, startRow]
  const targetFor = (title, k) => {
    const t = title || '';
    if (isUpperR1(t)) return [0, k === 0 ? 0 : 4];
    if (/상위권.*(4강|2라운드)|UB\s*R2/i.test(t) || (!hasPrefixedUpperR1 && /^2라운드$/.test(t))) {
      if (!hasUpper8) return k < 2 ? [0, k === 0 ? 0 : 4] : [1, k === 2 ? 0 : 4];
      return [1, k === 0 ? 0 : 4];
    }
    if (/상위권.*결승|UB\s*R3|결승\s*진출전/i.test(t)) return [2, 2];
    if (/하위권.*(1라운드|1R)|LB\s*R1/i.test(t)) return [0, 8];
    if (/하위권.*(8강|2라운드)|LB\s*R2/i.test(t)) return [1, 8];
    if (/하위권.*(4강|3라운드)|LB\s*R3/i.test(t)) return [2, 8];
    if (/하위권.*결승|패자.*결승|Lower\s*Final/i.test(t)) return [3, 8];
    if (/^결승$|Grand\s*Final|그랜드/i.test(t)) return [4, 5];
    return null;
  };
  const cols = [[], [], [], [], []];
  const seen = {};
  const origPos = {}; // `${ci}-${mi}` → id
  let ok = true;
  bracket.rounds.forEach((r, ci) => r.matches.forEach((m, mi) => {
    origPos[`${ci}-${mi}`] = m.id;
    const k = seen[m.title] || 0; seen[m.title] = k + 1;
    const tgt = targetFor(m.title, k);
    if (!tgt) { ok = false; return; }
    cols[tgt[0]].push({ m, startRow: tgt[1] });
  }));
  if (!ok || cols.some((c, i) => (i < 3 ? c.length === 0 : false))) return bracket; // 구조 불일치 → 원본 유지
  // 같은 컬럼에 동일 startRow가 겹치면 이 템플릿과 구조 불일치(예: 하위 8강 2경기) → 원본(flow) 유지
  for (const c of cols) { const rowSeen = {}; for (const x of c) { if (rowSeen[x.startRow]) return bracket; rowSeen[x.startRow] = 1; } }
  const idPos = {};
  // 각 컬럼은 startRow(위→아래)순으로 정렬 — 컬럼 내 매치 인덱스를 TMPL 좌표와 일치시킨다
  //   (원본 라운드 순서가 연도마다 달라도 동일한 대진표 모양·연결선이 되도록).
  const rounds2 = cols.filter((c) => c.length).map((arr, ci) => ({
    title: '',
    matches: arr.slice().sort((a, b) => a.startRow - b.startRow).map((x, mi) => { idPos[x.m.id] = [ci, mi]; return { ...x.m, startRow: x.startRow }; }),
  }));
  // 원본(origin 기반) 연결선을 새 좌표로 재매핑 — 각 dest 매치의 현재 슬롯 파악용
  const myConn = [];
  for (const c of bracket.connectors || []) {
    const [sci, smi, mid, dci, dmi, slot] = c;
    const sp = idPos[origPos[`${sci}-${smi}`]], dp = idPos[origPos[`${dci}-${dmi}`]];
    if (sp && dp) myConn.push([sp[0], sp[1], mid, dp[0], dp[1], slot]);
  }
  // LCK PO 표준 연결선 템플릿(그리드 좌표 동일) — 승자 진출선 + 상위결승 패자→하위결승 강등선.
  //   패자 강등선(8강→1R 등)은 LCK PO와 동일하게 생략한다.
  const TMPL = [
    [0, 0, 'mid', 1, 0, 'b'], [0, 1, 'mid', 1, 1, 'a'], [0, 2, 'mid', 1, 2, 'b'],
    [1, 2, 'mid', 2, 1, 'b'], [1, 0, 'mid', 2, 0, 'a'], [1, 1, 'mid', 2, 0, 'b'],
    [2, 0, 'mid', 3, 0, 'a'], [2, 1, 'mid', 3, 0, 'b'], [2, 0, 'mid', 4, 0, 'a'],
    [3, 0, 'mid', 4, 0, 'b'],
  ];
  // dest 매치의 팀 슬롯(a/b)이 템플릿과 반대면 뒤집어, 템플릿 연결선이 올바른 팀을 가리키게 한다.
  const collect = (arr) => {
    const out = {};
    for (const [sci, smi, , dci, dmi, slot] of arr) {
      const k = `${dci}-${dmi}`; (out[k] = out[k] || {})[`${sci}-${smi}`] = slot;
    }
    return out;
  };
  const desired = collect(TMPL), current = collect(myConn);
  for (const k of Object.keys(desired)) {
    const des = desired[k], cur = current[k] || {};
    const shared = Object.keys(des).filter((s) => cur[s] != null);
    if (shared.length && shared.every((s) => cur[s] !== des[s])) {
      const [ci, mi] = k.split('-').map(Number);
      const m = rounds2[ci]?.matches[mi];
      if (m) { const t = m.a; m.a = m.b; m.b = t; }
    }
  }
  // 실제로 존재하는 매치 좌표만 남긴다(구조 안전장치)
  const valid = TMPL.filter(([sci, smi, , dci, dmi]) => rounds2[sci]?.matches[smi] && rounds2[dci]?.matches[dmi]);
  return fixDropElim({ totalRows: 10, rounds: rounds2, connectors: valid });
}

// LEC 서머 플레이오프(6팀 DE) 그리드 배치 — 같은 라운드(상위·하위 동일 라운드)를 같은 x 컬럼에.
//   col0: 상위 1R(2) + 하위 1R(2) / col1: 상위 2R(1) + 하위 2R(1) / col2: 하위 3R / col3: 결승.
//   상위 브래킷은 상단(sr0~), 하위 브래킷은 하단(sr4~)에 배치. 연결선은 원본(승자/패자강등) 유지.
function lecPoLayout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  const seen = {};
  // 6팀 더블 엘리(상위 2라운드) — 명칭 무관(1·2라운드 또는 8강/4강), 같은 라운드=같은 컬럼.
  const targetFor = (title, k) => {
    const t = title || '';
    if (/^결승$/.test(t)) return [3, 3];                       // 그랜드 파이널
    if (/상위권.*(1라운드|8강)/.test(t)) return [0, k === 0 ? 0 : 2];
    if (/상위권.*(2라운드|4강)/.test(t)) return [1, 1];          // 상위 파이널
    if (/하위권.*1라운드/.test(t)) return [0, k === 0 ? 4 : 6];
    if (/하위권.*(2라운드|8강)/.test(t)) return [1, 5];
    if (/하위권.*(3라운드|4강|결승)/.test(t)) return [2, 5];      // 하위 파이널
    return null;
  };
  const cols = [[], [], [], []];
  const origPos = {};
  let ok = true;
  bracket.rounds.forEach((r, ci) => r.matches.forEach((m, mi) => {
    origPos[`${ci}-${mi}`] = m.id;
    const k = seen[m.title] || 0; seen[m.title] = k + 1;
    const tgt = targetFor(m.title, k);
    if (!tgt) { ok = false; return; }
    cols[tgt[0]].push({ m, startRow: tgt[1] });
  }));
  if (!ok) return bracket; // 구조 불일치 → 원본(흐름) 유지
  const idPos = {};
  const rounds2 = cols.filter((c) => c.length).map((arr, ci) => ({
    title: '',
    matches: arr.map((x, mi) => { idPos[x.m.id] = [ci, mi]; return { ...x.m, startRow: x.startRow }; }),
  }));
  // 원본(origin 기반) 연결선을 새 좌표로 재매핑 — 슬롯 파악용
  const myConn = [];
  for (const c of bracket.connectors || []) {
    const [sci, smi, mid, dci, dmi, slot] = c;
    const sp = idPos[origPos[`${sci}-${smi}`]], dp = idPos[origPos[`${dci}-${dmi}`]];
    if (sp && dp) myConn.push([sp[0], sp[1], mid, dp[0], dp[1], slot]);
  }
  // LEC 표준 연결선 템플릿(같은 라운드=같은 컬럼) — 승자 진출선 + 상위결승 패자→하위결승 강등선.
  //   패자 강등선(상위1R→하위1R)은 LEC Spring과 동일하게 생략한다.
  const TMPL = [
    [0, 0, 'mid', 1, 0, 'a'], [0, 1, 'mid', 1, 0, 'b'], [0, 2, 'mid', 1, 1, 'a'], [0, 3, 'mid', 1, 1, 'b'],
    [1, 1, 'mid', 2, 0, 'a'], [1, 0, 'mid', 2, 0, 'b'], [1, 0, 'mid', 3, 0, 'a'], [2, 0, 'mid', 3, 0, 'b'],
  ];
  const collect = (arr) => { const out = {}; for (const [sci, smi, , dci, dmi, slot] of arr) { const k = `${dci}-${dmi}`; (out[k] = out[k] || {})[`${sci}-${smi}`] = slot; } return out; };
  const desired = collect(TMPL), current = collect(myConn);
  for (const k of Object.keys(desired)) {
    const des = desired[k], cur = current[k] || {};
    const shared = Object.keys(des).filter((s) => cur[s] != null);
    if (shared.length && shared.every((s) => cur[s] !== des[s])) {
      const [ci, mi] = k.split('-').map(Number);
      const m = rounds2[ci]?.matches[mi];
      if (m) { const t = m.a; m.a = m.b; m.b = t; }
    }
  }
  const valid = TMPL.filter(([sci, smi, , dci, dmi]) => rounds2[sci]?.matches[smi] && rounds2[dci]?.matches[dmi]);
  return fixDropElim({ totalRows: 8, rounds: rounds2, connectors: valid });
}

// 8팀 더블 엘리미네이션(예선 1라운드 + 상위 2라운드 + 하위 3라운드) — LEC 2025 서머·LPL 2025 Split1형.
//   시드 1~4는 상위 브래킷(상위 1R→상위 결승), 시드 5~8은 예선(plain "1라운드")에서 시작해
//   승자만 하위 브래킷 첫 라운드로 합류(패자는 즉시 탈락). 라운드명(1/2/3라운드·8강/4강)에 무관하게 구조로 판별.
//   그리드(totalRows=10): col0 상위1R(상단 sr0·2)+예선(하단 sr6·8) / col1 상위결승(sr1)+하위1R(sr6·8) /
//     col2 하위2R(sr7) / col3 하위결승(sr7) / col4 결승(sr4).
//   연결선은 원본(id 기반)을 새 좌표로 재매핑하되, 상위1R→하위1R 패자 강등선은 다른 템플릿과 동일하게 생략.
function lec8DELayout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  const all = [];
  bracket.rounds.forEach((r, ci) => r.matches.forEach((m, mi) => all.push({ m, ci, mi, t: m.title || '' })));
  const gf = all.filter((x) => /^결승$/.test(x.t));
  const upF = all.filter((x) => /상위권.*결승/.test(x.t));
  const upR1 = all.filter((x) => /상위권/.test(x.t) && !/결승/.test(x.t));
  const prelim = all.filter((x) => /^1라운드$/.test(x.t));
  const loF = all.filter((x) => /하위권.*결승/.test(x.t));
  const loNon = all.filter((x) => /하위권/.test(x.t) && !/결승/.test(x.t));
  // 하위 비결승 라운드를 제목별로 묶어 2경기 그룹=하위 첫 라운드, 1경기 그룹=하위 두번째 라운드로 분리
  const loByTitle = {};
  for (const x of loNon) (loByTitle[x.t] = loByTitle[x.t] || []).push(x);
  const loGroups = Object.values(loByTitle);
  const loFirst = loGroups.find((g) => g.length === 2) || [];
  const loSecond = loGroups.find((g) => g.length === 1) || [];
  // 구조 검증 — 예선 2 · 상위1R 2 · 상위결승 1 · 하위첫 2 · 하위둘째 1 · 하위결승 1 · 결승 1
  if (gf.length !== 1 || upF.length !== 1 || upR1.length !== 2 || prelim.length !== 2 ||
      loGroups.length !== 2 || loFirst.length !== 2 || loSecond.length !== 1 || loF.length !== 1) return bracket;
  const byOrder = (arr) => arr.slice().sort((a, b) => a.ci - b.ci || a.mi - b.mi);
  // cols[col] = [{ m, sr }]
  const cols = [[], [], [], [], []];
  const put = (col, sr, m) => cols[col].push({ m, sr });
  byOrder(upR1).forEach((x, i) => put(0, i === 0 ? 0 : 2, x.m));
  byOrder(prelim).forEach((x, i) => put(0, i === 0 ? 6 : 8, x.m));
  put(1, 1, upF[0].m);
  byOrder(loFirst).forEach((x, i) => put(1, i === 0 ? 6 : 8, x.m));
  put(2, 7, loSecond[0].m);
  put(3, 7, loF[0].m);
  put(4, 4, gf[0].m);
  // 원본 좌표(ci-mi)→id, 새 좌표(id→[col, idx])
  const origPos = {};
  bracket.rounds.forEach((r, ci) => r.matches.forEach((m, mi) => { origPos[`${ci}-${mi}`] = m.id; }));
  const idPos = {};
  const rounds2 = cols.map((arr, ci) => ({
    title: '',
    matches: arr.slice().sort((a, b) => a.sr - b.sr).map((o, mi) => { idPos[o.m.id] = [ci, mi]; return { ...o.m, startRow: o.sr }; }),
  }));
  // 상위1R→하위1R 패자 강등선은 생략(다른 DE 템플릿과 동일) — 해당 id쌍만 제외하고 원본 연결선 재매핑
  const upR1Ids = new Set(upR1.map((x) => x.m.id));
  const loFirstIds = new Set(loFirst.map((x) => x.m.id));
  const connectors = [];
  for (const c of bracket.connectors || []) {
    const [sci, smi, mid, dci, dmi, slot] = c;
    const sId = origPos[`${sci}-${smi}`], dId = origPos[`${dci}-${dmi}`];
    if (upR1Ids.has(sId) && loFirstIds.has(dId)) continue; // 강등선 생략
    const sp = idPos[sId], dp = idPos[dId];
    if (sp && dp && sp[0] !== dp[0]) connectors.push([sp[0], sp[1], mid, dp[0], dp[1], slot]);
  }
  return fixDropElim({ totalRows: 10, rounds: rounds2, connectors });
}

// 2025 LCK CUP 플레이오프(6팀) — 상위 1·2·3라운드 + "하위권 대진" 2경기 + 결승 구조를 LCK PO식 그리드로.
//   두 하위권 대진 경기를 각각 "3라운드 하위조"(상위 3라운드와 같은 컬럼)·"4라운드"로 재표기해 하위조로 배치하고,
//   나머지(1·2·3라운드·결승)는 상위조로 둔다. 연결선은 원본(id 기반)을 새 좌표로 재매핑.
//   그리드(totalRows=10): col0 상위1R(sr0·4) / col1 상위2R(sr0·4) / col2 상위3R(sr2)+3라운드 하위조(sr8) /
//     col3 4라운드(sr8) / col4 결승(sr5).
function lckCupLayout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  const flat = [];
  bracket.rounds.forEach((r, ci) => r.matches.forEach((m, mi) => flat.push({ m, ci, mi, t: m.title || '' })));
  const up1 = flat.filter((x) => /^1라운드$/.test(x.t));
  const up2 = flat.filter((x) => /^2라운드$/.test(x.t));
  const up3 = flat.filter((x) => /^3라운드$/.test(x.t));
  const lower = flat.filter((x) => /^하위권 대진$/.test(x.t));
  const gf = flat.filter((x) => /^결승$/.test(x.t));
  if (up1.length !== 2 || up2.length !== 2 || up3.length !== 1 || lower.length !== 2 || gf.length !== 1) return bracket;
  const upCi = up3[0].ci;
  const loFirst = lower.find((x) => x.ci === upCi);   // 상위 3라운드와 같은 원본 컬럼 → 3라운드 하위조
  const loSecond = lower.find((x) => x.ci !== upCi);  // 그 다음 컬럼 → 4라운드
  if (!loFirst || !loSecond) return bracket;
  // 제목 재지정 + 재표기된 경기를 참조하는 시드 라벨 정합성 유지
  loFirst.m.title = '3라운드 하위조';
  loSecond.m.title = '4라운드';
  for (const s of [loSecond.m.a, loSecond.m.b]) if (s?.seed === '하위권 대진 승자') s.seed = '3라운드 하위조 승자';
  for (const s of [gf[0].m.a, gf[0].m.b]) if (s?.seed === '하위권 대진 승자') s.seed = '4라운드 승자';
  const byOrder = (arr) => arr.slice().sort((a, b) => a.ci - b.ci || a.mi - b.mi);
  const cols = [[], [], [], [], []];
  const put = (col, sr, m) => cols[col].push({ m, sr });
  byOrder(up1).forEach((x, i) => put(0, i === 0 ? 0 : 4, x.m));
  byOrder(up2).forEach((x, i) => put(1, i === 0 ? 0 : 4, x.m));
  put(2, 2, up3[0].m);
  put(2, 8, loFirst.m);
  put(3, 8, loSecond.m);
  put(4, 5, gf[0].m);
  const origPos = {};
  bracket.rounds.forEach((r, ci) => r.matches.forEach((m, mi) => { origPos[`${ci}-${mi}`] = m.id; }));
  const idPos = {};
  const rounds2 = cols.map((arr, ci) => ({
    title: '',
    matches: arr.slice().sort((a, b) => a.sr - b.sr).map((o, mi) => { idPos[o.m.id] = [ci, mi]; return { ...o.m, startRow: o.sr }; }),
  }));
  const connectors = [];
  for (const c of bracket.connectors || []) {
    const [sci, smi, mid, dci, dmi, slot] = c;
    const sp = idPos[origPos[`${sci}-${smi}`]], dp = idPos[origPos[`${dci}-${dmi}`]];
    if (sp && dp && sp[0] !== dp[0]) connectors.push([sp[0], sp[1], mid, dp[0], dp[1], slot]);
  }
  return fixDropElim({ totalRows: 10, rounds: rounds2, connectors });
}

// 2025 LTA 컨퍼런스 스테이지(8팀 더블 엘리, rounds 4·4·3·1) — LCP 그룹 시딩 스타일 압축 배치.
//   라운드별로 상위(상단)+하위(하단)를 같은 컬럼에 압축:
//     col0 상위1R×4(sr0·2·4·6) + 하위1R×2(sr8·10) / col1 상위2R×2(sr1·5) + 하위2R×2(sr8·10)
//   3라운드(상위3R·하위3R = 진출 4팀 시드 결정전)는 하단에 별개로 표시(연결선 없이): 상위3R col0·하위3R col1, sr13.
//   시드 결정전 패자 elim 제거. 상위→하위 강등선은 생략.
function ltaConferenceLayout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  // 제목 기준으로 매치를 분류(이전에 어떤 컬럼 배치였든 무관하게 재배치 가능)
  const all = bracket.rounds.flatMap((r) => r.matches);
  const byT = (re) => all.filter((m) => re.test(m.title || ''));
  const up1 = byT(/상위권 대진 - 1라운드/), up2 = byT(/상위권 대진 - 2라운드/), up3 = byT(/상위권 대진 - 3라운드/);
  const lo1 = byT(/하위권 대진 - 1라운드/), lo2 = byT(/하위권 대진 - 2라운드/), lo3 = byT(/하위권 대진 - 3라운드/);
  if (up1.length !== 4 || up2.length !== 2 || up3.length !== 1 || lo1.length !== 2 || lo2.length !== 2 || lo3.length !== 1) return bracket;
  // 컬럼 배치: col0 상위1R×4 + 하위1R×2, col1 상위2R×2 + 하위2R×2, 3라운드는 하단 별개.
  const cols = [[], []];
  const push = (m, col, sr) => cols[col].push({ m, sr });
  up1.forEach((m, i) => push(m, 0, [0, 2, 4, 6][i]));
  lo1.forEach((m, i) => push(m, 0, [8, 10][i]));
  up2.forEach((m, i) => push(m, 1, [1, 5][i]));
  lo2.forEach((m, i) => push(m, 1, [8, 10][i]));
  push(up3[0], 0, 13);   // 상위 3라운드 (하단 별개)
  push(lo3[0], 1, 13);   // 하위 3라운드 (하단 별개)
  const pos = new Map();
  const rounds2 = cols.map((arr, ci) => ({
    title: '',
    matches: arr.slice().sort((a, b) => a.sr - b.sr).map((o, mi) => { pos.set(o.m, [ci, mi]); return { ...o.m, startRow: o.sr }; }),
  }));
  // 시드 결정전(3라운드) 패자 elim 제거(진출 4팀 시드 결정전이라 탈락 아님)
  for (const r of rounds2) for (const m of r.matches) if (/3라운드/.test(m.title || '')) for (const s of [m.a, m.b]) if (s?.elim) delete s.elim;
  // 연결선: 상위1R→상위2R, 하위1R→하위2R만 팀 추적으로 재구성(3라운드는 별개라 연결선 없음).
  const winner = (m) => {
    const a = m.a?.score, b = m.b?.score;
    if (a != null && b != null) return a > b ? m.a : m.b;
    if (m.a?.win || m.a?.msi) return m.a; if (m.b?.win || m.b?.msi) return m.b; return null;
  };
  const slotIn = (m, short) => (m.a?.short === short ? 'a' : (m.b?.short === short ? 'b' : null));
  const connectors = [];
  const link = (srcs, dests) => {
    for (const s of srcs) {
      const w = winner(s); if (!w?.short) continue;
      const d = dests.find((x) => slotIn(x, w.short)); if (!d) continue;
      const sp = pos.get(s), dp = pos.get(d);
      if (sp && dp && sp[0] !== dp[0]) connectors.push([sp[0], sp[1], 'mid', dp[0], dp[1], slotIn(d, w.short)]);
    }
  };
  link(up1, up2);
  link(lo1, lo2);
  return fixDropElim({ totalRows: 15, rounds: rounds2, connectors });
}

// 2025 LTA Split 3 / Etapa 3 round_2 (rounds 4·3·1·1·1) — 세로 배치 + 하위권 연결선/색 보정.
//   배치: 하위 8강을 하위 1라운드와 같은 높이(sr6·10)에, 하위 4강·하위 결승을 두 하위 8강 사이(sr8)에.
//     상위 4강(sr0·2)·상위 결승(sr1) 상단, 결승(sr4) 중앙.
//   보정: 원본 대진에 하위 1R→하위 8강·하위 8강→하위 4강 연결선이 누락 → 팀 추적으로 재구성.
//     그로 인해 중간 하위 라운드 승자가 우승(금색 msi)으로 오표기된 것을 라운드 승리(파랑 win)로 교정.
function ltaRound2Layout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  if (bracket.rounds.map((r) => r.matches.length).join(',') !== '4,3,1,1,1') return bracket;
  const titles = bracket.rounds.flatMap((r) => r.matches.map((m) => m.title || ''));
  if (!titles.some((t) => /상위권 대진 - 4강/.test(t)) || !titles.some((t) => /하위권 대진 - 8강/.test(t))) return bracket;
  const cnt = {};
  const srOf = (t) => {
    const i = cnt[t] = (cnt[t] || 0); cnt[t] = i + 1;
    if (/상위권 대진 - 4강/.test(t)) return i === 0 ? 0 : 2;
    if (/하위권 대진 - 1라운드/.test(t)) return i === 0 ? 6 : 10;
    if (/상위권 대진 - 결승/.test(t)) return 1;
    if (/하위권 대진 - 8강/.test(t)) return i === 0 ? 6 : 10;   // 하위 1라운드와 같은 높이
    if (/하위권 대진 - 4강/.test(t)) return 8;                    // 두 하위 8강 사이
    if (/하위권 대진 - 결승/.test(t)) return 8;                   // 두 하위 8강 사이
    if (/^결승$/.test(t)) return 4;
    return 0;
  };
  // 슬롯까지 복사(플래그 수정이 원본을 건드리지 않게)
  const rounds2 = bracket.rounds.map((r) => ({
    title: '',
    matches: r.matches.map((m) => ({ ...m, startRow: srOf(m.title || ''), a: { ...m.a }, b: { ...m.b } })),
  }));
  const at = (ci, mi) => rounds2[ci]?.matches[mi];
  // 결승이 아닌 매치의 msi(우승/금색) → win(라운드 승리/파랑)
  rounds2.forEach((r) => r.matches.forEach((m) => {
    if (/^결승$/.test(m.title || '')) return;
    for (const s of [m.a, m.b]) if (s?.msi) { delete s.msi; s.win = true; }
  }));
  // 하위권 연결선 재구성(팀 추적): 하위 1R([0,2]·[0,3]) → 하위 8강([1,1]·[1,2]) → 하위 4강([2,0])
  const winSlot = (m) => {
    const a = m.a?.score, b = m.b?.score;
    if (a != null && b != null) return a > b ? 'a' : 'b';
    if (m.a?.win || m.a?.msi) return 'a';
    if (m.b?.win || m.b?.msi) return 'b';
    return null;
  };
  const slotOfTeam = (m, short) => (m?.a?.short === short ? 'a' : (m?.b?.short === short ? 'b' : null));
  const extra = [];
  const l8 = [at(1, 1), at(1, 2)];
  for (const mi of [2, 3]) {
    const m = at(0, mi), ws = winSlot(m); if (!ws) continue;
    const team = m[ws].short;
    const j = l8.findIndex((x) => slotOfTeam(x, team));
    if (j >= 0) extra.push([0, mi, 'mid', 1, 1 + j, slotOfTeam(l8[j], team)]);
  }
  for (const mi of [1, 2]) {
    const m = at(1, mi), ws = winSlot(m); if (!ws) continue;
    const ds = slotOfTeam(at(2, 0), m[ws].short);
    if (ds) extra.push([1, mi, 'mid', 2, 0, ds]);
  }
  return fixDropElim({ totalRows: 12, rounds: rounds2, connectors: [...(bracket.connectors || []), ...extra] });
}

// 2025 LTA Playoffs 아메리카 스테이지(rounds 3·1·1·1) — 사용자 지정 배치.
//   하위 1라운드(col0)를 위·아래(sr0·6)로 벌리고, 하위 4강·하위 결승(sr3)을 그 사이 높이에 둔다.
//   상위 결승을 하위 4강과 같은 x컬럼(col1, 상단 sr0)으로 이동. 결승은 col3(sr1). 연결선은 새 좌표로 재매핑.
function ltaAmericasLayout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  if (bracket.rounds.map((r) => r.matches.length).join(',') !== '3,1,1,1') return bracket;
  const at = (ci, mi) => bracket.rounds[ci]?.matches[mi];
  if (!/상위권 대진 - 결승/.test(at(0, 0)?.title || '')) return bracket;
  if (!/하위권 대진 - 4강/.test(at(1, 0)?.title || '')) return bracket;
  // 원본 [ci,mi] → [col, startRow]
  const MAP = {
    '0-1': [0, 0], '0-2': [0, 6],   // 하위 1R ×2 (위·아래로 벌림)
    '0-0': [1, 0], '1-0': [1, 3],   // 상위 결승(상단) + 하위 4강(하위 1R 사이) — 같은 컬럼
    '2-0': [2, 3],                  // 하위 결승 (하위 1R 사이)
    '3-0': [3, 1],                  // 결승
  };
  const cols = [[], [], [], []];
  const origPos = {};
  bracket.rounds.forEach((r, ci) => r.matches.forEach((m, mi) => {
    origPos[`${ci}-${mi}`] = m;
    const [col, sr] = MAP[`${ci}-${mi}`];
    cols[col].push({ m, sr });
  }));
  const idPos = new Map();
  const rounds2 = cols.map((arr, ci) => ({
    title: '',
    matches: arr.slice().sort((a, b) => a.sr - b.sr).map((o, mi) => { idPos.set(o.m, [ci, mi]); return { ...o.m, startRow: o.sr }; }),
  }));
  const connectors = [];
  for (const c of bracket.connectors || []) {
    const [sci, smi, mid, dci, dmi, slot] = c;
    const sp = idPos.get(origPos[`${sci}-${smi}`]), dp = idPos.get(origPos[`${dci}-${dmi}`]);
    if (sp && dp && sp[0] !== dp[0]) connectors.push([sp[0], sp[1], mid, dp[0], dp[1], slot]);
  }
  return fixDropElim({ totalRows: 8, rounds: rounds2, connectors });
}

// 공통 헬퍼: 원본 [ci,mi] → 새 좌표(cols[col]=[{m,sr}])로 재구성 + 연결선 재매핑.
function regridByObject(bracket, cols, totalRows) {
  const origPos = {};
  bracket.rounds.forEach((r, ci) => r.matches.forEach((m, mi) => { origPos[`${ci}-${mi}`] = m; }));
  const idPos = new Map();
  const rounds2 = cols.map((arr, ci) => ({
    title: '',
    matches: arr.slice().sort((a, b) => a.sr - b.sr).map((o, mi) => { idPos.set(o.m, [ci, mi]); return { ...o.m, startRow: o.sr }; }),
  }));
  const connectors = [];
  for (const c of bracket.connectors || []) {
    const [sci, smi, mid, dci, dmi, slot] = c;
    const sp = idPos.get(origPos[`${sci}-${smi}`]), dp = idPos.get(origPos[`${dci}-${dmi}`]);
    if (sp && dp && sp[0] !== dp[0]) connectors.push([sp[0], sp[1], mid, dp[0], dp[1], slot]);
  }
  return fixDropElim({ totalRows, rounds: rounds2, connectors });
}

// 2025 LCP 퀄리파잉 시리즈(regional_qualifier 포함, rounds 2·2·2·1·1) — 사용자 지정 세로 배치.
//   c0 1R(sr0·2) / c1 2R(1R와 같은 행 sr0·2)+하위권[2,1](낮은 행 sr5) / c2 3R(1·2R 사이 sr1)+하위권[3,0](sr5) / c3 4R(sr3).
//   3R과 결승 앞 하위권 대진은 같은 컬럼(c2), 하위권은 1·2R보다 낮은 행, 3R은 1R·2R 행 사이.
function lcpQualifyingLayout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  if (bracket.rounds.map((r) => r.matches.length).join(',') !== '2,2,2,1,1') return bracket;
  const [r0, r1, r2, r3, r4] = bracket.rounds;
  const isLower = (m) => /하위권/.test(m.title || '');
  const r2upper = r2.matches.find((m) => !isLower(m));   // 3라운드
  const r2lower = r2.matches.find(isLower);              // 하위권 대진(첫)
  if (!r2upper || !r2lower || !isLower(r3.matches[0]) || isLower(r4.matches[0])) return bracket;
  const cols = [[], [], [], []];
  const push = (m, col, sr) => cols[col].push({ m, sr });
  push(r0.matches[0], 0, 0); push(r0.matches[1], 0, 2);      // 1R
  push(r1.matches[0], 1, 0); push(r1.matches[1], 1, 2);      // 2R (1R와 같은 행)
  push(r2lower, 1, 5);                                       // 하위권 대진(첫) — 1·2R보다 낮은 행
  push(r2upper, 2, 1);                                       // 3R (1R·2R 행 사이)
  push(r3.matches[0], 2, 5);                                 // 하위권 대진(결승 앞) — 낮은 행
  push(r4.matches[0], 3, 3);                                 // 4R
  const out = regridByObject(bracket, cols, 7);
  // 색 보정: 결승(4라운드) 승자만 진출(금색 msi), 나머지 라운드 승자는 라운드 승리(파랑 win).
  //   원본은 1라운드→2라운드 연결선 누락으로 1R 승자가 진출(금색)로 오표기됨.
  for (const r of out.rounds) for (const m of r.matches) {
    if (/^4라운드$|^결승$/.test(m.title || '')) continue;
    for (const s of [m.a, m.b]) if (s?.msi) { delete s.msi; s.win = true; }
  }
  // 누락된 1라운드→2라운드 연결선을 팀 추적으로 추가.
  const winner = (m) => {
    const a = m.a?.score, b = m.b?.score;
    if (a != null && b != null) return a > b ? m.a : m.b;
    if (m.a?.win || m.a?.msi) return m.a; if (m.b?.win || m.b?.msi) return m.b; return null;
  };
  const findPos = (re, short) => {
    for (let ci = 0; ci < out.rounds.length; ci++) {
      const ms = out.rounds[ci].matches;
      for (let mi = 0; mi < ms.length; mi++) {
        const m = ms[mi];
        if (re.test(m.title || '') && (m.a?.short === short || m.b?.short === short)) return [ci, mi, m.a?.short === short ? 'a' : 'b'];
      }
    }
    return null;
  };
  out.rounds.forEach((r, ci) => r.matches.forEach((m, mi) => {
    if (!/^1라운드$/.test(m.title || '')) return;
    const w = winner(m); if (!w?.short) return;
    const dst = findPos(/^2라운드$/, w.short);
    if (dst && dst[0] !== ci) out.connectors.push([ci, mi, 'mid', dst[0], dst[1], dst[2]]);
  }));
  return out;
}

// 2025 LTA Split2/Etapa2 PO(6팀 더블 엘리, rounds 2·3·1·1·1 · 상위4강/하위8강) — 컴팩트 그리드.
//   col0 상위4강×2(sr0·2)+하위8강×2(sr6·10) / col1 상위결승(sr1)+하위4강(sr8) / col2 하위결승(sr8) / col3 결승(sr4).
//   상위결승은 두 상위4강 사이, 하위4강·하위결승은 두 하위8강 사이. 상위→하위 강등선은 같은 컬럼이라 자동 생략.
function ltaPlayoffs2Layout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  if (bracket.rounds.map((r) => r.matches.length).join(',') !== '2,3,1,1,1') return bracket;
  const at = (ci, mi) => bracket.rounds[ci]?.matches[mi];
  // 명칭 무관(상위권/하위권 대진, 승자/패자 대진 등) — 상위·하위 역할로 판별.
  const isLo = (m) => /하위권|패자/.test(m.title || '');
  if (bracket.rounds[0].matches.some(isLo)) return bracket;
  const upFinal = bracket.rounds[1].matches.find((m) => !isLo(m));
  const loQF = bracket.rounds[1].matches.filter(isLo);
  if (!upFinal || loQF.length !== 2) return bracket;
  if (!isLo(at(2, 0)) || !isLo(at(3, 0)) || isLo(at(4, 0))) return bracket;
  const cols = [[], [], [], []];
  const push = (m, col, sr) => cols[col].push({ m, sr });
  push(at(0, 0), 0, 0); push(at(0, 1), 0, 2);       // 상위 4강
  push(loQF[0], 0, 6); push(loQF[1], 0, 10);        // 하위 8강 (상위 4강과 같은 컬럼)
  push(upFinal, 1, 1);                              // 상위 결승 (두 상위 4강 사이)
  push(at(2, 0), 1, 8);                             // 하위 4강 (상위 결승과 같은 컬럼, 두 하위 8강 사이)
  push(at(3, 0), 2, 8);                             // 하위 결승 (두 하위 8강 사이)
  push(at(4, 0), 3, 4);                             // 결승
  return regridByObject(bracket, cols, 12);
}

// 4팀 더블 엘리미네이션(2팀 진출) 공통 템플릿 — 2025 MSI 플레이-인 배치 기준.
//   그룹당 5경기(1R×2, 진출2R=승자조, 탈락2R=패자조, 3R=결정전)를 3컬럼으로:
//     col base   1R×2(sr0·2)
//     col base+1 진출2R(두 1R 사이 sr1) + 탈락2R(하위 sr5)
//     col base+2 3R(하위 sr5)
//   그룹은 좌우로 나열(그룹 g → base=g*3). 명칭 무관 — 플래그(진출 msi·탈락 elim)로 역할을 구조적으로 판별.
//     결정전=진출+탈락 동시 보유 / 진출2R=진출만 / 탈락2R=탈락만 / 1R=둘 다 없음.
//   적용 대상: 2025 MSI PI, 2025 LCP Finals 그룹 시딩(2조), 2026 FST 그룹 스테이지(2조), 2026 EWC 그룹 스테이지 등.
//   여러 그룹이 함께 나열되면(compact) 2컬럼으로 압축: 패자전(탈락2R)을 1R 컬럼에, 결정전(패자조 결승)을 승자전(승자조 결승) 컬럼에.
//     single(1그룹 단독): col base 1R×2 / base+1 진출2R+탈락2R / base+2 결정전  (3컬럼, MSI PI식)
//     compact(여러 그룹): col base 1R×2 + 탈락2R / base+1 진출2R + 결정전         (2컬럼)
//   opts.compact 미지정 시 그룹이 2개 이상이면 자동 compact.
function de4Layout(bracket, opts = {}) {
  if (!bracket?.rounds?.length || bracket.sections) return bracket;
  const flat = bracket.rounds.flatMap((r) => r.matches);
  if (flat.length < 5 || flat.length % 5 !== 0) return bracket;
  const hasMsi = (m) => m.a?.msi || m.b?.msi;
  const hasElim = (m) => m.a?.elim || m.b?.elim;
  const isDecider = (m) => hasMsi(m) && hasElim(m);   // 결정전(3R): 진출·탈락 동시 보유
  // 결정전 경계로 그룹 분할 — 각 그룹은 결정전으로 끝나야 함
  const groups = []; let cur = [];
  for (const m of flat) { cur.push(m); if (isDecider(m)) { groups.push(cur); cur = []; } }
  if (cur.length) return bracket;
  const compact = opts.compact ?? (groups.length > 1);
  const perGroup = compact ? 2 : 3;
  const cols = [];
  const push = (m, col, sr) => { (cols[col] = cols[col] || []).push({ m, sr }); };
  const roles = [];
  for (let g = 0; g < groups.length; g++) {
    const grp = groups[g];
    if (grp.length !== 5) return bracket;
    const dec = grp.find(isDecider);
    const adv = grp.find((m) => m !== dec && hasMsi(m) && !hasElim(m));    // 진출2R(승자조)
    const elim = grp.find((m) => m !== dec && hasElim(m) && !hasMsi(m));   // 탈락2R(패자조)
    const r1 = grp.filter((m) => m !== dec && m !== adv && m !== elim);    // 1R ×2
    if (!dec || !adv || !elim || r1.length !== 2) return bracket;
    const base = g * perGroup;
    if (compact) {
      push(r1[0], base, 0); push(r1[1], base, 2); push(elim, base, 4);     // 1R×2 + 탈락2R(패자전)
      push(adv, base + 1, 1); push(dec, base + 1, 4);                      // 진출2R(승자전) + 결정전
    } else {
      push(r1[0], base, 0); push(r1[1], base, 2);
      push(adv, base + 1, 1); push(elim, base + 1, 5);
      push(dec, base + 2, 5);
    }
    roles.push({ r1, adv, elim, dec });
  }
  const pos = new Map();
  const rounds2 = cols.map((arr, ci) => ({
    title: '',
    matches: (arr || []).slice().sort((a, b) => a.sr - b.sr).map((o, mi) => { pos.set(o.m, [ci, mi]); return { ...o.m, startRow: o.sr }; }),
  }));
  // 연결선 팀 추적 재구성(1R→진출2R·탈락2R, 진출2R 패자·탈락2R 승자→3R).
  const winnerOf = (m) => { const a = m.a?.score, b = m.b?.score; if (a != null && b != null) return a > b ? m.a : m.b; if (m.a?.win || m.a?.msi) return m.a; if (m.b?.win || m.b?.msi) return m.b; return null; };
  const slotIn = (m, short) => (m.a?.short === short ? 'a' : (m.b?.short === short ? 'b' : null));
  const connectors = [];
  const link = (src, dst, short) => { if (!short) return; const sp = pos.get(src), dp = pos.get(dst), sl = slotIn(dst, short); if (sp && dp && sl && sp[0] !== dp[0]) connectors.push([sp[0], sp[1], 'mid', dp[0], dp[1], sl]); };
  for (const { r1, adv, elim, dec } of roles) {
    for (const m of r1) { const w = winnerOf(m); const l = w ? (w === m.a ? m.b : m.a) : null; if (w) link(m, adv, w.short); if (l) link(m, elim, l.short); }
    const advW = winnerOf(adv), advL = advW ? (advW === adv.a ? adv.b : adv.a) : null;
    const elimW = winnerOf(elim);
    if (advL) link(adv, dec, advL.short);
    if (elimW) link(elim, dec, elimW.short);
  }
  return fixDropElim({ totalRows: compact ? 6 : 7, rounds: rounds2, connectors });
}

// 2023~2024 LCK 플레이오프(6팀, rounds 2·2·2·1·1 · 3라운드=승자조+패자조 2경기) — 사용자 지정 세로 배치.
//   컬럼(=라운드)은 유지하고 startRow만 조정:
//     승자조 3라운드를 1·2라운드 대진 사이(sr2)에, 패자조 3라운드는 하위(sr8)에, 4라운드는 패자조 3라운드와 같은 행(sr8).
//   col0 1R(sr0·4) / col1 2R(sr0·4) / col2 승자조3R(sr2)+패자조3R(sr8) / col3 4R(sr8) / col4 결승(sr5).
function lckPo2024Layout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  if (bracket.rounds.map((r) => r.matches.length).join(',') !== '2,2,2,1,1') return bracket;
  const [r0, r1, r2, r3, r4] = bracket.rounds;
  if (!r2.matches.every((m) => /3라운드/.test(m.title || ''))) return bracket; // 3라운드 두 경기(승자조·패자조)
  const winnerOf = (m) => { const a = m.a?.score, b = m.b?.score; if (a != null && b != null) return a > b ? m.a : m.b; if (m.a?.win || m.a?.msi) return m.a; if (m.b?.win || m.b?.msi) return m.b; return null; };
  const w2 = new Set(r1.matches.map((m) => winnerOf(m)?.short).filter(Boolean)); // 2라운드 승자들
  const upperR3 = r2.matches.find((m) => w2.has(m.a?.short) && w2.has(m.b?.short)); // 승자조 3라운드
  const lowerR3 = r2.matches.find((m) => m !== upperR3);                            // 패자조 3라운드
  if (!upperR3 || !lowerR3) return bracket;
  const SR = new Map();
  SR.set(r0.matches[0], 0); SR.set(r0.matches[1], 4);   // 1라운드
  SR.set(r1.matches[0], 0); SR.set(r1.matches[1], 4);   // 2라운드
  SR.set(upperR3, 2);                                    // 승자조 3라운드 (1·2라운드 사이)
  SR.set(lowerR3, 8);                                    // 패자조 3라운드 (하위)
  SR.set(r3.matches[0], 8);                              // 4라운드 (패자조 3라운드와 같은 행)
  SR.set(r4.matches[0], 5);                              // 결승
  const rounds2 = bracket.rounds.map((r) => ({ title: '', matches: r.matches.map((m) => ({ ...m, startRow: SR.get(m) })) }));
  return fixDropElim({ totalRows: 10, rounds: rounds2, connectors: bracket.connectors });
}

// 2021~2024 LPL Spring/Summer형 PO(rounds 2·2·2·2·2·1·1, 게이트웨이 1~3라운드 + 상위/하위 대진) — 사용자 지정 압축.
//   하위 대진을 상위 대진과 같은 컬럼으로: col3 상위1R×2 + 하위1R / col4 상위2R + 하위2R / col5 결승.
//   상위2R는 두 상위1R 사이 행(sr2), 하위2R는 하위1R와 같은 행(sr8). 게이트웨이(1·2·3라운드)는 col0·1·2.
function lplSpring24Layout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  if (bracket.rounds.map((r) => r.matches.length).join(',') !== '2,2,2,2,2,1,1') return bracket;
  const at = (ci, mi) => bracket.rounds[ci]?.matches[mi];
  // 명칭 무관(Spring: 상위권 1·2라운드/하위권 1·2라운드, Summer: 4라운드/상위권 결승/하위권 4강·결승) — 상위/하위로 역할 판별
  const isLo = (m) => /하위권/.test(m.title || '');
  const up1 = bracket.rounds[3].matches;
  if (up1.some(isLo)) return bracket;
  const up2 = bracket.rounds[4].matches.find((m) => !isLo(m));
  const lo1 = bracket.rounds[4].matches.find(isLo);
  const lo2 = bracket.rounds[5].matches.find(isLo);
  const gf = bracket.rounds[6].matches[0];
  if (!up2 || !lo1 || !lo2 || !gf || isLo(gf)) return bracket;
  const cols = [[], [], [], [], [], []];
  const push = (m, col, sr) => cols[col].push({ m, sr });
  push(at(0, 0), 0, 0); push(at(0, 1), 0, 4);   // 1라운드
  push(at(1, 0), 1, 0); push(at(1, 1), 1, 4);   // 2라운드
  push(at(2, 0), 2, 0); push(at(2, 1), 2, 4);   // 3라운드
  push(up1[0], 3, 0); push(up1[1], 3, 4); push(lo1, 3, 8);   // 상위1R×2 + 하위1R (하단)
  push(up2, 4, 2); push(lo2, 4, 8);                          // 상위2R(상위1R 사이) + 하위2R(하위1R와 같은 행)
  push(gf, 5, 5);                                            // 결승
  return regridByObject(bracket, cols, 10);
}

// LPL 기사의 길(Knights Rivals) — 1·2라운드를 같은 컬럼(1R 상단, 2R 하단), 3라운드를 다음 컬럼에.
function knightsLayout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  const seen = {};
  const origPos = {};
  const targetFor = (title, k) => {
    const t = title || '';
    if (/1라운드|1R/i.test(t)) return [0, k === 0 ? 0 : 2];
    if (/2라운드|2R/i.test(t)) return [0, k === 0 ? 4 : 6];
    if (/3라운드|3R/i.test(t)) return [1, k === 0 ? 1 : 5];
    return null;
  };
  const cols = [[], []];
  let ok = true;
  bracket.rounds.forEach((r, ci) => r.matches.forEach((m, mi) => {
    origPos[`${ci}-${mi}`] = m.id;
    const k = seen[m.title] || 0; seen[m.title] = k + 1;
    const tgt = targetFor(m.title, k);
    if (!tgt) { ok = false; return; }
    cols[tgt[0]].push({ m, startRow: tgt[1] });
  }));
  if (!ok) return bracket;
  const idPos = {};
  const rounds2 = cols.map((arr, ci) => ({ title: '', matches: arr.map((x, mi) => { idPos[x.m.id] = [ci, mi]; return { ...x.m, startRow: x.startRow }; }) }));
  const connectors = [];
  for (const c of bracket.connectors || []) {
    const [sci, smi, mid, dci, dmi, slot] = c;
    const sp = idPos[origPos[`${sci}-${smi}`]], dp = idPos[origPos[`${dci}-${dmi}`]];
    if (sp && dp) connectors.push([sp[0], sp[1], mid, dp[0], dp[1], slot]);
  }
  return fixDropElim({ totalRows: 8, rounds: rounds2, connectors });
}

// Road to MSI(상위 6팀 사다리) — 2026과 동일한 컴팩트 템플릿(4컬럼·연결선)으로 재배치.
//   API는 1~5라운드를 5개 컬럼으로 주지만, 3·4라운드를 한 컬럼에 합쳐 2026 모양과 일치시킨다.
function roadToMsiLayout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  const byTitle = {};
  for (const r of bracket.rounds) for (const m of r.matches) if (m.title) byTitle[m.title] = m;
  const need = ['1라운드', '2라운드', '3라운드', '4라운드', '5라운드'];
  if (!need.every((t) => byTitle[t])) return bracket;
  const cols = [
    [{ m: byTitle['1라운드'], sr: 4 }],
    [{ m: byTitle['2라운드'], sr: 3 }],
    [{ m: byTitle['3라운드'], sr: 0 }, { m: byTitle['4라운드'], sr: 2 }],
    [{ m: byTitle['5라운드'], sr: 1 }],
  ];
  const rounds = cols.map((arr) => ({ title: '', matches: arr.map((x) => ({ ...x.m, startRow: x.sr })) }));
  const connectors = [[0, 0, 'a', 1, 0, 'b'], [1, 0, 'a', 2, 1, 'b'], [2, 0, 'b', 3, 0, 'a'], [2, 1, 'mid', 3, 0, 'b']];
  return fixDropElim({ totalRows: 6, rounds, connectors });
}

// 8팀 더블 엘리미네이션(상위권/하위권)을 MSI 브래킷 스테이지 모양(상위·하위 2섹션)으로 재배치.
//   상위 섹션: 8강(4)·4강(2)·상위결승(1)·그랜드파이널(1) / 하위 섹션: 1R(2)·8강(2)·4강(1)·하위결승(1).
//   섹션 내부 연결선 + 섹션 간(crossConnectors, 패자 강등·하위결승→GF)로 분리.
function msi8DELayout(bracket) {
  if (!bracket?.rounds?.length) return bracket;
  const seen = {};
  const origPos = {};
  // [sec, round, matchIdx, startRow]
  // 명칭 무관(8강/4강/결승 또는 1·2·3라운드) 8팀 더블 엘리 매핑
  const targetFor = (title, k) => {
    const t = title || '';
    if (/^결승$|그랜드|Grand/i.test(t)) return [0, 5, 0, 3];           // 그랜드 파이널
    if (/상위권.*(8강|1라운드)/.test(t)) return [0, 0, k, [0, 2, 4, 6][k]];
    if (/상위권.*(4강|2라운드)/.test(t)) return [0, 1, k, [1, 5][k]];
    if (/상위권.*(결승|3라운드)/.test(t)) return [0, 2, 0, 3];
    if (/하위권.*1라운드/.test(t)) return [1, 1, k, [0, 2][k]];
    if (/하위권.*(8강|2라운드)/.test(t)) return [1, 2, k, [0, 2][k]];
    if (/하위권.*(4강|3라운드)/.test(t)) return [1, 3, 0, 1];
    if (/하위권.*(결승|4라운드)/.test(t)) return [1, 4, 0, 1];
    return null;
  };
  // secMatches[sec][round] = [{m, mi, startRow}]
  const secMatches = [[[], [], [], [], [], []], [[], [], [], [], []]];
  let ok = true;
  bracket.rounds.forEach((r, ci) => r.matches.forEach((m, mi) => {
    origPos[`${ci}-${mi}`] = m.id;
    const k = seen[m.title] || 0; seen[m.title] = k + 1;
    const tgt = targetFor(m.title, k);
    if (!tgt) { ok = false; return; }
    const [sec, round, matchIdx, startRow] = tgt;
    secMatches[sec][round][matchIdx] = { m, startRow };
  }));
  if (!ok) return bracket;
  const idPos = {}; // id → [sec, round, mi]
  const sections = secMatches.map((rounds, sec) => ({
    rounds: rounds.map((arr, round) => ({
      title: '',
      matches: (arr || []).filter(Boolean).map((x, mi) => { idPos[x.m.id] = [sec, round, mi]; return { ...x.m, startRow: x.startRow }; }),
    })),
    totalRows: sec === 0 ? 8 : 4,
  }));
  const crossConnectors = [];
  for (const s of sections) s.connectors = [];
  for (const c of bracket.connectors || []) {
    const [sci, smi, mid, dci, dmi, slot] = c;
    const sp = idPos[origPos[`${sci}-${smi}`]], dp = idPos[origPos[`${dci}-${dmi}`]];
    if (!sp || !dp) continue;
    if (sp[0] === dp[0]) sections[sp[0]].connectors.push([sp[1], sp[2], mid, dp[1], dp[2], slot]);
    else crossConnectors.push([sp[0], sp[1], sp[2], 'mid', dp[0], dp[1], dp[2], slot]);
  }
  fixDropElim({ rounds: sections.flatMap((s) => s.rounds) });
  return { sections, crossConnectors };
}

// 더블 엘리미네이션 탈락(elim) 보정 — 상위 대진 패배팀은 하위 대진으로 강등되므로 탈락이 아니다.
//   규칙: 어떤 팀이 이후(더 오른쪽) 컬럼에 다시 등장하면 그 슬롯의 elim(빨강)을 해제한다.
//   (LCK PO의 clearUB2Elim과 동일 취지 — 실제로 어디에도 다시 안 나오는 팀만 탈락 표시)
function fixDropElim(bracket) {
  if (!bracket?.rounds) return bracket;
  const lastCol = {};
  bracket.rounds.forEach((r, ci) => r.matches.forEach((m) => {
    for (const s of [m.a, m.b]) if (s?.short) lastCol[s.short] = Math.max(lastCol[s.short] ?? -1, ci);
  }));
  bracket.rounds.forEach((r, ci) => r.matches.forEach((m) => {
    // 상위권(upper) 매치 패배는 하위권으로 강등되므로 절대 탈락이 아니다.
    //   (상위·하위 같은 라운드가 같은 컬럼인 배치에서도 안전하게 처리)
    const upper = /상위권|upper|\bUB\b/i.test(m.title || '');
    for (const s of [m.a, m.b]) if (s?.elim && s.short && (upper || lastCol[s.short] > ci)) delete s.elim;
  }));
  return bracket;
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

// 예정 경기 일정 — getSchedule에서 미완료 경기의 match.id → 시작시각(ISO) 맵.
async function fetchScheduleTimes(leagueId) {
  const out = {};
  try {
    const { data } = await api('getSchedule', { leagueId });
    for (const e of data.schedule.events || []) {
      if (e.type === 'match' && e.state !== 'completed' && e.match?.id && e.startTime) out[e.match.id] = e.startTime;
    }
  } catch { /* 무시 */ }
  return out;
}
// 대진표의 미진행 경기에 일정(KST) 라벨을 붙인다.
function attachSchedule(bracket, timeMap) {
  if (!bracket?.rounds) return bracket;
  const fmt = (iso) => {
    const kst = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()} ${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}`;
  };
  for (const r of bracket.rounds) for (const m of r.matches) {
    const played = m.a?.win || m.a?.msi || m.b?.win || m.b?.msi || (m.a?.score != null && m.b?.score != null && m.a.score !== m.b.score);
    if (!played && m.id && timeMap[m.id]) m.time = fmt(timeMap[m.id]);
  }
  return bracket;
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

  // LEC/LCS/CBLOL: 플레이오프(6팀 더블 엘리) 대진표를 API에서 추출 — 진행 중 라이브 갱신용
  let playoffs = null;
  if (['lec', 'lcs', 'cblol'].includes(lg.key)) {
    const poStage = standing.stages.find((s) => s.slug === 'playoffs');
    const cols = poStage?.sections?.[0]?.columns;
    if (cols?.length) {
      const raw = bracketFromColumns(cols);
      // LEC는 상위 1R=1v4/2v3 구조(라운드별 컬럼), LCS/CBLOL은 LCK PO식(시드 1·2 부전승)
      //   단, LEC가 8팀(예선 1R + 상위 2R + 하위 3R) 포맷이면 전용 그리드(lec8DELayout) 우선.
      const lec8 = lg.key === 'lec' ? lec8DELayout(raw) : raw;
      playoffs = lec8 !== raw ? lec8 : (lg.key === 'lec' ? lecPoLayout(raw) : lckPoStyleLayout(raw));
      // 진행 중 대진: 미진행 경기에 예정 일정(KST) 표기
      const times = await fetchScheduleTimes(lg.id);
      attachSchedule(playoffs, times);
    }
  }

  return { tour, rows, mismatches, stage, road, roadMsiTeam, playoffs };
}

// 2026 LCK CUP (= lck_split_1_2026) — 별도 토너먼트(그룹 스테이지 2개조 + 플레이-인 + 플레이오프).
//   이미 종료된 대회. 그룹 순위표 + 플레이-인/플레이오프 대진표 + 최종순위를 구성해 반환한다.
async function buildLckCup(leagueId) {
  const tjson = await api('getTournamentsForLeague', { leagueId });
  const tours = tjson.data.leagues[0].tournaments || [];
  const cup = tours.find((t) => /split_1_2026/.test(t.slug));
  if (!cup) return null;
  const st = (await api('getStandingsV3', { tournamentId: cup.id })).data?.standings?.[0];
  if (!st) return null;
  // 그룹 스테이지 순위 (알파조/오메가조) — API 공식 ordinal 사용(타이브레이크 반영)
  const gs = st.stages.find((s) => s.slug === 'group_stage');
  const rows = [];
  for (const sec of gs?.sections || [])
    for (const r of sec.rankings || [])
      for (const t of r.teams)
        rows.push({ rank: r.ordinal, team: t.code, w: t.record.wins, l: t.record.losses, group: sec.name });
  // 플레이-인 / 플레이오프 대진표
  const colsOf = (slug) => st.stages.find((s) => s.slug === slug)?.sections?.[0]?.columns;
  const piCols = colsOf('play_ins'), poCols = colsOf('playoffs');
  const playin = piCols?.length ? bracketFromColumns(piCols) : null;
  // 플레이오프(6팀 더블 엘리)는 LCK PO 대진표 모양(그리드)으로 재배치
  const playoffs = poCols?.length ? lckPoStyleLayout(bracketFromColumns(poCols)) : null;
  const finalStandings = cupFinalStandings(rows, playin, playoffs);
  const champ = finalStandings[0]?.team;
  return {
    stage: `2026 LCK CUP · 종료${champ ? ` · 우승 ${champ}` : ''}`,
    format: '10팀 · 2개조 그룹 스테이지 → 플레이-인 → 플레이오프',
    rows,
    playin,
    playoffs,
    finalStandings,
  };
}

// LCK CUP 최종순위: 플레이오프 도달 단계(패배 라운드)로 상위 6팀, 이어서 플레이-인,
//   마지막으로 그룹 성적 순. 플레이오프 결승 승자가 우승.
function cupFinalStandings(rows, playin, playoffs) {
  const wl = (m) => {
    const a = m.a, b = m.b;
    if (a?.win || a?.msi) return { w: a.short, l: b?.short };
    if (b?.win || b?.msi) return { w: b.short, l: a?.short };
    if (a && b && a.score != null && b.score != null && a.score !== b.score) {
      const A = a.score > b.score;
      return { w: A ? a.short : b.short, l: A ? b.short : a.short };
    }
    return {};
  };
  // 각 팀이 마지막으로 등장한(=가장 깊은) 라운드와 그 경기 승패
  const lastOf = (bracket) => {
    const info = {};
    bracket?.rounds?.forEach((r, ri) =>
      r.matches.forEach((m) => {
        for (const slot of [m.a, m.b]) {
          if (slot?.short && (!info[slot.short] || info[slot.short].ri <= ri)) info[slot.short] = { ri, won: null };
        }
        const { w, l } = wl(m);
        if (w && info[w]?.ri === ri) info[w].won = true;
        if (l && info[l]?.ri === ri) info[l].won = false;
      })
    );
    return info;
  };
  const po = lastOf(playoffs), pi = lastOf(playin);
  const rec = Object.fromEntries(rows.map((r) => [r.team, r]));
  const gd = (t) => (rec[t] ? rec[t].w - rec[t].l : -99);
  // tier: 3=플레이오프, 2=플레이-인, 1=그룹만. 정렬 키 [tier, depth, won]
  const key = (t) => {
    if (po[t]) return [3, po[t].ri, po[t].won ? 1 : 0];
    if (pi[t]) return [2, pi[t].ri, pi[t].won ? 1 : 0];
    return [1, 0, 0];
  };
  const order = rows
    .map((r) => r.team)
    .sort((x, y) => {
      const kx = key(x), ky = key(y);
      for (let i = 0; i < 3; i++) if (kx[i] !== ky[i]) return ky[i] - kx[i];
      return gd(y) - gd(x) || rec[x].rank - rec[y].rank;
    });
  return order.map((team, i) => ({
    rank: i + 1,
    team,
    note: i === 0 ? '우승' : i === 1 ? '준우승' : i === 2 ? '3위' : '',
  }));
}

// 범용 최종순위 — 여러 대진(스위스/플레이-인/플레이오프)을 낮은→높은 중요도 순으로 받아,
//   가장 깊이(=우승에 가까운 라운드) 도달한 팀부터 정렬. 대진 밖 팀은 정규순위 순.
function splitFinalStandings(rows, bracketsOrdered, finished) {
  const wl = (m) => {
    const a = m.a, b = m.b;
    if (a?.win || a?.msi) return { w: a.short, l: b?.short };
    if (b?.win || b?.msi) return { w: b.short, l: a?.short };
    if (a && b && a.score != null && b.score != null && a.score !== b.score) {
      const A = a.score > b.score; return { w: A ? a.short : b.short, l: A ? b.short : a.short };
    }
    return {};
  };
  // 브래킷의 모든 매치(rounds 또는 sections 구조 모두 지원)
  const allMatches = (br) => (Array.isArray(br?.sections) ? br.sections.flatMap((s) => s.rounds || []) : (br?.rounds || [])).flatMap((r) => r.matches || []);
  // 각 팀의 '최종 진출 깊이(depth)'와 그 매치 승패를 산출. sections(더블 엘리 등)는
  //   같은 섹션 내 라운드 순서 + crossConnectors 방향으로 최장경로 depth를 계산해 탈락 순서를 정한다.
  const lastOf = (bracket) => {
    const nodes = [];
    const push = (si, ri, mi, m) => { if (m && (m.a || m.b)) nodes.push({ id: `${si}-${ri}-${mi}`, si, ri, m }); };
    if (Array.isArray(bracket?.sections)) bracket.sections.forEach((s, si) => (s.rounds || []).forEach((r, ri) => r.matches.forEach((m, mi) => push(si, ri, mi, m))));
    else (bracket?.rounds || []).forEach((r, ri) => r.matches.forEach((m, mi) => push(0, ri, mi, m)));
    const ids = new Set(nodes.map((n) => n.id));
    const preds = {}; nodes.forEach((n) => (preds[n.id] = []));
    const addEdge = (f, t) => { if (ids.has(f) && ids.has(t)) preds[t].push(f); };
    // 같은 섹션 내: 라운드 ri의 모든 매치 → 다음(존재하는) 라운드의 모든 매치
    const bySec = {}; nodes.forEach((n) => { (bySec[n.si] = bySec[n.si] || {}); (bySec[n.si][n.ri] = bySec[n.si][n.ri] || []).push(n.id); });
    for (const si of Object.keys(bySec)) { const rs = Object.keys(bySec[si]).map(Number).sort((a, b) => a - b); for (let i = 0; i < rs.length - 1; i++) for (const f of bySec[si][rs[i]]) for (const t of bySec[si][rs[i + 1]]) addEdge(f, t); }
    // 섹션 간: crossConnectors 방향
    for (const c of bracket?.crossConnectors || []) addEdge(`${c[0]}-${c[1]}-${c[2]}`, `${c[4]}-${c[5]}-${c[6]}`);
    // 최장경로 depth (DAG · 메모 DFS)
    const depth = {}; const calc = (id) => { if (depth[id] != null) return depth[id]; depth[id] = 0; let mx = 0; for (const p of preds[id]) mx = Math.max(mx, calc(p) + 1); return (depth[id] = mx); };
    nodes.forEach((n) => calc(n.id));
    const info = {};
    for (const n of nodes) {
      const dep = depth[n.id]; const { w, l } = wl(n.m);
      for (const slot of [n.m.a, n.m.b]) { const t = slot?.short; if (!t) continue; if (!info[t] || info[t].depth < dep) info[t] = { depth: dep, won: t === w ? true : t === l ? false : null }; }
    }
    const maxDepth = nodes.reduce((mx, n) => Math.max(mx, depth[n.id]), -1);
    return { info, finalMatch: nodes.find((n) => depth[n.id] === maxDepth)?.m };
  };
  const results = (bracketsOrdered || []).map(lastOf);
  const infos = results.map((r) => r.info);
  // 정규 순위가 없는 포맷(스위스 등)은 대진 참가팀으로 팀 목록을 만든다.
  let teamRows = rows;
  if (!teamRows.length) {
    const seen = new Set();
    teamRows = [];
    for (const b of bracketsOrdered || []) for (const m of allMatches(b)) for (const s of [m.a, m.b]) {
      if (s?.short && !seen.has(s.short)) { seen.add(s.short); teamRows.push({ rank: teamRows.length + 1, team: s.short, w: 0, l: 0 }); }
    }
  }
  const rec = Object.fromEntries(teamRows.map((r) => [r.team, r]));
  const gd = (t) => (rec[t] ? (rec[t].w || 0) - (rec[t].l || 0) : -99);
  const key = (t) => {
    for (let i = infos.length - 1; i >= 0; i--) if (infos[i][t]) return [i + 2, infos[i][t].depth, infos[i][t].won ? 1 : 0];
    return [1, 0, 0];
  };
  const order = teamRows.map((r) => r.team).sort((x, y) => {
    const kx = key(x), ky = key(y);
    for (let i = 0; i < 3; i++) if (kx[i] !== ky[i]) return ky[i] - kx[i];
    return gd(y) - gd(x) || (rec[x].rank - rec[y].rank);
  });
  const full = order.map((team, i) => ({ rank: i + 1, team, note: i === 0 ? '우승' : i === 1 ? '준우승' : i === 2 ? '3위' : '' }));
  // 대회 종료 여부: 마지막 대진의 최종(최장경로) 경기 승자가 결정됐으면 종료.
  const finalMatch = results.at(-1)?.finalMatch;
  const done = !!(finalMatch && wl(finalMatch).w);
  // 종료된 대회는 결승 슬롯이 API에 미기재(예: LTA 지역결승이 아메리카 스테이지로 분리)여도 전체 순위를 그대로 노출.
  if (done || finished) return full;
  // 진행 중: 아직 탈락하지 않은(=최종순위 미확정) 대진 생존팀은 제외하고, 확정된 팀만 반환.
  const eliminated = new Set(), inBracket = new Set();
  for (const b of bracketsOrdered || []) for (const m of allMatches(b)) for (const s of [m.a, m.b]) {
    if (s?.short) { inBracket.add(s.short); if (s.elim) eliminated.add(s.short); }
  }
  const aliveSet = new Set([...inBracket].filter((t) => !eliminated.has(t)));
  return full.filter((e) => !aliveSet.has(e.team)); // 확정 팀만(생존팀 제외). 순위는 실제 확정 위치 유지.
}

// 범용 완료 스플릿 빌더 — 임의의 2026 토너먼트(slug)에서 정규/그룹 순위 + 모든 대진 스테이지 + 최종순위 구성.
//   포맷 무관(단일표/그룹/스위스/플레이-인/플레이오프). 각 대진은 bracketFromColumns(흐름 배치).
async function buildSplit(leagueId, slug) {
  const tjson = await api('getTournamentsForLeague', { leagueId });
  const tour = (tjson.data.leagues[0].tournaments || []).find((t) => t.slug === slug);
  if (!tour) return null;
  const st = (await api('getStandingsV3', { tournamentId: tour.id })).data?.standings?.[0];
  if (!st) return null;
  // 정규/그룹 스테이지 = rankings 가장 많은 스테이지
  const rankCount = (s) => s.sections.reduce((a, x) => a + (x.rankings?.length || 0), 0);
  const regStage = st.stages.filter((s) => rankCount(s) > 0).sort((a, b) => rankCount(b) - rankCount(a))[0];
  const rows = [];
  const multi = regStage && regStage.sections.length > 1;
  for (const sec of regStage?.sections || []) for (const r of sec.rankings || []) for (const t of r.teams) {
    const row = { rank: r.ordinal, team: t.code, w: t.record.wins, l: t.record.losses };
    if (multi) row.group = sec.name;
    rows.push(row);
  }
  // 대진 스테이지들 (columns 보유) — API 순서 유지(플레이오프가 마지막)
  const brackets = [];
  for (const s of st.stages) {
    const cols = (s.sections || []).flatMap((sec) => sec.columns || []);
    if (!cols.length) continue;
    let b = fixDropElim(bracketFromColumns(cols));
    // 기사의 길(1·2R 한 컬럼) 레이아웃은 실제 사다리(2·3라운드 존재)일 때만. 단일 컬럼 다경기(2025 Knights Rivals 등)는 기본 배치 유지.
    const isKnightLadder = /knights/i.test(s.slug) && (b.rounds || []).flatMap((r) => r.matches).some((m) => /2라운드|2R|3라운드|3R/i.test(m.title || ''));
    if (isKnightLadder) b = knightsLayout(b);
    else if (s.slug === 'road_to_msi') b = roadToMsiLayout(b); // Road to MSI: 2026과 동일 템플릿
    else if (s.slug === 'playoffs') {
      const cnt = (re) => (b.rounds || []).flatMap((r) => r.matches).filter((m) => re.test(m.title || '')).length;
      const lec8 = lec8DELayout(b); // 8팀(예선 1R + 상위 2R + 하위 3R) — 매칭 시 그리드로 재배치, 아니면 원본 반환
      const lckCup = lckCupLayout(b); // 2025 LCK CUP식(상위 1·2·3R + 하위권 대진 2경기 + 결승)
      const lta2 = ltaPlayoffs2Layout(b); // 2025 LTA Split2/Etapa2 PO(상위4강/하위8강, rounds 2·3·1·1·1)
      const lckPo24 = lckPo2024Layout(b); // 2023~2024 LCK PO(rounds 2·2·2·1·1, 3라운드=승자조+패자조)
      const lplSp = lplSpring24Layout(b); // 2021~2024 LPL Spring/Summer형(rounds 2·2·2·2·2·1·1)
      if (cnt(/상위권.*(8강|1라운드)/) >= 4) b = msi8DELayout(b);  // 8팀 더블 엘리 → MSI 브래킷 스테이지(2섹션)
      else if (lec8 !== b) b = lec8;                               // 8팀 LEC/LPL식 (예선 1라운드 + 상위 2R + 하위 3R)
      else if (lckCup !== b) b = lckCup;                           // 2025 LCK CUP식 (상위 3R + 하위권 대진 2경기)
      else if (lta2 !== b) b = lta2;                               // 2025 LTA Split2/Etapa2 PO (상위4강/하위8강 컴팩트)
      else if (lplSp !== b) b = lplSp;                             // 2021~2024 LPL Spring/Summer형 (상위/하위 대진 압축)
      else if (lckPo24 !== b) b = lckPo24;                         // 2023~2024 LCK PO (승자조 3R 중앙·패자조 3R/4R 하위)
      else if (cnt(/상위권.*결승/) >= 1) b = lckPoStyleLayout(b);  // 6팀 LCK PO식 (상위 8강/4강/결승, 3라운드 upper)
      else if (cnt(/상위권.*(8강|1라운드)/) >= 2) b = lecPoLayout(b); // 6팀 LEC식 (상위 2라운드, 같은 라운드=같은 컬럼)
    }
    else { // 구조 매칭 시 전용 그리드로 재배치(각 함수가 자체 구조 검증 → 미매칭이면 원본 반환)
      let x = ltaRound2Layout(b);                       // 2025 LTA Split3/Etapa3 round_2
      if (x === b) x = ltaPlayoffs2Layout(b);           // 6팀 DE(상위4강/하위8강) — LEC 시즌 파이널(regional_finals) 등
      if (x === b) x = lcpQualifyingLayout(b);          // 2025 LCP 퀄리파잉 시리즈(regional_qualifier)
      if (x === b) x = de4Layout(b);                    // 4팀 더블 엘리(2팀 진출): MSI PI·LCP 그룹 시딩·FST 그룹 등 공통 템플릿
      if (x !== b) b = x;
    }
    // 8팀 싱글 엘리미네이션(8강 4 → 4강 2 → 결승 1)은 2026 Worlds 녹아웃과 동일 그리드로 통일.
    if (!b.sections && !b.totalRows && Array.isArray(b.rounds)) {
      const sz = b.rounds.map((r) => (r.matches || []).length);
      const singleElim8 = sz[0] === 4 && sz.length >= 2 && sz.every((n, i) => i === 0 || n === sz[i - 1] / 2) && sz[sz.length - 1] === 1;
      if (singleElim8) b = applySingleElimLayout(b);
    }
    brackets.push({ slug: s.slug, name: s.name, bracket: b });
  }
  // 정규 순위가 없는 포맷(스위스 등)은 대진 참가팀으로 팀 목록을 만든다(최종순위 산출 전용, rows는 비워둠)
  let finalRows = rows;
  if (!finalRows.length) {
    finalRows = [];
    const seen = new Set();
    // rounds/sections 구조 모두에서 매치 추출
    const brMatches = (br) => (Array.isArray(br?.sections) ? br.sections.flatMap((s) => s.rounds || []) : (br?.rounds || [])).flatMap((r) => r.matches || []);
    for (const b of brackets) for (const m of brMatches(b.bracket)) for (const slot of [m.a, m.b]) {
      if (slot?.short && !seen.has(slot.short)) { seen.add(slot.short); finalRows.push({ rank: finalRows.length + 1, team: slot.short, w: 0, l: 0 }); }
    }
  }
  // 선발전(regional_qualifier/finals)은 별도 진출전이라 스플릿 최종순위 산출에서 제외(마지막 브래킷이 순위를 지배하는 문제 방지).
  const fsBrackets = brackets.filter((b) => !/regional_qualifier|regional_finals/.test(b.slug || '')).map((b) => b.bracket);
  const finished = tour.endDate < new Date().toISOString().slice(0, 10);
  const finalStandings = finalRows.length ? splitFinalStandings(finalRows, fsBrackets, finished) : [];
  return { name: st.name, rows, brackets, finalStandings, finished };
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
    const { tour, rows, mismatches, stage, road, roadMsiTeam, playoffs } = await buildLeague(lg);
    // 기존 수동 키(Road to MSI 등)를 보존하기 위해 통째로 덮어쓰지 않고 병합
    const prev = data.standings[lg.key] || {};
    data.standings[lg.key] = { ...prev, [lg.sub]: { ...(prev[lg.sub] || {}), stage, rows, ...(playoffs ? { playoffs } : {}) } };
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

// 2026 LCK CUP (Split 1) — LCK 세부탭 'LCK CUP'에 그룹/대진/최종순위 저장
try {
  const cup = await buildLckCup('98767991310872058');
  if (cup) {
    renameGroups(cup.rows, 'lck|LCK CUP');
    data.standings.lck = data.standings.lck || {};
    data.standings.lck['LCK CUP'] = cup;
    console.log(`LCK CUP: ${cup.rows.length}팀 · 우승 ${cup.finalStandings[0]?.team} · 대진 PI ${cup.playin?.rounds?.length || 0}R / PO ${cup.playoffs?.rounds?.length || 0}R`);
  }
} catch (e) {
  console.warn(`LCK CUP 실패 — 기존 값 유지: ${e.message}`);
}

// 2026 완료 스플릿 — 지역 리그의 과거 스플릿을 세부탭에 채운다(정규/그룹 순위 + 대진 + 최종순위).
const PAST_SPLITS = [
  { key: 'lpl', sub: 'Split 1', league: '98767991314006698', slug: 'lpl_split_1_2026' },
  { key: 'lpl', sub: 'Split 2', league: '98767991314006698', slug: 'lpl_split_2_2026' },
  { key: 'lec', sub: 'Versus', league: '98767991302996019', slug: 'lec_split_1_2026' },
  { key: 'lec', sub: 'Spring', league: '98767991302996019', slug: 'lec_split_2_2026' },
  { key: 'lcs', sub: 'Lock-In', league: '98767991299243165', slug: 'lcs_split_1_2026' },
  { key: 'lcs', sub: 'Spring', league: '98767991299243165', slug: 'lcs_split_2_2026' },
  { key: 'cblol', sub: 'Copa', league: '98767991332355509', slug: 'cblol_split_1_2026' },
  { key: 'cblol', sub: 'Split 1', league: '98767991332355509', slug: 'cblol_split_2_2026' },
  { key: 'lcp', sub: 'Split 1', league: '113476371197627891', slug: 'lcp_split_1_2026' },
  { key: 'lcp', sub: 'Split 2', league: '113476371197627891', slug: 'lcp_split_2_2026' },
];
for (const ps of PAST_SPLITS) {
  try {
    const split = await buildSplit(ps.league, ps.slug);
    if (split) {
      renameGroups(split.rows, `${ps.key}|${ps.sub}`);
      data.standings[ps.key] = data.standings[ps.key] || {};
      data.standings[ps.key][ps.sub] = { ...(data.standings[ps.key][ps.sub] || {}), ...split };
      console.log(`${ps.key.toUpperCase()} ${ps.sub}: ${split.rows.length}팀 · 대진 ${split.brackets.length}개 · 우승 ${split.finalStandings[0]?.team}`);
    }
  } catch (e) {
    console.warn(`${ps.key.toUpperCase()} ${ps.sub} 실패 — 기존 값 유지: ${e.message}`);
  }
}

// 2026 First Stand — 대진(그룹 스테이지 + 플레이오프) + 최종순위(GPR fst 랭크 8팀 기준)
try {
  const fstSplit = await buildSplit('113464388705111224', 'first_stand_2026');
  if (fstSplit) {
    const gprTeams = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'data', 'gprTeams.json'), 'utf8')).teams;
    const fstRanked = gprTeams.filter((t) => t.fst).sort((a, b) => a.fst - b.fst);
    const finalStandings = fstRanked.map((t) => ({
      rank: t.fst, team: t.short,
      note: t.fst === 1 ? '우승' : t.fst === 2 ? '준우승' : t.fst === 3 ? '3위' : '',
    }));
    // 그룹 스테이지: 하위권 4강을 1라운드 컬럼으로 / 플레이오프: '녹아웃 스테이지'로 표기 + 4강 시드 라벨
    const FST_SEED = { GEN: 'B조 1위', G2: 'A조 2위', BLG: 'A조 1위', JDG: 'B조 2위' };
    for (const br of fstSplit.brackets) {
      if (br.slug === 'group_stage') br.bracket = de4Layout(br.bracket); // 4팀 더블 엘리(2팀 진출) 공통 템플릿(MSI PI식)
      if (br.slug === 'playoffs') {
        br.label = '녹아웃 스테이지';
        for (const r of br.bracket.rounds || []) for (const m of r.matches || []) {
          if (!/4강/.test(m.title || '')) continue;
          for (const s of [m.a, m.b]) if (s?.short && FST_SEED[s.short]) s.seed = FST_SEED[s.short];
        }
      }
    }
    data.standings.fst = { name: fstSplit.name || '2026 First Stand', brackets: fstSplit.brackets, finalStandings };
    console.log(`FST: 대진 ${fstSplit.brackets.length}개 · 우승 ${finalStandings[0]?.team}`);
  }
} catch (e) {
  console.warn(`FST 실패 — 기존 값 유지: ${e.message}`);
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

// Worlds 참가팀 시드 계산 (LCK 4 + LPL 4 + LEC 3 + LCS 3 + LCP 3 + CBLOL 2 = 19팀).
//   플레이-인 4팀: LPL#4·LCS#3·LEC#3·LCP#3(→CBLOL#2 대체). 나머지 15팀 스위스 직행.
//   각 리그 최종 순위에서 자동 채움. LEC/LCS/CBLOL은 사용자 제공, LCP는 대회 규정 하드코딩.
//   ⚠️ 국내 리그(LCK PO·LPL Split 3) 처리 이후에 호출해야 최신 최종순위가 반영된다.
function computeWorldsQualifiers(data) {
  const winnerOf = (m) => {
    if (!m) return null;
    if (m.a?.win || m.a?.msi) return m.a.short;
    if (m.b?.win || m.b?.msi) return m.b.short;
    if (m.a?.score != null && m.b?.score != null && m.a.score !== m.b.score) return m.a.score > m.b.score ? m.a.short : m.b.short;
    return null;
  };
  const loserOf = (m) => { const w = winnerOf(m); if (!w) return null; return m.a?.short === w ? m.b?.short : m.a?.short; };
  // LCK 최종 순위: #1 = GF 승자, #2 = GF 패자, #3 = Lower Finals 패자, #4 = LB R3 패자.
  //   재구성 후 rounds: rounds[2]=UB R3(0)·LB R3(1) / rounds[3]=Lower Finals(0) / rounds[4]=Grand Finals(0).
  const lckPO = data.standings.lck?.LCK?.playoffs;
  const lck1 = winnerOf(lckPO?.rounds?.[4]?.matches?.[0]);
  const lck2 = loserOf(lckPO?.rounds?.[4]?.matches?.[0]);
  const lck3 = loserOf(lckPO?.rounds?.[3]?.matches?.[0]);
  const lck4 = loserOf(lckPO?.rounds?.[2]?.matches?.[1]);
  // LPL: #1 = Split 3 우승, #2 = 챔피언십 포인트 1위(우승 제외), #3 = 대표선발전 1R M1 승자, #4 = 2R 승자.
  const lplPO = data.standings.lpl?.['Split 3']?.playoffs;
  const lpl1 = winnerOf(lplPO?.rounds?.[4]?.matches?.[0]);
  const lplPtsW = data.standings.lpl?.['대표 선발전']?.points || [];
  const lpl2 = lpl1 ? (lplPtsW.find((p) => p.team !== lpl1)?.team || null) : null;
  const lplRQ2 = data.standings.lpl?.['대표 선발전']?.qualifier;
  const lpl3 = winnerOf(lplRQ2?.rounds?.[0]?.matches?.[0]);
  const lpl4 = winnerOf(lplRQ2?.rounds?.[1]?.matches?.[0]);
  // LEC/LCS/CBLOL: 각 리그 현재(마지막) 스플릿 플레이오프 최종순위 N위 = 시드 #N. 대회 진행에 따라 실시간 반영.
  const curSub = Object.fromEntries(LEAGUES.map((l) => [l.key, l.sub]));
  const seedFromFinal = (key, rank) => data.standings[key]?.[curSub[key]]?.finalStandings?.find((r) => r.rank === rank)?.team || null;
  const seedMap = {
    'LCK #1': lck1, 'LCK #2': lck2, 'LCK #3': lck3, 'LCK #4': lck4,
    'LPL #1': lpl1, 'LPL #2': lpl2, 'LPL #3': lpl3, 'LPL #4': lpl4,
    'LEC #1': seedFromFinal('lec', 1), 'LEC #2': seedFromFinal('lec', 2), 'LEC #3': seedFromFinal('lec', 3),
    'LCS #1': seedFromFinal('lcs', 1), 'LCS #2': seedFromFinal('lcs', 2), 'LCS #3': seedFromFinal('lcs', 3),
    'LCP #1': 'TSW', 'LCP #2': 'CFO', 'LCP #3': 'MVK',
    'CBLOL #1': seedFromFinal('cblol', 1), 'CBLOL #2': seedFromFinal('cblol', 2),
  };
  const swissSeeds = ['LCK #1','LCK #2','LCK #3','LCK #4','LPL #1','LPL #2','LPL #3','LPL #4','LEC #1','LEC #2','LCS #1','LCS #2','LCP #1','LCP #2','CBLOL #1'];
  const playinSeeds = ['LCS #3','LEC #3','LCP #3','CBLOL #2'];
  const buildQ = (seeds, stage) => seeds.map((seed) => {
    const team = seedMap[seed];
    return team ? { seed, short: team, stage } : { seed, label: seed, stage };
  });
  return [...buildQ(swissSeeds, 'swiss'), ...buildQ(playinSeeds, 'playin')];
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
    const qualifiers = computeWorldsQualifiers(data);
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
      // Lower Finals·Grand Finals: API가 slot1=LB R3 승자/slot2=UB R3 패자, slot1=LF 승자/slot2=UB R3 승자 순서로
      //   반환하는데 UI에서는 UB R3 계열을 상단에 두어야 자연스러워 슬롯 스왑 후 라벨 부여.
      if (lowerFinals?.a && lowerFinals?.b) { const t = lowerFinals.a; lowerFinals.a = lowerFinals.b; lowerFinals.b = t; }
      if (grandFinals?.a && grandFinals?.b) { const t = grandFinals.a; grandFinals.a = grandFinals.b; grandFinals.b = t; }
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
      // LPL Split 3 플레이오프 5라운드 구조 (MATCH 1~12):
      //   r4m0=MATCH 12(결승) / r3m0=MATCH 11 / r2m1=MATCH 10 / r1m2=MATCH 7·r1m3=MATCH 8 / r0m2=MATCH 5·r0m3=MATCH 6
      const gfM = po?.rounds?.[4]?.matches?.[0];
      const gf = winnerOf(gfM);
      if (gf.w) {
        s3Rank[0] = gf.w; s3Rank[1] = gf.l;                          // 우승·준우승
        s3Rank[2] = winnerOf(po?.rounds?.[3]?.matches?.[0]).l;      // MATCH 11 패자 = 3위
        s3Rank[3] = winnerOf(po?.rounds?.[2]?.matches?.[1]).l;      // MATCH 10 패자 = 4위
        s3Rank[4] = winnerOf(po?.rounds?.[1]?.matches?.[2]).l;      // MATCH 7 패자 = 5위
        s3Rank[5] = winnerOf(po?.rounds?.[1]?.matches?.[3]).l;      // MATCH 8 패자 = 6위
        s3Rank[6] = winnerOf(po?.rounds?.[0]?.matches?.[2]).l;      // MATCH 5 패자 = 7위
        s3Rank[7] = winnerOf(po?.rounds?.[0]?.matches?.[3]).l;      // MATCH 6 패자 = 8위
      }
      s3Rank.forEach((t, i) => { if (t && S3_PT[i] != null) bump(t, 'split3', S3_PT[i]); });
      const points = Object.values(pointsMap).map((p) => ({
        team: p.team, split1: p.split1 || 0, split2: p.split2 || 0, split3: p.split3 || 0,
        total: (p.split1 || 0) + (p.split2 || 0) + (p.split3 || 0),
      })).sort((a, b) => b.total - a.total);
      // 대표 선발전 대진: Split 3 우승(LPL #1)·챔피언십 포인트 1위(LPL #2)를 제외한 총점 상위 4팀.
      //   시드 1~4. 1R M1 = 시드1 vs 시드2(승자 LPL #3), 1R M2 = 시드3 vs 시드4(패자 LPL #6),
      //   2R = 1R M1 패자 vs 1R M2 승자(승자 LPL #4, 패자 LPL #5). 경기 결과가 있으면 반영.
      const lplChamp = gf.w; // Split 3 우승 = LPL #1
      const seed4 = points.filter((p) => p.team !== lplChamp).slice(1, 5).map((p) => p.team); // 포인트 1위(LPL #2) 제외 다음 4팀
      const qualifier = byKind.qualifier;
      if (qualifier?.rounds?.length >= 2 && seed4.length === 4) {
        const [s1, s2, s3, s4] = seed4;
        const m1 = qualifier.rounds[0].matches[0];
        const m2 = qualifier.rounds[0].matches[1];
        const r2 = qualifier.rounds[1].matches[0];
        const outcome = (m) => winnerOf(m);
        const setSlot = (slot, short, seed) => { if (slot) { slot.seed = seed; if (short && !slot.short) slot.short = short; } };
        // 1R 팀 시드 배치 (경기 결과의 short가 이미 있으면 유지)
        if (m1) { setSlot(m1.a, s1, `포인트 2위`); setSlot(m1.b, s2, `포인트 3위`); m1.title = '1라운드 M1'; }
        if (m2) { setSlot(m2.a, s3, `포인트 4위`); setSlot(m2.b, s4, `포인트 5위`); m2.title = '1라운드 M2'; }
        // 2R 슬롯: 1R M1 패자 vs 1R M2 승자. API의 실제 경기 결과(점수·승패)는 팀 기준으로 보존.
        if (r2) {
          r2.title = '2라운드';
          const m1o = outcome(m1), m2o = outcome(m2);
          // API 원본 슬롯(순서 무관)을 팀 약칭 기준으로 매핑 — 완료 경기의 score/win/elim 유지.
          const resByShort = {};
          for (const s of [r2.a, r2.b]) if (s?.short) resByShort[s.short] = s;
          const rebuild = (seed, short) => {
            const src = short ? resByShort[short] : null;
            const o = { seed };
            if (short) o.short = short;
            if (src) { if (src.score != null) o.score = src.score; if (src.win) o.win = true; if (src.msi) o.msi = true; if (src.elim) o.elim = true; }
            return o;
          };
          r2.a = rebuild('1R M1 패자', m1o.l);
          r2.b = rebuild('1R M2 승자', m2o.w);
        }
      }
      data.standings.lpl['대표 선발전'] = {
        stage: '2026 LPL 대표 선발전',
        rows: [],
        qualifier,
        points,
        pointsNote: 'LPL 1시드=Split 3 우승 / 2시드=(1시드 제외) 포인트 합산 1등 / 대표 선발전=우승·포인트1위 제외 총점 상위 4팀. 1R M1 승자=3시드, 2R 승자=4시드, 2R 패자=5시드(DCGI), 1R M2 패자=6시드(DCGI)',
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
// DCGI LPL 시드 자동 채움 — 대표 선발전 결과: 5시드=2라운드 패자, 6시드=1라운드 M2 패자.
try {
  const dem = data.standings.demacia;
  const lplQual = data.standings.lpl?.['대표 선발전']?.qualifier;
  if (dem?.qualifiers && lplQual?.rounds) {
    const loserByTitle = (frag) => {
      for (const r of lplQual.rounds) for (const m of r.matches) {
        if (!(m.title || '').includes(frag)) continue;
        const win = (m.a?.win || m.a?.msi) ? m.a?.short
          : (m.b?.win || m.b?.msi) ? m.b?.short
            : (m.a?.score > m.b?.score ? m.a?.short : (m.b?.score > m.a?.score ? m.b?.short : null));
        if (!win) return null;
        return win === m.a?.short ? m.b?.short : m.a?.short;
      }
      return null;
    };
    const seedFill = { 'LPL #6': loserByTitle('1라운드 M2'), 'LPL #5': loserByTitle('2라운드') };
    let filled = 0;
    for (const qf of dem.qualifiers) {
      const t = seedFill[qf.seed];
      if (t && !qf.short) { qf.short = t; filled++; }
    }
    if (filled) console.log(`DCGI LPL 시드 자동 채움: ${filled}팀 (${Object.entries(seedFill).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ')})`);
  }
} catch (e) { console.warn(`DCGI LPL 시드 자동 채움 실패(무시): ${e.message}`); }

// DCGI LEC/LCS/CBLOL 시드 자동 채움 — 각 리그 현 시즌(마지막) 스플릿 플레이오프 최종순위 N위 = 시드 #N.
//   현재 스플릿은 LEAGUES(라이브 추적 대상)에서 파생 → 시즌 진행에 따라 자동 갱신.
try {
  const dem = data.standings.demacia;
  if (dem?.qualifiers) {
    const curSub = Object.fromEntries(LEAGUES.map((l) => [l.key, l.sub]));
    let filled = 0; const done = [];
    for (const qf of dem.qualifiers) {
      if (qf.short) continue;
      const m = (qf.seed || '').match(/^(LEC|LCS|CBLOL) #(\d+)$/);
      if (!m) continue;
      const key = m[1].toLowerCase(), rank = +m[2];
      const fs = data.standings[key]?.[curSub[key]]?.finalStandings;
      const row = fs?.find((r) => r.rank === rank);
      if (row?.team) { qf.short = row.team; filled++; done.push(`${qf.seed}=${row.team}`); }
    }
    if (filled) console.log(`DCGI LEC/LCS/CBLOL 시드 자동 채움: ${filled}팀 (${done.join(', ')})`);
  }
} catch (e) { console.warn(`DCGI LEC/LCS/CBLOL 시드 자동 채움 실패(무시): ${e.message}`); }

// Asian Games(국가 대항전) 대회 정보 — 사용자가 asiangames-data_2026 리포지토리에서 직접 관리.
//   8개국 2개조 싱글 라운드로빈(Bo3) → 4강 · 3·4위전 · 결승. 각 국가 Elo도 리포지토리에서 제공.
try {
  const AG_API = 'https://raw.githubusercontent.com/totaldu/asiangames-data_2026/main/asiangames.json';
  const res = await fetch(AG_API);
  if (res.ok) {
    const api = await res.json();
    const ag = data.standings.asiangames || (data.standings.asiangames = {});
    if (Array.isArray(api.teams)) ag.teams = api.teams;
    if (api.groups) ag.groups = api.groups;
    if (api.knockout) ag.knockout = api.knockout;
    if (api.format) ag.format = api.format;
    if (api.updatedAt) ag.apiUpdatedAt = api.updatedAt;

    // 조별 순위 계산 (승수 → 세트 득실 → 상대전적). 각 조 상위 2팀이 4강 진출.
    const codeName = Object.fromEntries((api.teams || []).map((t) => [t.code, t]));
    const standingsOf = (groupMatches) => {
      const rec = {};
      const ensure = (c) => (rec[c] = rec[c] || { code: c, w: 0, l: 0, sw: 0, sl: 0, h2h: {} });
      for (const m of groupMatches || []) {
        if (!m.a || !m.b) continue;
        ensure(m.a); ensure(m.b);
        if (m.scoreA == null || m.scoreB == null || m.scoreA === m.scoreB) continue;
        const aWin = m.scoreA > m.scoreB;
        const w = aWin ? m.a : m.b, l = aWin ? m.b : m.a;
        rec[w].w++; rec[l].l++;
        rec[m.a].sw += m.scoreA; rec[m.a].sl += m.scoreB;
        rec[m.b].sw += m.scoreB; rec[m.b].sl += m.scoreA;
        rec[w].h2h[l] = (rec[w].h2h[l] || 0) + 1;
      }
      return Object.values(rec).sort((x, y) => (y.w - x.w) || ((y.sw - y.sl) - (x.sw - x.sl)) || ((y.h2h[x.code] || 0) - (x.h2h[y.code] || 0)));
    };
    const gA = standingsOf(ag.groups?.A?.matches);
    const gB = standingsOf(ag.groups?.B?.matches);
    if (ag.groups?.A) ag.groups.A.standings = gA;
    if (ag.groups?.B) ag.groups.B.standings = gB;

    // 녹아웃 대진 자동 전파: A:1/B:2 등 조 순위 참조 + SF:W/SF:L 승패 참조.
    const koMatches = ag.knockout?.matches || [];
    const koById = Object.fromEntries(koMatches.map((m) => [m.id, m]));
    const groupSlot = { A: gA, B: gB };
    const resolveRef = (ref) => {
      if (!ref || typeof ref !== 'string') return null;
      const gm = ref.match(/^([AB]):(\d)$/);
      if (gm) { const arr = groupSlot[gm[1]]; return arr?.[+gm[2] - 1]?.code || null; }
      const km = ref.match(/^(\w+):(W|L)$/);
      if (km) {
        const src = koById[km[1]]; if (!src || !src.winner) return null;
        return km[2] === 'W' ? src.winner : (src.winner === src.a ? src.b : src.a);
      }
      return null;
    };
    for (const m of koMatches) {
      if (!m.a && m.prev?.a) { const t = resolveRef(m.prev.a); if (t) m.a = t; }
      if (!m.b && m.prev?.b) { const t = resolveRef(m.prev.b); if (t) m.b = t; }
    }
    const gc = (ag.groups?.A?.matches?.length || 0) + (ag.groups?.B?.matches?.length || 0);
    console.log(`Asian Games API 반영: 참가 ${api.teams?.length || 0}국 / 조별 ${gc}경기 / 녹아웃 ${koMatches.length}경기`);
  } else {
    console.warn(`Asian Games API 접근 실패: ${res.status}`);
  }
} catch (e) {
  console.warn(`Asian Games API 갱신 실패 — 기존 값 유지: ${e.message}`);
}
// AG 참가팀 기본값 — 리포지토리 데이터가 아직 없을 때 8개국 참가팀 + 임시 대진표를 표시.
//   (Worlds/DCGI처럼 실제 대진이 들어오기 전이라도 브래킷 구조를 TBD 슬롯으로 노출)
{
  const ag = data.standings.asiangames || (data.standings.asiangames = {});
  if (!ag.groups || ag.placeholder) { // API 실제 데이터가 없거나(placeholder) 아직 임시일 때 → 임시 대진표 갱신
    // 참가 8개국(조 배정 미정). 조 편성이 확정되지 않아 group·Elo·조별 대진은 비워 둔다.
    // 조 편성: A조 = 베트남·말레이시아·사우디아라비아·아랍에미리트 / B조 = 대한민국·중화 타이베이·인도·홍콩
    ag.teams = [
      { code: 'KOR', name: '대한민국', group: 'B' }, { code: 'VIE', name: '베트남', group: 'A' },
      { code: 'SAU', name: '사우디아라비아', group: 'A' }, { code: 'MYS', name: '말레이시아', group: 'A' },
      { code: 'TPE', name: '중화 타이베이', group: 'B' }, { code: 'HKG', name: '홍콩', group: 'B' },
      { code: 'IND', name: '인도', group: 'B' }, { code: 'UAE', name: '아랍에미리트', group: 'A' },
    ];
    ag.placeholder = true; // 임시 대진표임을 표시
    // 국가대표 로스터(수기) → 각 선수 소속팀 GPR 평균 = 국가 레이팅(녹아웃 예측용).
    const AG_ROSTERS = {
      KOR: ['Zeus', 'Canyon', 'Zeka', 'Faker', 'Gumayusi', 'Keria'],
      TPE: ['1Jiang', 'JunJia', 'HongQ', 'Doggo', 'ShiauC', 'Woody'],
      VIE: ['Kiaya', 'Pun', 'Hizto', 'Dire', 'Eddie', 'Taki'],
    };
    try {
      const rmap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'data', 'lolRosters.json'), 'utf8')).rosters;
      const gmap = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'data', 'gprTeams.json'), 'utf8')).teams.map((t) => [t.short, t]));
      const clubOf = (name) => { for (const [tm, ros] of Object.entries(rmap)) if ((ros.players || []).some((p) => p.name.toLowerCase() === name.toLowerCase())) return tm; return null; };
      for (const t of ag.teams) {
        const names = AG_ROSTERS[t.code]; if (!names) continue;
        t.players = names;
        const scores = names.map((n) => { const c = clubOf(n); return c && gmap[c] ? gmap[c].score : null; }).filter((s) => s != null);
        if (scores.length) t.rating = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }
      const rated = ag.teams.filter((t) => t.rating != null).map((t) => `${t.code} ${t.rating}`);
      console.log(`Asian Games 국가 레이팅(소속팀 GPR 평균): ${rated.join(', ')}`);
    } catch (e) { console.warn(`Asian Games 국가 레이팅 산출 실패(무시): ${e.message}`); }
    // 조 편성 미정 → A/B조 팀·대진 비움(순위표는 '조 편성 미정'으로 표기).
    ag.groups = { A: { matches: [] }, B: { matches: [] } };
    // 녹아웃: 4강(Bo3) · 결승/동메달(Bo5) — 팀 미정(각 조 순위 확정 후 채워짐).
    ag.knockout = {
      matches: [
        { id: 'SF1', a: null, b: null, format: 'Bo3', prev: { a: 'A:1', b: 'B:2' } },
        { id: 'SF2', a: null, b: null, format: 'Bo3', prev: { a: 'B:1', b: 'A:2' } },
        { id: 'FINAL', a: null, b: null, format: 'Bo5', prev: { a: 'SF1:W', b: 'SF2:W' } },
        { id: 'BRONZE', a: null, b: null, format: 'Bo5', prev: { a: 'SF1:L', b: 'SF2:L' } },
      ],
    };
    console.log('Asian Games: 참가 8개국(조 편성 미정) + 녹아웃 임시 대진표(TBD) 표시');
  }
}

// 2026 Esports World Cup (EWC) — API 미제공 · 수기. 16팀 · 4개조 더블 엘리(조별 2팀 진출) → 8강 싱글 엘리(+3위전). 우승 DK.
{
  const S = (short, seed, score, flag) => { const s = { short }; if (seed) s.seed = seed; if (score != null) s.score = score; if (flag) s[flag] = true; return s; };
  // 4팀 더블 엘리 조별 대진: 1·2경기 → 승자전·패자전 → 최종전. 승자전 승자=1위·최종전 승자=2위(msi=진출).
  //   de4Layout(4팀 더블 엘리 공통 템플릿)으로 배치 — MSI PI·FST·LCP 그룹과 동일한 모양.
  const grp = (r) => de4Layout({ rounds: [
    { matches: [{ title: '1경기', ...r.g1 }, { title: '2경기', ...r.g2 }] },
    { matches: [{ title: '승자전', ...r.wf }, { title: '패자전', ...r.lb }] },
    { matches: [{ title: '최종전', ...r.ff }] },
  ] }, { compact: true }); // 4개 조가 함께 나열 → 2컬럼 압축
  const groups = {
    A: grp({
      g1: { a: S('G2', '1시드', 1, 'win'), b: S('FUR', '4시드', 0) },
      g2: { a: S('AL', '2시드', 1, 'win'), b: S('DK', '3시드', 0) },
      wf: { a: S('G2', '1경기 승자', 0), b: S('AL', '2경기 승자', 1, 'msi') },
      lb: { a: S('FUR', '1경기 패자', 0, 'elim'), b: S('DK', '2경기 패자', 2, 'win') },
      ff: { a: S('G2', '승자전 패자', 0, 'elim'), b: S('DK', '패자전 승자', 2, 'msi') },
    }),
    B: grp({
      g1: { a: S('TS', '1시드', 0), b: S('SEN', '4시드', 1, 'win') },
      g2: { a: S('GEN', '2시드', 1, 'win'), b: S('KC', '3시드', 0) },
      wf: { a: S('SEN', '1경기 승자', 0), b: S('GEN', '2경기 승자', 1, 'msi') },
      lb: { a: S('TS', '1경기 패자', 1, 'elim'), b: S('KC', '2경기 패자', 2, 'win') },
      ff: { a: S('SEN', '승자전 패자', 0, 'elim'), b: S('KC', '패자전 승자', 1, 'msi') },
    }),
    C: grp({
      g1: { a: S('BLG', '1시드', 1, 'win'), b: S('MKOI', '4시드', 0) },
      g2: { a: S('T1', '2시드', 1, 'win'), b: S('GAM', '3시드', 0) },
      wf: { a: S('BLG', '1경기 승자', 1, 'msi'), b: S('T1', '2경기 승자', 0) },
      lb: { a: S('MKOI', '1경기 패자', 1, 'elim'), b: S('GAM', '2경기 패자', 2, 'win') },
      ff: { a: S('T1', '승자전 패자', 2, 'msi'), b: S('GAM', '패자전 승자', 0, 'elim') },
    }),
    D: grp({
      g1: { a: S('HLE', '1시드', 1, 'win'), b: S('LOS', '4시드', 0) },
      g2: { a: S('LYON', '2시드', 0), b: S('JDG', '3시드', 1, 'win') },
      wf: { a: S('HLE', '1경기 승자', 1, 'msi'), b: S('JDG', '2경기 승자', 0) },
      lb: { a: S('LOS', '1경기 패자', 2, 'win'), b: S('LYON', '2경기 패자', 0, 'elim') },
      ff: { a: S('JDG', '승자전 패자', 2, 'msi'), b: S('LOS', '패자전 승자', 0, 'elim') },
    }),
  };
  // 플레이오프 — 8팀 싱글 엘리(2026 Worlds 레이아웃) + 3위 결정전.
  const seBracket = applySingleElimLayout({
    rounds: [
      { matches: [
        { title: '8강 1경기', a: S('HLE', 'D조 1위', 0), b: S('T1', 'C조 2위', 2, 'win') },
        { title: '8강 2경기', a: S('AL', 'A조 1위', 0), b: S('KC', 'B조 2위', 2, 'win') },
        { title: '8강 3경기', a: S('GEN', 'B조 1위', 2, 'win'), b: S('JDG', 'D조 2위', 0) },
        { title: '8강 4경기', a: S('BLG', 'C조 1위', 1), b: S('DK', 'A조 2위', 2, 'win') },
      ] },
      { matches: [
        { title: '4강 1경기', a: S('T1', '8강 승자', 1), b: S('KC', '8강 승자', 2, 'win') },
        { title: '4강 2경기', a: S('GEN', '8강 승자', 1), b: S('DK', '8강 승자', 2, 'win') },
      ] },
      { matches: [
        { title: '결승', a: S('KC', '4강 승자', 0), b: S('DK', '4강 승자', 3, 'msi') },
      ] },
    ],
    connectors: [
      [0, 0, 'b', 1, 0, 'a'], [0, 1, 'b', 1, 0, 'b'], [0, 2, 'a', 1, 1, 'a'], [0, 3, 'b', 1, 1, 'b'],
      [1, 0, 'b', 2, 0, 'a'], [1, 1, 'b', 2, 0, 'b'],
    ],
  });
  const third = { rounds: [{ matches: [{ title: '3위 결정전', a: S('T1', '4강 1경기 패자', 1, 'elim'), b: S('GEN', '4강 2경기 패자', 2, 'win') }] }] };
  data.standings.ewc = {
    stage: '16팀 · 4개조 더블 엘리(조별 2팀 진출) → 8강 싱글 엘리(+3위 결정전)',
    champion: 'DK', groups, playoff: { bracket: seBracket, third },
  };
  console.log('EWC 2026: 4개조 그룹 스테이지 + 8강 플레이오프(+3위전) 수기 반영 (우승 DK)');
}

// 2026 LoL KeSPA CUP — lolesports API 미제공 종료 대회(수기 관리).
//   예선(A·B조 라운드로빈) → 결선 스테이지 1(사다리) → 결선 스테이지 2. MsiBracket 그리드/플로우로 표기.
{
  // 슬롯 헬퍼: flag = 'msi'(진출/우승·금색) | 'win'(라운드 승리·파랑) | 'elim'(탈락·빨강)
  const S = (short, seed, score, flag) => {
    const s = { short }; if (seed) s.seed = seed; if (score != null) s.score = score;
    if (flag) s[flag] = true; return s;
  };
  // 결선 스테이지 1 — 사다리(라운드당 매치 4→3→2→1). 각 라운드 최상위 매치 승자는 결선 스테이지 2로 이탈(연결선 없음).
  const fs1 = {
    totalRows: 7,
    rounds: [
      { matches: [
        { title: 'R1 Q', time: '8/3', startRow: 0, a: S('NS', 'A조 1위', 2, 'msi'), b: S('T1', 'B조 1위', 1) },
        { title: 'R1 M2', time: '8/3', startRow: 2, a: S('GEN', 'A조 2위', 0), b: S('HLE', 'B조 2위', 2, 'win') },
        { title: 'R1 M3', time: '7/28', startRow: 4, a: S('DNS', 'A조 3위', 2, 'win'), b: S('BRO', 'B조 3위', 1) },
        { title: 'R1 E', time: '7/28', startRow: 6, a: S('KRX', 'A조 4위', 2, 'win'), b: S('KT', 'B조 4위', 0, 'elim') },
      ] },
      { matches: [
        { title: 'R2 Q', time: '8/4', startRow: 1, a: S('T1', 'R1 Q 패자', 2, 'msi'), b: S('HLE', 'R1 M2 승자', 1) },
        { title: 'R2 M', time: '8/4', startRow: 3, a: S('GEN', 'R1 M2 패자', 2, 'win'), b: S('DNS', 'R1 M3 승자', 0) },
        { title: 'R2 E', time: '8/4', startRow: 5, a: S('BRO', 'R1 M3 패자', 1, 'elim'), b: S('KRX', 'R1 E 승자', 2, 'win') },
      ] },
      { matches: [
        { title: 'R3 Q', time: '8/10', startRow: 2, a: S('HLE', 'R2 Q 패자', 2, 'msi'), b: S('GEN', 'R2 M 승자', 1) },
        { title: 'R3 E', time: '8/10', startRow: 4, a: S('DNS', 'R2 M 패자', 2, 'win'), b: S('KRX', 'R2 E 승자', 1, 'elim') },
      ] },
      { matches: [
        { title: 'R4', time: '8/10', startRow: 3, a: S('GEN', 'R3 Q 패자', 0, 'elim'), b: S('DNS', 'R3 E 승자', 2, 'msi') },
      ] },
    ],
    // [fromRound, fromMatch, fromSlot, toRound, toMatch, toSlot] — 같은 컬럼은 자동 무시.
    connectors: [
      [0, 0, 'b', 1, 0, 'a'], [0, 1, 'b', 1, 0, 'b'], [0, 1, 'a', 1, 1, 'a'], [0, 2, 'a', 1, 1, 'b'], [0, 2, 'b', 1, 2, 'a'], [0, 3, 'a', 1, 2, 'b'],
      [1, 0, 'b', 2, 0, 'a'], [1, 1, 'a', 2, 0, 'b'], [1, 1, 'b', 2, 1, 'a'], [1, 2, 'b', 2, 1, 'b'],
      [2, 0, 'b', 3, 0, 'a'], [2, 1, 'a', 3, 0, 'b'],
    ],
  };
  // 결선 스테이지 2 — 3라운드(플로우). S1 R3·R4 진출팀이 1R, R2 진출팀이 2R, R1 진출팀이 결승.
  const fs2 = {
    rounds: [
      { title: '1라운드', matches: [{ time: '8/11', a: S('HLE', 'S1 R3', 0), b: S('DNS', 'S1 R4', 3, 'win') }] },
      { title: '2라운드', matches: [{ time: '8/17', a: S('T1', 'S1 R2', 1), b: S('DNS', '', 3, 'win') }] },
      { title: '결승', matches: [{ time: '8/18', a: S('NS', 'S1 R1', 0), b: S('DNS', '', 3, 'msi') }] },
    ],
    connectors: [[0, 0, 'b', 1, 0, 'b'], [1, 0, 'b', 2, 0, 'b']],
  };
  // 예선 A·B조 순위(세트 승-패 · 세트 평균 승리 시간). 각 조 5위 탈락.
  const qual = {
    A: [
      { code: 'NS', w: 4, l: 1 }, { code: 'GEN', w: 2, l: 3, time: '25:37' }, { code: 'DNS', w: 2, l: 3, time: '27:17' },
      { code: 'KRX', w: 2, l: 3, time: '36:12' }, { code: 'DK', w: 0, l: 5 },
    ],
    B: [
      { code: 'T1', w: 4, l: 1, time: '25:58' }, { code: 'HLE', w: 4, l: 1, time: '34:12' }, { code: 'BRO', w: 3, l: 2 },
      { code: 'KT', w: 2, l: 3, time: '33:01' }, { code: 'BFX', w: 2, l: 3, time: '42:13' },
    ],
  };
  data.standings.lck = data.standings.lck || {};
  delete data.standings.lck['KeSPA']; // 이전 약칭 키 제거(약칭 KeSPA → KeSPA CUP 변경)
  data.standings.lck['KeSPA CUP'] = {
    name: 'LoL KeSPA CUP', year: 2026,
    format: '10팀 · 2개조 예선 → 결선 스테이지 1(사다리) → 결선 스테이지 2',
    champion: 'DNS', qual, fs1, fs2,
  };
  console.log('LCK KeSPA CUP: 예선 2개조 + 결선 스테이지 1(사다리)·2 대진표 수기 반영 (우승 DNS)');
}

// Worlds 참가팀 시드 재계산 — LCK PO·LPL Split 3 블록이 Worlds 블록보다 뒤에 실행되므로,
//   모든 국내 리그 처리가 끝난 지금 다시 계산해 최신 최종순위를 즉시 반영한다.
if (data.standings.worlds?.qualifiers) {
  const refreshed = computeWorldsQualifiers(data);
  data.standings.worlds.qualifiers = refreshed;
  console.log(`Worlds 참가팀 시드 재계산: 자동 ${refreshed.filter((q) => q.short).length}/${refreshed.length}팀`);
}

// 진행중/종료 스플릿의 최종순위 — 대진(플레이오프 등) 진행에 따라 자동 산출·갱신.
//   미종료 대회는 현재 대진 기준 잠정 순위(생존팀이 상위). 종료되면 확정.
const FINAL_STANDINGS_SUBS = [
  { key: 'lck', sub: 'LCK', brackets: ['playin', 'playoffs'] },
  { key: 'lec', sub: 'Summer', brackets: ['playoffs'] },
  { key: 'lcs', sub: 'Summer', brackets: ['playoffs'] },
  { key: 'cblol', sub: 'Split 2', brackets: ['playoffs'] },
  { key: 'lpl', sub: 'Split 3', brackets: ['knights', 'playoffs'] },
  { key: 'lcp', sub: 'Split 3', brackets: ['swiss', 'playin', 'playoffs'] },
];
for (const fsub of FINAL_STANDINGS_SUBS) {
  const node = data.standings[fsub.key]?.[fsub.sub];
  if (!node) continue;
  const brs = fsub.brackets.map((b) => node[b]).filter((x) => x?.rounds?.length || x?.sections?.length);
  if (!brs.length) continue;
  node.finalStandings = splitFinalStandings(node.rows || [], brs);
  console.log(`${fsub.key.toUpperCase()} ${fsub.sub} 최종순위: 1위 ${node.finalStandings[0]?.team}`);
}

data.updatedAt = new Date().toISOString().slice(0, 10);
data.note = '리그별 → 세부대회별 공식 현재 순위표(정규시즌만, 토너먼트/플레이오프 제외). 있으면 우선 사용, 없으면 GPR 전적으로 대체. gw/gl은 세트(게임) 승-패.';
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log('lolStandings.json 갱신 완료');

// ── 2025 과거 에디션 최종순위 (lolesports API) ─────────────────────────────
//   과거 연도는 정적이므로 lolPastEditions.json 에 1회 생성 후 캐시(이미 있으면 생략).
//   KeSPA CUP·ASI·Demacia Cup·AG는 API에 없어 제외. LCS/CBLOL 2025는 LTA North/South로 매핑.
{
  const pastFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolPastEditions.json');
  let past = { updatedAt: '', subtabs: {}, standings: {} };
  try { past = JSON.parse(fs.readFileSync(pastFile, 'utf8')); } catch { /* 최초 생성 */ }
  const has2025 = past.standings && past.standings['2025'];
  if (!has2025) {
    const CFG = [
      // LCK는 2026과 동일 포맷: LCK CUP(컵) · LCK(본선=split_3) · Road to MSI(split_2: 정규+MSI로 가는 길)
      { key: 'lck', league: '98767991310872058', subs: [['LCK CUP', 'lck_cup_2025'], ['LCK', 'lck_split_3_2025'], ['Road to MSI', 'lck_split_2_2025']] },
      { key: 'lpl', league: '98767991314006698', subs: [['Split 1', 'lpl_split_1_2025'], ['Split 2', 'lpl_split_2_2025'], ['Split 3', 'lpl_split_3_2025']] },
      { key: 'lec', league: '98767991302996019', subs: [['Winter', 'lec_winter_2025'], ['Spring', 'lec_spring_2025'], ['Summer', 'lec_summer_2025']] },
      { key: 'lcp', league: '113476371197627891', subs: [['Kickoff', 'lcp_split_1_2025'], ['Mid', 'lcp_split_2_2025'], ['Finals', 'lcp_split_3_2025']] }, // 서브탭: Kickoff/Mid/Finals (제목은 Season Kickoff/Mid Season/Season Finals)
      { key: 'lcs', league: '113470291645289904', subs: [['Split 1', 'lta_n_split_1_2025'], ['Split 2', 'lta_n_split_2_2025'], ['Split 3', 'lta_n_split_3_2025']] }, // LTA North
      { key: 'cblol', league: '113475181634818701', subs: [['Etapa 1', 'lta_s_split_1_2025'], ['Etapa 2', 'lta_s_split_2_2025'], ['Etapa 3', 'lta_s_split_3_2025']] }, // LTA South (브라질계: Split→Etapa)
      { key: 'fst', league: '113464388705111224', single: 'first_stand_2025' },
      { key: 'msi', league: '98767991325878492', single: 'msi_2025' },
      { key: 'worlds', league: '98767975604431411', single: 'worlds_2025' },
    ];
    // 전체 데이터(순위표·대진·최종순위)를 buildSplit 출력 그대로 저장 → 프론트 PastSplitView가 2026처럼 렌더.
    const pick = (s) => ({ name: s.name, rows: s.rows, brackets: s.brackets, finalStandings: s.finalStandings });
    const std2025 = {}, subs2025 = {};
    for (const c of CFG) {
      if (c.single) {
        try { const s = await buildSplit(c.league, c.single); if (s) std2025[c.key] = pick(s); }
        catch (e) { console.warn(`2025 ${c.key} 실패: ${e.message}`); }
      } else {
        const byS = {}, labels = [];
        for (const [label, slug] of c.subs) {
          try { const s = await buildSplit(c.league, slug); if (s) { byS[label] = pick(s); labels.push(label); } }
          catch (e) { console.warn(`2025 ${c.key} ${label} 실패: ${e.message}`); }
        }
        // LPL: Split 3에 포함된 '대표 선발전'(regional_qualifier)을 2026처럼 별도 서브탭으로 분리.
        if (c.key === 'lpl' && byS['Split 3']) {
          const s3 = byS['Split 3'];
          const rq = (s3.brackets || []).filter((b) => b.slug === 'regional_qualifier');
          if (rq.length) {
            s3.brackets = s3.brackets.filter((b) => b.slug !== 'regional_qualifier');
            byS['대표 선발전'] = { name: '대표 선발전', rows: [], brackets: rq, finalStandings: [] };
            labels.push('대표 선발전');
          }
        }
        // LCK CUP 2025: 그룹(내셔 남작/장로 드래곤)이 우열 조가 아니므로 순위표를 병렬 배치.
        if (c.key === 'lck' && byS['LCK CUP']) byS['LCK CUP'].parallelGroups = true;
        // LCP Finals 2025 플레이오프: 1라운드 승자(TSW·PSG 등)가 진출(금색)로 오표기 → 라운드 승리(파랑)로 교정.
        //   (bracketFromColumns가 1R 승자의 이후 진출을 놓쳐 msi로 표기하는 버그. 우승은 결승 승자만.)
        if (c.key === 'lcp' && byS['Finals']) {
          const po = (byS['Finals'].brackets || []).find((b) => b.slug === 'playoffs');
          for (const r of po?.bracket?.rounds || []) for (const m of r.matches) {
            if (!/^1라운드$/.test(m.title || '')) continue;
            for (const s of [m.a, m.b]) if (s?.msi) { delete s.msi; s.win = true; }
          }
        }
        // Road to MSI 2025: 라운드 재지정(GEN/HLE=3R, DK/KT=1R, NS/KT=2R) + 2026처럼 세부탭 없이 참가팀 성적+대진 표기.
        if (c.key === 'lck' && byS['Road to MSI']) {
          const rm = byS['Road to MSI'];
          const rb = (rm.brackets || []).find((x) => x.slug === 'road_to_msi');
          if (rb) {
            const flat = (rb.bracket.rounds || []).flatMap((r) => r.matches || []);
            const retitle = (x, y, t) => { const m = flat.find((mm) => [mm.a?.short, mm.b?.short].includes(x) && [mm.a?.short, mm.b?.short].includes(y)); if (m) m.title = t; };
            retitle('DK', 'KT', '1라운드');
            retitle('NS', 'KT', '2라운드');
            retitle('GEN', 'HLE', '3라운드');
            rb.bracket = roadToMsiLayout({ rounds: [{ matches: flat }] });
          }
          rm.roadToMsi = true; // 2026처럼 세부 스테이지 탭 없이 참가팀 성적 + 대진 함께 표기
        }
        // LEC Summer 2025: '1라운드'(하위 시드전)를 '크로스 플레이'로 분리, 나머지는 6팀 더블엘리 PO로 재배치. 그룹 라벨 '그룹 스테이지'.
        if (c.key === 'lec' && byS['Summer']) {
          const sm = byS['Summer'];
          const S = (short, score, flag, seed) => { const s = { short }; if (seed) s.seed = seed; if (score != null) s.score = score; if (flag) s[flag] = true; return s; };
          const crossPlay = { slug: 'cross_play', name: '크로스 플레이', bracket: { rounds: [{ title: '', matches: [
            { title: '크로스 플레이', a: S('SHFT', 0, 'elim'), b: S('GX', 3, 'win') },
            { title: '크로스 플레이', a: S('VIT', 3, 'win'), b: S('TH', 1, 'elim') },
          ] }] } };
          const po = { slug: 'playoffs', name: '플레이오프', bracket: {
            totalRows: 10,
            rounds: [
              { matches: [
                { title: '상위권 1라운드', startRow: 0, a: S('G2', 3, 'win'), b: S('KC', 1) },
                { title: '상위권 1라운드', startRow: 2, a: S('MKOI', 3, 'win'), b: S('FNC', 2) },
                { title: '하위권 1라운드', startRow: 6, a: S('FNC', 3, 'win'), b: S('GX', 0, 'elim') },
                { title: '하위권 1라운드', startRow: 8, a: S('KC', null, 'win'), b: S('VIT', null, 'elim') },
              ] },
              { matches: [
                { title: '상위권 결승', startRow: 1, a: S('G2', 3, 'win'), b: S('MKOI', 1) },
                { title: '하위권 2라운드', startRow: 7, a: S('FNC', 3, 'win'), b: S('KC', 1, 'elim') },
              ] },
              { matches: [
                { title: '하위권 결승', startRow: 7, a: S('MKOI', 3, 'win'), b: S('FNC', 1, 'elim') },
              ] },
              { matches: [
                { title: '결승', startRow: 4, a: S('G2', 3, 'msi'), b: S('MKOI', 0, 'elim') },
              ] },
            ],
            connectors: [
              [0, 0, 'a', 1, 0, 'a'], [0, 1, 'a', 1, 0, 'b'],
              [0, 2, 'a', 1, 1, 'a'], [0, 3, 'a', 1, 1, 'b'],
              [1, 0, 'a', 3, 0, 'a'], [1, 0, 'b', 2, 0, 'b'],
              [1, 1, 'a', 2, 0, 'a'], [2, 0, 'a', 3, 0, 'b'],
            ],
          } };
          sm.brackets = [crossPlay, po];
          sm.regLabel = '그룹 스테이지';
          sm.finalStandings = splitFinalStandings(sm.rows || [], [crossPlay.bracket, po.bracket], true);
        }
        // LTA Split 2/Etapa 2 2025: round_1=포지셔닝 페이즈(rows), round_2=그룹 페이즈(A/B조), round_3=크로스 그룹 배틀.
        if ((c.key === 'lcs' && byS['Split 2']) || (c.key === 'cblol' && byS['Etapa 2'])) {
          const sub = c.key === 'lcs' ? 'Split 2' : 'Etapa 2';
          const slug = c.subs.find(([l]) => l === sub)?.[1];
          const node = byS[sub];
          node.regLabel = '포지셔닝 페이즈';
          for (const b of node.brackets || []) if (b.slug === 'round_3') { b.name = '크로스 그룹 배틀'; b.label = '크로스 그룹 배틀'; }
          try {
            const tj = await api('getTournamentsForLeague', { leagueId: c.league });
            const tour = (tj.data.leagues[0].tournaments || []).find((t) => t.slug === slug);
            const st = tour && (await api('getStandingsV3', { tournamentId: tour.id })).data?.standings?.[0];
            const gStage = (st?.stages || []).find((s) => s.slug === 'round_2');
            const groupRows = [];
            for (const sec of gStage?.sections || []) for (const r of sec.rankings || []) for (const t of r.teams) {
              groupRows.push({ rank: r.ordinal, team: t.code, w: t.record.wins, l: t.record.losses, group: sec.name });
            }
            if (groupRows.length) node.phaseStages = [{ label: '그룹 페이즈', rows: groupRows }];
          } catch (e) { console.warn(`LTA 그룹 페이즈 ${slug} 실패: ${e.message}`); }
        }
        // LTA Split 1/Etapa 1 2025: 북/남부 선발전 → '컨퍼런스 스테이지'로 명칭 변경.
        for (const s1 of ['Split 1', 'Etapa 1']) {
          if (!byS[s1]) continue;
          for (const b of byS[s1].brackets || []) if (b.slug === 'north_qualifier' || b.slug === 'south_qualifier') { b.name = '컨퍼런스 스테이지'; b.label = '컨퍼런스 스테이지'; b.bracket = ltaConferenceLayout(b.bracket); }
        }
        // LTA Split 3/Etapa 3 2025: round_2 결승 결과가 원본에 누락된 경우(예: 북부 FLY vs 100T) 최종순위 우승팀으로 보정.
        for (const s3 of ['Split 3', 'Etapa 3']) {
          if (!byS[s3]) continue;
          const rb = (byS[s3].brackets || []).find((b) => b.slug === 'round_2')?.bracket;
          const champ = byS[s3].finalStandings?.find((f) => /우승/.test(f.note || ''))?.team;
          const gf = rb?.rounds?.[rb.rounds.length - 1]?.matches?.[0];
          if (gf && champ && !gf.a.win && !gf.a.msi && !gf.b.win && !gf.b.msi) {
            for (const s of [gf.a, gf.b]) {
              if (s.short === champ) { s.msi = true; delete s.elim; if (s.score == null) s.score = 3; } // Bo5 우승 = 3승
              else { s.elim = true; if (s.short === '100T' && champ === 'FLY') s.score = 1; } // 북부 Split3 결승 FLY 3-1 100T
            }
          }
        }
        // LTA Split 3/Etapa 3 2025: 픽 앤 플레이 페이즈(round_1)를 매치 결과 기반 순위표로 변환(승-패·세트 득실·상대). 엘리미네이션 페이즈(round_2)는 대진 유지.
        for (const s3 of ['Split 3', 'Etapa 3']) {
          const node = byS[s3];
          if (!node) continue;
          const r1 = (node.brackets || []).find((b) => b.slug === 'round_1');
          if (r1) {
            const ms = (r1.bracket.rounds || []).flatMap((r) => r.matches || []);
            const st = {};
            const get = (t) => (st[t] = st[t] || { team: t, w: 0, l: 0, gw: 0, gl: 0, opps: [] });
            for (const m of ms) {
              const a = m.a?.short, b = m.b?.short; if (!a || !b) continue;
              const sa = m.a?.score || 0, sb = m.b?.score || 0;
              const A = get(a), B = get(b);
              A.gw += sa; A.gl += sb; B.gw += sb; B.gl += sa; A.opps.push(b); B.opps.push(a);
              if (sa > sb) { A.w++; B.l++; } else if (sb > sa) { B.w++; A.l++; }
            }
            const rows = Object.values(st).sort((x, y) => (y.w - x.w) || ((y.gw - y.gl) - (x.gw - x.gl)) || (y.gw - x.gw)).map((r, i) => ({ ...r, rank: i + 1 }));
            node.phaseStages = [...(node.phaseStages || []), { label: '픽 앤 플레이 페이즈', rows, showOpponents: true }];
            node.brackets = (node.brackets || []).filter((b) => b.slug !== 'round_1');
          }
          for (const b of node.brackets || []) if (b.slug === 'round_2') { b.name = '엘리미네이션 페이즈'; b.label = '엘리미네이션 페이즈'; }
        }
        // LPL Split 2 2025: 럼블 스테이지(등봉 그룹 10팀 / 열반 그룹 6팀)가 buildSplit에서 누락 → 별도 순위 스테이지로 추가.
        //   스테이지 명칭도 변경: 그룹 순위→그룹 스테이지 / 선발전 시리즈→정상 승격전 / 플레이오프→녹아웃 스테이지.
        if (c.key === 'lpl' && byS['Split 2']) {
          const node = byS['Split 2'];
          node.regLabel = '그룹 스테이지';
          for (const b of node.brackets || []) {
            if (b.slug === 'qualifying_series') { b.name = '정상 승격전'; b.label = '정상 승격전'; }
            if (b.slug === 'playoffs') { b.name = '녹아웃 스테이지'; b.label = '녹아웃 스테이지'; }
          }
          try {
            const tj = await api('getTournamentsForLeague', { leagueId: c.league });
            const tour = (tj.data.leagues[0].tournaments || []).find((t) => t.slug === 'lpl_split_2_2025');
            const st = tour && (await api('getStandingsV3', { tournamentId: tour.id })).data?.standings?.[0];
            const rStage = (st?.stages || []).find((s) => s.slug === 'rumble_stage');
            const GNAME = { 'Group Ascend': '등봉 그룹', 'Group Nirvana': '열반 그룹' };
            const rumbleRows = [];
            for (const sec of rStage?.sections || []) for (const r of sec.rankings || []) for (const t of r.teams) {
              rumbleRows.push({ rank: r.ordinal, team: t.code, w: t.record.wins, l: t.record.losses, group: GNAME[sec.name] || sec.name });
            }
            if (rumbleRows.length) node.phaseStages = [...(node.phaseStages || []), { label: '럼블 스테이지', rows: rumbleRows, after: '정상 승격전' }];
          } catch (e) { console.warn(`LPL 럼블 스테이지 실패: ${e.message}`); }
        }
        // LCP 2025 Finals: 승강전(promotion_and_relegation)을 LTA Playoffs처럼 별도 서브탭으로 분리.
        if (c.key === 'lcp' && byS['Finals']) {
          const fin = byS['Finals'];
          const pr = (fin.brackets || []).filter((b) => b.slug === 'promotion_and_relegation');
          if (pr.length) {
            fin.brackets = fin.brackets.filter((b) => b.slug !== 'promotion_and_relegation');
            // 승강전 = Free-for-All(사다리) + Regional Merit(MVKE vs DINO 단판)로 분리.
            const prb = pr[0].bracket || { rounds: [] };
            const isRM = (m) => { const s = [m.a?.short, m.b?.short]; return s.includes('MVK') && s.includes('DINO'); };
            const rmMatches = [];
            const ffaRounds = (prb.rounds || []).map((r) => {
              const keep = []; for (const m of r.matches || []) (isRM(m) ? rmMatches : keep).push(m);
              return { ...r, matches: keep };
            });
            const brackets = [{ slug: 'free_for_all', name: 'Free-for-All', label: 'Free-for-All', bracket: { rounds: ffaRounds, connectors: prb.connectors || [] } }];
            if (rmMatches.length) brackets.push({ slug: 'regional_merit', name: 'Regional Merit', label: 'Regional Merit', bracket: { rounds: [{ title: '', matches: rmMatches }], connectors: [] } });
            byS['승강전'] = { name: '승강전', rows: [], brackets, finalStandings: [] };
            labels.push('승강전');
          }
          // 최종순위 — 플레이오프(결승 CFO 3-0 TSW / 하위권 결승 TSW 3-1 PSG …) + 그룹 시드(SHG > CHF) 기준으로 보정.
          fin.finalStandings = [
            { rank: 1, team: 'CFO', note: '우승' },
            { rank: 2, team: 'TSW', note: '준우승' },
            { rank: 3, team: 'PSG', note: '3위' },
            { rank: 4, team: 'GAM', note: '' },
            { rank: 5, team: 'MVK', note: '' },
            { rank: 6, team: 'DFM', note: '' },
            { rank: 7, team: 'SHG', note: '' },
            { rank: 8, team: 'CHF', note: '' },
          ];
        }
        if (labels.length) { std2025[c.key] = byS; subs2025[c.key] = labels; }
      }
    }
    // LTA 아메리카 스테이지(Cross-Conference 지역 결승전) — 북부(LCS)·남부(CBLOL)가 함께 겨루는 단계.
    //   Split 1·3에만 존재. 두 리그의 해당 스플릿 대진에 '아메리카 스테이지'로 추가.
    const LTA_CROSS_LEAGUE = '113475149040947852';
    // 리그별 스플릿 라벨이 다름: LCS=Split, CBLOL(LTA Sul)=Etapa
    //   split_1: 통합 스플릿(LTA)이라 해당 스플릿 대진에 스테이지로 추가.
    //   split_3: 플레이오프와 별개 대회이므로 '아메리카 스테이지' 서브탭으로 분리(Split 선택하듯 전환).
    const CROSS = [
      { slug: 'lta_cross_split_1_2025', subs: { lcs: 'Split 1', cblol: 'Etapa 1' }, separate: false },
      { slug: 'lta_cross_split_3_2025', subs: { lcs: 'Split 3', cblol: 'Etapa 3' }, separate: true },
    ];
    for (const c of CROSS) {
      try {
        const s = await buildSplit(LTA_CROSS_LEAGUE, c.slug);
        const rf = (s?.brackets || []).find((b) => b.slug === 'regional_finals');
        if (rf) {
          const stage = { slug: 'americas_stage', name: '아메리카 스테이지', label: '아메리카 스테이지', bracket: ltaAmericasLayout(rf.bracket) };
          // 아메리카 스테이지 결승 승자 = LTA Playoffs 우승자(우승 경력 산출용).
          const rounds = stage.bracket?.rounds || [];
          const gf = rounds[rounds.length - 1]?.matches?.slice(-1)[0];
          let champ = null;
          if (gf) {
            if (gf.a?.win || gf.a?.msi) champ = gf.a.short;
            else if (gf.b?.win || gf.b?.msi) champ = gf.b.short;
            else if (gf.a?.score != null && gf.b?.score != null && gf.a.score !== gf.b.score) champ = gf.a.score > gf.b.score ? gf.a.short : gf.b.short;
          }
          // 아메리카 스테이지(더블 엘리) 탈락 라운드 기준으로 최종순위 산출 — 늦게 탈락할수록 상위, 동라운드는 세트 승수로 정렬.
          const elimAt = {}; // team → { round, gw }(마지막 패배 시점)
          rounds.forEach((r, ri) => {
            for (const m of r.matches || []) {
              if (m.a?.score == null || m.b?.score == null || m.a.score === m.b.score) continue;
              const aWin = m.a.score > m.b.score;
              const w = aWin ? m.a : m.b, l = aWin ? m.b : m.a;
              if (l.short) elimAt[l.short] = { round: ri, gw: l.score || 0 };
              if (w.short) delete elimAt[w.short]; // 이후 라운드 진출 = 해당 시점 탈락 아님
            }
          });
          if (champ) delete elimAt[champ];
          const ordered = Object.entries(elimAt).sort((a, b) => (b[1].round - a[1].round) || (b[1].gw - a[1].gw));
          const finalStandings = champ
            ? [{ rank: 1, team: champ, note: '우승' }, ...ordered.map(([team], i) => ({ rank: i + 2, team, note: i === 0 ? '준우승' : (i === 1 ? '3위' : '') }))]
            : [];
          if (c.separate) {
            // 지역 스플릿(Split 3/Etapa 3)은 그대로 두고, LTA Cross(아메리카 스테이지)를 'Playoffs' 서브탭으로 분리.
            for (const key of ['lcs', 'cblol']) {
              if (!std2025[key]) continue;
              std2025[key]['Playoffs'] = { name: 'Playoffs', rows: [], brackets: [stage], finalStandings };
              subs2025[key].push('Playoffs');
            }
          } else {
            // 통합 스플릿(Split 1/Etapa 1): 아메리카 스테이지가 최종 결승 → 우승자를 최종순위 1위로 보정.
            const gfLoser = gf ? (gf.a?.short === champ ? gf.b?.short : gf.a?.short) : null;
            for (const key of ['lcs', 'cblol']) {
              const sub = c.subs[key];
              const node = std2025[key]?.[sub];
              if (!node?.brackets) continue;
              node.brackets.push(stage);
              if (champ) {
                const arr = (node.finalStandings || []).map((f) => ({ ...f, note: /우승|준우승/.test(f.note || '') ? '' : f.note }));
                const pull = (team) => { if (!team) return null; const i = arr.findIndex((f) => f.team === team); return i >= 0 ? arr.splice(i, 1)[0] : { team }; };
                const cr = pull(champ); cr.note = '우승';
                const lr = pull(gfLoser); if (lr) lr.note = '준우승';
                node.finalStandings = [cr, lr, ...arr].filter(Boolean).map((f, i) => ({ ...f, rank: i + 1 }));
              }
            }
          }
          console.log(`2025 아메리카 스테이지(${c.slug}) ${c.separate ? '서브탭 분리' : '스테이지 추가'}`);
        }
      } catch (e) { console.warn(`2025 아메리카 스테이지 ${c.slug} 실패: ${e.message}`); }
    }
    // LCP 2025 Kickoff/Mid 대진명 커스텀 표기: '선발전 시리즈'·'대표 선발전' → '퀄리파잉 시리즈'.
    //   Finals: '타이브레이커'→'그룹 브레이커', '조별 시드 배정 대진'→'그룹 시딩 브래킷', 그룹 라벨 '도전자 그룹'→'컨텐더 그룹'·'급상승 그룹'→'브레이크아웃 그룹'.
    //   (원본 API 라벨을 그대로 노출하면 리그 성격이 잘 드러나지 않아 표기만 교체 — 매 생성 시 재적용되도록 여기서 처리)
    for (const subKey of ['Kickoff', 'Mid']) {
      const b = (std2025.lcp?.[subKey]?.brackets || []).find((x) => x.slug === 'qualifying_series' || x.slug === 'regional_qualifier');
      if (b) b.name = '퀄리파잉 시리즈';
    }
    if (std2025.lcp?.Finals) {
      const fin = std2025.lcp.Finals;
      const tb = (fin.brackets || []).find((x) => x.slug === 'tiebreaker');
      if (tb) tb.name = '그룹 브레이커';
      const gsb = (fin.brackets || []).find((x) => x.slug === 'group_seeding_bracket');
      if (gsb) gsb.name = '그룹 시딩 브래킷';
      for (const row of fin.rows || []) {
        if (row.group === '도전자 그룹') row.group = '컨텐더 그룹';
        else if (row.group === '급상승 그룹') row.group = '브레이크아웃 그룹';
      }
    }
    // FST 2025 표기: 정규시즌(라운드로빈 순위표) → '라운드 로빈', '2라운드'(녹아웃 브래킷) → '녹아웃'.
    if (std2025.fst) {
      std2025.fst.regLabel = '라운드 로빈';
      const r2 = (std2025.fst.brackets || []).find((x) => x.slug === 'round_2');
      if (r2) r2.name = '녹아웃';
    }
    past = {
      updatedAt: data.updatedAt,
      subtabs: { ...(past.subtabs || {}), '2025': subs2025 },
      standings: { ...(past.standings || {}), '2025': std2025 },
    };
    fs.writeFileSync(pastFile, JSON.stringify(past, null, 2) + '\n');
    const nComp = Object.keys(std2025).length;
    console.log(`2025 과거 에디션 생성: ${nComp}개 리그 (전체 순위표·대진·최종순위)`);
  } else {
    console.log('2025 과거 에디션: 이미 존재 → 생략');
  }
}

// ── 2025 과거 에디션 표기 커스텀 오버라이드 (매 실행마다 재적용) ─────────────
//   위 생성 블록은 최초 1회만 실행되어 캐시되므로, 캐시된 데이터에 남아있을 수 있는
//   원본(API) 라벨을 매 실행마다 우리 표기로 강제 교정한다. 스케줄 Action이 3시간마다
//   이 파일을 커밋·푸시하므로, 로컬에서 수동으로 JSON을 고쳐도 다음 자동 갱신 때 되돌아가는
//   문제를 막기 위해 반드시 스크립트 쪽에 표기를 박아둔다 (JSON 직접 수정 금지).
{
  const pastFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolPastEditions.json');
  let past;
  try { past = JSON.parse(fs.readFileSync(pastFile, 'utf8')); } catch { past = null; }
  if (past?.standings?.['2025']) {
    let changed = false;
    const std2025 = past.standings['2025'];
    for (const subKey of ['Kickoff', 'Mid']) {
      const b = (std2025.lcp?.[subKey]?.brackets || []).find((x) => x.slug === 'qualifying_series' || x.slug === 'regional_qualifier');
      if (b && b.name !== '퀄리파잉 시리즈') { b.name = '퀄리파잉 시리즈'; changed = true; }
    }
    if (std2025.lcp?.Finals) {
      const fin = std2025.lcp.Finals;
      const tb = (fin.brackets || []).find((x) => x.slug === 'tiebreaker');
      if (tb && tb.name !== '그룹 브레이커') { tb.name = '그룹 브레이커'; changed = true; }
      const gsb = (fin.brackets || []).find((x) => x.slug === 'group_seeding_bracket');
      if (gsb && gsb.name !== '그룹 시딩 브래킷') { gsb.name = '그룹 시딩 브래킷'; changed = true; }
      for (const row of fin.rows || []) {
        if (row.group === '도전자 그룹') { row.group = '컨텐더 그룹'; changed = true; }
        else if (row.group === '급상승 그룹') { row.group = '브레이크아웃 그룹'; changed = true; }
      }
    }
    if (std2025.fst) {
      if (std2025.fst.regLabel !== '라운드 로빈') { std2025.fst.regLabel = '라운드 로빈'; changed = true; }
      const r2 = (std2025.fst.brackets || []).find((x) => x.slug === 'round_2');
      if (r2 && r2.name !== '녹아웃') { r2.name = '녹아웃'; changed = true; }
    }
    if (changed) {
      fs.writeFileSync(pastFile, JSON.stringify(past, null, 2) + '\n');
      console.log('2025 과거 에디션 표기 오버라이드 재적용 완료');
    }
  }
}

// ── 과거 에디션 전체 확장 (대회별 API 최대치) ───────────────────────────────
//   각 리그의 모든 과거 토너먼트를 순회해 연도별 생성. 2025(특수·LTA 재편)·2026(현재 시즌) 제외.
//   LCK 2012~ · LEC/LCS 2013~ · LPL/CBLOL 2020~ · MSI 2015~ · Worlds 2011~.
//   정적 데이터라 연도·리그별 1회 생성 후 캐시. 옛 팀 브랜딩은 이후 오버라이드로 정정.
{
  const pastFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolPastEditions.json');
  let past = { updatedAt: '', subtabs: {}, standings: {} };
  try { past = JSON.parse(fs.readFileSync(pastFile, 'utf8')); } catch { /* 최초 생성 */ }
  past.subtabs = past.subtabs || {}; past.standings = past.standings || {};

  const SPLIT_LEAGUES = {
    lck: '98767991310872058', lpl: '98767991314006698', lec: '98767991302996019',
    lcs: '98767991299243165', cblol: '98767991332355509',
  };
  const SINGLE_LEAGUES = { msi: '98767991325878492', worlds: '98767975604431411' };
  const SKIP_YEARS = new Set(['2025', '2026']); // 2025=특수(LTA), 2026=현재 시즌

  // 슬러그 → 서브탭 라벨(연도마다 명명이 제각각이라 휴리스틱으로 정규화).
  const deriveLabel = (slug) => {
    const s = slug.toLowerCase();
    if (/season_finals/.test(s)) return 'Season Finals';
    if (/lock[_-]?in/.test(s)) return 'Lock In';
    if (/regional_finals|regional_qualifier/.test(s)) return '선발전';
    if (/(^|_)mss(_|$)|mid_?season_?showdown/.test(s)) return 'Mid-Season Showdown';
    if (/winter/.test(s)) return 'Winter';
    if (/spring/.test(s)) return 'Spring';
    if (/summer/.test(s)) return 'Summer';
    if (/split_?3|split3/.test(s)) return 'Split 3';
    if (/split_?2|split2/.test(s)) return 'Split 2';
    if (/split_?1|split1/.test(s)) return 'Split 1';
    return slug;
  };
  const pick = (s) => ({ name: s.name, rows: s.rows, brackets: s.brackets, finalStandings: s.finalStandings });
  const nonEmpty = (s) => !!s && ((s.rows && s.rows.length) || (s.brackets && s.brackets.length));

  let changed = false;
  // 리그별 서브탭형 대회 (LCK/LPL/LEC/LCS/CBLOL)
  for (const [key, leagueId] of Object.entries(SPLIT_LEAGUES)) {
    let tours = [];
    try { tours = (await api('getTournamentsForLeague', { leagueId })).data.leagues[0].tournaments || []; }
    catch (e) { console.warn(`${key} 토너먼트 목록 실패: ${e.message}`); continue; }
    const byYear = {}; // 연도 → 토너먼트[](시작일 오름차순 = 서브탭 자연 순서)
    for (const t of tours.slice().sort((a, b) => (a.startDate < b.startDate ? -1 : 1))) {
      const year = t.startDate.slice(0, 4);
      if (SKIP_YEARS.has(year)) continue;
      (byYear[year] = byYear[year] || []).push(t);
    }
    for (const [year, list] of Object.entries(byYear)) {
      if (past.standings[year]?.[key]) continue; // 이미 생성됨
      const byS = {}, labels = [];
      for (const t of list) {
        try {
          const s = await buildSplit(leagueId, t.slug);
          if (!nonEmpty(s)) continue;
          let label = deriveLabel(t.slug);
          while (byS[label]) label += ' '; // 라벨 충돌 회피
          byS[label] = pick(s); labels.push(label);
        } catch (e) { console.warn(`${year} ${key} ${t.slug} 실패: ${e.message}`); }
      }
      if (!labels.length) continue;
      (past.subtabs[year] = past.subtabs[year] || {})[key] = labels;
      (past.standings[year] = past.standings[year] || {})[key] = byS;
      changed = true;
      console.log(`${year} ${key.toUpperCase()} 생성: ${labels.join(', ')}`);
    }
  }
  // 단일 대회 (MSI·Worlds) — 연도별 단일 데이터
  for (const [key, leagueId] of Object.entries(SINGLE_LEAGUES)) {
    let tours = [];
    try { tours = (await api('getTournamentsForLeague', { leagueId })).data.leagues[0].tournaments || []; }
    catch (e) { console.warn(`${key} 토너먼트 목록 실패: ${e.message}`); continue; }
    for (const t of tours) {
      const year = t.startDate.slice(0, 4);
      if (SKIP_YEARS.has(year)) continue;
      if (past.standings[year]?.[key]) continue;
      try {
        const s = await buildSplit(leagueId, t.slug);
        if (!nonEmpty(s)) continue;
        (past.standings[year] = past.standings[year] || {})[key] = pick(s);
        changed = true;
        console.log(`${year} ${key.toUpperCase()} 생성`);
      } catch (e) { console.warn(`${year} ${key} ${t.slug} 실패: ${e.message}`); }
    }
  }
  if (changed) {
    past.updatedAt = data.updatedAt;
    fs.writeFileSync(pastFile, JSON.stringify(past, null, 2) + '\n');
    console.log('과거 에디션 전체 확장 저장 완료');
  } else {
    console.log('과거 에디션 전체 확장: 추가 없음');
  }
}

// ── 2024 LPL Summer 럼블 스테이지(등봉/열반) — buildSplit이 순위형 스테이지를 누락 → phaseStage로 보강 ──
{
  const pastFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolPastEditions.json');
  try {
    const past = JSON.parse(fs.readFileSync(pastFile, 'utf8'));
    const node = past.standings?.['2024']?.lpl?.Summer;
    if (node && !(node.phaseStages || []).some((p) => p.label === '럼블 스테이지')) {
      const tj = await api('getTournamentsForLeague', { leagueId: '98767991314006698' });
      const tour = (tj.data.leagues[0].tournaments || []).find((t) => t.slug === 'lpl_summer_2024');
      const st = tour && (await api('getStandingsV3', { tournamentId: tour.id })).data?.standings?.[0];
      const rStage = (st?.stages || []).find((s) => s.slug === 'rumble_stage');
      const GNAME = { 'Group Ascend': '등봉 그룹', 'Group Nirvana': '열반 그룹' };
      const rows = [];
      for (const sec of rStage?.sections || []) for (const r of sec.rankings || []) for (const t of r.teams) {
        rows.push({ rank: r.ordinal, team: t.code, w: t.record.wins, l: t.record.losses, group: GNAME[sec.name] || sec.name });
      }
      if (rows.length) {
        node.phaseStages = [...(node.phaseStages || []), { label: '럼블 스테이지', rows }];
        fs.writeFileSync(pastFile, JSON.stringify(past, null, 2) + '\n');
        console.log(`2024 LPL Summer 럼블 스테이지 추가 (${rows.length}팀)`);
      }
    }
  } catch (e) { console.warn(`2024 LPL 럼블 스테이지 실패(무시): ${e.message}`); }
}

// ── 2024 LCP 전신(PCS·VCS) — LCP 2024에서 대회 선택(PCS/VCS) → Spring/Summer 서브탭 ──
{
  const pastFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolPastEditions.json');
  try {
    const past = JSON.parse(fs.readFileSync(pastFile, 'utf8'));
    const EV = { PCS: ['104366947889790212', [['Spring', 'pcs_spring_2024'], ['Summer', 'pcs_summer_2024']]], VCS: ['107213827295848783', [['Spring', 'vcs_spring_2024'], ['Summer', 'vcs_summer_2024']]] };
    const std = (past.standings['2024'] = past.standings['2024'] || {});
    const sub = (past.subtabs['2024'] = past.subtabs['2024'] || {});
    if (!std.lcp) {
      const lcp = {}, subs = {};
      for (const [ev, [leagueId, list]] of Object.entries(EV)) {
        for (const [label, slug] of list) {
          try {
            const s = await buildSplit(leagueId, slug);
            if (s) { (lcp[ev] = lcp[ev] || {})[label] = { name: s.name, rows: s.rows, brackets: s.brackets, finalStandings: s.finalStandings }; (subs[ev] = subs[ev] || []).push(label); }
          } catch (e) { console.warn(`2024 ${ev} ${label} 실패: ${e.message}`); }
        }
      }
      if (Object.keys(lcp).length) {
        std.lcp = lcp; sub.lcp = subs;
        fs.writeFileSync(pastFile, JSON.stringify(past, null, 2) + '\n');
        console.log(`2024 LCP(PCS·VCS) 생성: ${Object.entries(subs).map(([k, v]) => `${k}[${v.join(',')}]`).join(' ')}`);
      }
    }
  } catch (e) { console.warn(`2024 PCS·VCS 생성 실패(무시): ${e.message}`); }
}

// ── 2024 LCS Championship — Summer 플레이오프가 곧 LCS Championship → 'Championship' 서브탭으로 분리 ──
{
  const pastFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolPastEditions.json');
  try {
    const past = JSON.parse(fs.readFileSync(pastFile, 'utf8'));
    const lcs = past.standings?.['2024']?.lcs;
    const sm = lcs?.Summer;
    const po = (sm?.brackets || []).find((b) => b.slug === 'playoffs');
    // Summer에도 플레이오프는 그대로 두고(최종순위는 Championship에만 → 우승 경력 중복 방지), Championship 서브탭에 복제.
    const champPo = lcs?.Championship?.brackets?.[0];
    if (sm && !po && champPo) { sm.brackets = [...(sm.brackets || []), { ...champPo, name: '플레이오프', label: '플레이오프' }]; fs.writeFileSync(pastFile, JSON.stringify(past, null, 2) + '\n'); console.log('2024 LCS Summer 플레이오프 복원'); }
    if (sm && po && !lcs.Championship) {
      lcs.Championship = { name: 'LCS Championship 2024', rows: [], brackets: [{ ...po, name: 'LCS Championship', label: 'LCS Championship' }], finalStandings: sm.finalStandings || [] };
      sm.finalStandings = [];
      const subs = past.subtabs['2024'].lcs;
      if (!subs.includes('Championship')) subs.push('Championship');
      fs.writeFileSync(pastFile, JSON.stringify(past, null, 2) + '\n');
      console.log('2024 LCS Championship 서브탭 분리');
    }
  } catch (e) { console.warn(`2024 LCS Championship 분리 실패(무시): ${e.message}`); }
}

// ── 2024 LEC Season Finals 최종순위 — 대진(더블 엘리) 탈락 시점 기준으로 재산출 ──
{
  const pastFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolPastEditions.json');
  try {
    const past = JSON.parse(fs.readFileSync(pastFile, 'utf8'));
    const node = past.standings?.['2024']?.lec?.['Season Finals'];
    const rounds = node?.brackets?.[0]?.bracket?.rounds || [];
    const gf = rounds[rounds.length - 1]?.matches?.slice(-1)[0];
    if (gf && gf.a?.score != null && gf.b?.score != null) {
      const champ = gf.a.score > gf.b.score ? gf.a.short : gf.b.short;
      const elimAt = {};
      rounds.forEach((r, ri) => { for (const m of r.matches || []) {
        if (m.a?.score == null || m.b?.score == null || m.a.score === m.b.score) continue;
        const aWin = m.a.score > m.b.score; const w = aWin ? m.a : m.b, l = aWin ? m.b : m.a;
        elimAt[l.short] = { round: ri, gw: l.score || 0 }; delete elimAt[w.short];
      } });
      delete elimAt[champ];
      const ordered = Object.entries(elimAt).sort((a, b) => (b[1].round - a[1].round) || (b[1].gw - a[1].gw));
      node.finalStandings = [{ rank: 1, team: champ, note: '우승' }, ...ordered.map(([team], i) => ({ rank: i + 2, team, note: i === 0 ? '준우승' : (i === 1 ? '3위' : '') }))];
      fs.writeFileSync(pastFile, JSON.stringify(past, null, 2) + '\n');
      console.log(`2024 LEC Season Finals 최종순위: ${node.finalStandings.map((f) => f.team).join(',')}`);
    }
  } catch (e) { console.warn(`2024 LEC Season Finals 보정 실패(무시): ${e.message}`); }
}

// ── 2025 LoL KeSPA CUP (API 미제공 · 수기) → 과거 에디션 lck 서브탭 주입 ─────────
//   형식: 예선(A·B·C 3개조) → 본선(LCQ 3팀 싱글 라운드로빈) → 결선(4팀 더블 엘리미네이션). 우승 T1.
{
  const pastFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolPastEditions.json');
  try {
    const past = JSON.parse(fs.readFileSync(pastFile, 'utf8'));
    const S = (short, seed, score, flag) => { const s = { short }; if (seed) s.seed = seed; if (score != null) s.score = score; if (flag) s[flag] = true; return s; };
    const kespa = {
      name: 'LoL KeSPA CUP', kespa: true, champion: 'T1',
      // 예선 — 조별 순위(승-패, H2H 비고). '전승/전패'는 표기 제외, 동률 H2H는 'N위 W/L'.
      qual: {
        A: [{ code: 'HLE', w: 4, l: 0 }, { code: 'C9', w: 3, l: 1 }, { code: 'BFX', w: 2, l: 2 }, { code: 'VIE', w: 1, l: 3 }, { code: 'GEN', w: 0, l: 4 }],
        B: [{ code: 'DK', w: 4, l: 0 }, { code: 'DNS', w: 2, l: 2, h2h: '2위 W' }, { code: 'KRX', w: 2, l: 2, h2h: '2위 L' }, { code: 'KT', w: 1, l: 3, h2h: '4위 W' }, { code: 'BRO', w: 1, l: 3, h2h: '4위 L' }],
        C: [{ code: 'T1', w: 3, l: 0 }, { code: 'NS', w: 2, l: 1 }, { code: 'TLAW', w: 1, l: 2 }, { code: 'JPN', w: 0, l: 3 }],
      },
      // 본선(LCQ) — 3팀 싱글 라운드로빈. 1위만 결선 진출. 세트 득실 포함.
      lcq: [
        { code: 'NS', w: 2, l: 0, gw: 4, gl: 1 },
        { code: 'C9', w: 1, l: 1, gw: 3, gl: 2 },
        { code: 'DNS', w: 0, l: 2, gw: 0, gl: 4 },
      ],
      // 결선 — 4팀 더블 엘리미네이션(승자조 Bo3 → 승자조 결승 Bo5 / 패자조 → 결승 Bo5).
      knockout: {
        totalRows: 7,
        rounds: [
          { matches: [
            { title: '승자조 M1', time: '12/11', startRow: 0, a: S('DK', 'B조 1위', 2, 'win'), b: S('NS', 'LCQ 1위', 1) },
            { title: '승자조 M2', time: '12/11', startRow: 2, a: S('HLE', 'A조 1위', 2, 'win'), b: S('T1', 'C조 1위', 1) },
            { title: '패자조 M3', time: '12/11', startRow: 5, a: S('NS', 'M1 패자', 0, 'elim'), b: S('T1', 'M2 패자', 2, 'win') },
          ] },
          { matches: [
            { title: '승자조 결승 M4', time: '12/12', startRow: 1, a: S('DK', '', 2), b: S('HLE', '', 3, 'win') },
            { title: '패자조 결승 M5', time: '12/13', startRow: 5, a: S('DK', 'M4 패자', 2, 'elim'), b: S('T1', '', 3, 'win') },
          ] },
          { matches: [
            { title: '결승 M6', time: '12/14', startRow: 3, a: S('HLE', '', 2, 'elim'), b: S('T1', '', 3, 'msi') },
          ] },
        ],
        connectors: [
          [0, 0, 'a', 1, 0, 'a'], // M1 승자 DK → M4
          [0, 1, 'a', 1, 0, 'b'], // M2 승자 HLE → M4
          [0, 2, 'b', 1, 1, 'b'], // M3 승자 T1 → M5
          [1, 0, 'b', 2, 0, 'a'], // M4 승자 HLE → 결승
          [1, 1, 'b', 2, 0, 'b'], // M5 승자 T1 → 결승
        ],
      },
      // 최종 순위(우승 경력 산출용) — 결선 4팀. champion=T1.
      finalStandings: [{ rank: 1, team: 'T1' }, { rank: 2, team: 'HLE' }, { rank: 3, team: 'DK' }, { rank: 4, team: 'NS' }],
    };
    if (past.standings?.['2025']?.lck) {
      past.standings['2025'].lck['KeSPA CUP'] = kespa;
      const subs = (past.subtabs['2025'] = past.subtabs['2025'] || {});
      subs.lck = subs.lck || [];
      if (!subs.lck.includes('KeSPA CUP')) subs.lck.push('KeSPA CUP');
      fs.writeFileSync(pastFile, JSON.stringify(past, null, 2) + '\n');
      console.log('2025 LoL KeSPA CUP 주입 완료 (예선 3조 + 본선 LCQ + 결선 더블엘리 · 우승 T1)');
    } else {
      console.warn('2025 KeSPA CUP 주입 실패: 2025 lck 과거 에디션 없음');
    }
  } catch (e) { console.warn(`2025 KeSPA CUP 주입 실패(무시): ${e.message}`); }
}

// ── 2025 Esports World Cup (EWC) — API 미제공 · 수기 → 과거 에디션 주입 ─────────
//   8팀 2개조 더블 엘리(조별 2팀 진출) → 8팀 싱글 엘리 플레이오프(4팀은 MSI 시드로 플레이오프 직행) + 3위전. 우승 GEN.
{
  const pastFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolPastEditions.json');
  try {
    const past = JSON.parse(fs.readFileSync(pastFile, 'utf8'));
    const S = (short, seed, score, flag) => { const s = { short }; if (seed) s.seed = seed; if (score != null) s.score = score; if (flag) s[flag] = true; return s; };
    const grp = (r) => de4Layout({ rounds: [
      { matches: [{ title: '1경기', ...r.g1 }, { title: '2경기', ...r.g2 }] },
      { matches: [{ title: '승자전', ...r.wf }, { title: '패자전', ...r.lb }] },
      { matches: [{ title: '최종전', ...r.ff }] },
    ] });
    const groups = {
      A: grp({
        g1: { a: S('G2', '2시드', 1, 'win'), b: S('FUR', '3시드', 0) },
        g2: { a: S('FLY', '1시드', 1, 'win'), b: S('C9', '4시드', 0) },
        wf: { a: S('G2', '1경기 승자', 1, 'msi'), b: S('FLY', '2경기 승자', 0) },
        lb: { a: S('FUR', '1경기 패자', 1, 'win'), b: S('C9', '2경기 패자', 0, 'elim') },
        ff: { a: S('FLY', '승자전 패자', 1, 'msi'), b: S('FUR', '패자전 승자', 0, 'elim') },
      }),
      B: grp({
        g1: { a: S('CFO', '1시드', 0), b: S('HLE', '4시드', 1, 'win') },
        g2: { a: S('MKOI', '2시드', 1, 'win'), b: S('GAM', '3시드', 0) },
        wf: { a: S('HLE', '1경기 승자', 1, 'msi'), b: S('MKOI', '2경기 승자', 0) },
        lb: { a: S('CFO', '1경기 패자', 1, 'win'), b: S('GAM', '2경기 패자', 0, 'elim') },
        ff: { a: S('MKOI', '승자전 패자', 1, 'msi'), b: S('CFO', '패자전 승자', 0, 'elim') },
      }),
    };
    // 플레이오프 — 8팀 싱글 엘리(+3위전). 4팀(MSI 시드) 직행 + 조별 2팀씩. 8강 대진은 준결승 짝이 인접하도록 정렬.
    const seBracket = applySingleElimLayout({
      rounds: [
        { matches: [
          { title: '8강 1경기', a: S('HLE', 'B조 1위', 1), b: S('AL', 'MSI 3위', 2, 'win') },
          { title: '8강 3경기', a: S('MKOI', 'B조 2위', 1), b: S('T1', 'MSI 2위', 2, 'win') },
          { title: '8강 4경기', a: S('GEN', 'MSI 1위', 2, 'win'), b: S('FLY', 'A조 2위', 0) },
          { title: '8강 2경기', a: S('G2', 'A조 1위', 2, 'win'), b: S('BLG', 'MSI 4위', 1) },
        ] },
        { matches: [
          { title: '4강 1경기', a: S('AL', '8강 승자', 2, 'win'), b: S('T1', '8강 승자', 0) },
          { title: '4강 2경기', a: S('GEN', '8강 승자', 2, 'win'), b: S('G2', '8강 승자', 1) },
        ] },
        { matches: [
          { title: '결승', a: S('GEN', '4강 승자', 3, 'msi'), b: S('AL', '4강 승자', 2, 'elim') },
        ] },
      ],
      connectors: [
        [0, 0, 'b', 1, 0, 'a'], [0, 1, 'b', 1, 0, 'b'], [0, 2, 'a', 1, 1, 'a'], [0, 3, 'a', 1, 1, 'b'],
        [1, 0, 'a', 2, 0, 'b'], [1, 1, 'a', 2, 0, 'a'],
      ],
    });
    const third = { rounds: [{ matches: [{ title: '3위 결정전', a: S('G2', '4강 2경기 패자', 0, 'elim'), b: S('T1', '4강 1경기 패자', 2, 'win') }] }] };
    (past.standings['2025'] = past.standings['2025'] || {}).ewc = {
      stage: '8팀 2개조 더블 엘리(조별 2팀 진출) → 8팀 싱글 엘리 플레이오프(+3위 결정전)',
      champion: 'GEN', groups, playoff: { bracket: seBracket, third },
    };
    fs.writeFileSync(pastFile, JSON.stringify(past, null, 2) + '\n');
    console.log('2025 EWC 주입 완료 (2개조 그룹 스테이지 + 8강 플레이오프(+3위전) · 우승 GEN)');
    // 2024 EWC — 8팀 싱글 엘리(그룹 스테이지·3위전 없음). 우승 T1.
    const se24 = applySingleElimLayout({
      rounds: [
        { matches: [
          { title: '8강 1경기', a: S('BLG', '', 1), b: S('T1', '', 2, 'win') },
          { title: '8강 2경기', a: S('TLAW', '', 2, 'win'), b: S('FNC', '', 0) },
          { title: '8강 3경기', a: S('GEN', '', 0), b: S('TES', '', 2, 'win') },
          { title: '8강 4경기', a: S('G2', '', 2, 'win'), b: S('FLY', '', 1) },
        ] },
        { matches: [
          { title: '4강 1경기', a: S('T1', '8강 승자', 2, 'win'), b: S('TLAW', '8강 승자', 1) },
          { title: '4강 2경기', a: S('TES', '8강 승자', 2, 'win'), b: S('G2', '8강 승자', 0) },
        ] },
        { matches: [
          { title: '결승', a: S('T1', '4강 승자', 3, 'msi'), b: S('TES', '4강 승자', 1, 'elim') },
        ] },
      ],
      connectors: [
        [0, 0, 'b', 1, 0, 'a'], [0, 1, 'a', 1, 0, 'b'], [0, 2, 'b', 1, 1, 'a'], [0, 3, 'a', 1, 1, 'b'],
        [1, 0, 'a', 2, 0, 'a'], [1, 1, 'a', 2, 0, 'b'],
      ],
    });
    (past.standings['2024'] = past.standings['2024'] || {}).ewc = {
      stage: '8팀 싱글 엘리미네이션', champion: 'T1', playoff: { bracket: se24 },
    };
    fs.writeFileSync(pastFile, JSON.stringify(past, null, 2) + '\n');
    console.log('2024 EWC 주입 완료 (8강 싱글 엘리 · 우승 T1)');
  } catch (e) { console.warn(`2025 EWC 주입 실패(무시): ${e.message}`); }
}

// ── 2025 Demacia Cup (DCGI) — API 미제공 · 수기 → 과거 에디션 데모샤 컵 이벤트 주입 ─────────
//   16팀(2026 LPL 14팀 + FRK·ZSM). 스테이지1(4팀 2개조 싱글RR·조별 2위까지 진출) →
//   스테이지2(진출 4팀 + 대기 6팀 = 10팀 5팀 2개조·조별 3위까지 진출) → 녹아웃(대기 2팀 + 진출 6팀 = 8팀 싱글 엘리). 우승 iG.
{
  const pastFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolPastEditions.json');
  try {
    const past = JSON.parse(fs.readFileSync(pastFile, 'utf8'));
    const S = (short, seed, score, flag) => { const s = { short }; if (seed) s.seed = seed; if (score != null) s.score = score; if (flag) s[flag] = true; return s; };
    const R = (rank, team, w, l, group) => ({ rank, team, w, l, group });
    const stage1 = [
      R(1, 'OMG', 3, 0, 'A조'), R(2, 'LGD', 2, 1, 'A조'), R(3, 'TT', 1, 2, 'A조'), R(4, 'ZSM', 0, 3, 'A조'),
      R(1, 'LNG', 3, 0, 'B조'), R(2, 'WE', 2, 1, 'B조'), R(3, 'UP', 1, 2, 'B조'), R(4, 'FRK', 0, 3, 'B조'),
    ];
    const stage2 = [
      R(1, 'EDG', 4, 0, 'A조'), R(2, 'IG', 3, 1, 'A조'), R(3, 'LGD', 2, 2, 'A조'), R(4, 'NIP', 1, 3, 'A조'), R(5, 'WE', 0, 4, 'A조'),
      R(1, 'LNG', 3, 1, 'B조'), R(2, 'JDG', 2, 2, 'B조'), R(3, 'OMG', 2, 2, 'B조'), R(4, 'WBG', 2, 2, 'B조'), R(5, 'BLG', 1, 3, 'B조'),
    ];
    // 녹아웃 — 8팀 싱글 엘리(2026 Worlds 레이아웃). 대기 2팀(AL·TES) + 스테이지2 진출 6팀.
    const knockout = applySingleElimLayout({
      rounds: [
        { matches: [
          { title: '8강 1경기', a: S('AL', '', 0), b: S('LGD', '', 3, 'win') },
          { title: '8강 2경기', a: S('JDG', '', 3, 'win'), b: S('EDG', '', 1) },
          { title: '8강 3경기', a: S('IG', '', 3, 'win'), b: S('TES', '', 1) },
          { title: '8강 4경기', a: S('OMG', '', 2), b: S('LNG', '', 3, 'win') },
        ] },
        { matches: [
          { title: '4강 1경기', a: S('LGD', '8강 승자', 0), b: S('JDG', '8강 승자', 3, 'win') },
          { title: '4강 2경기', a: S('IG', '8강 승자', 3, 'win'), b: S('LNG', '8강 승자', 0) },
        ] },
        { matches: [
          { title: '결승', a: S('JDG', '4강 승자', 0), b: S('IG', '4강 승자', 3, 'msi') },
        ] },
      ],
      connectors: [
        [0, 0, 'b', 1, 0, 'a'], [0, 1, 'a', 1, 0, 'b'], [0, 2, 'a', 1, 1, 'a'], [0, 3, 'b', 1, 1, 'b'],
        [1, 0, 'b', 2, 0, 'a'], [1, 1, 'a', 2, 0, 'b'],
      ],
    });
    const demaciaCup = {
      name: 'Demacia Cup', regLabel: '스테이지 1', parallelGroups: true,
      rows: stage1,
      phaseStages: [{ label: '스테이지 2', rows: stage2 }],
      brackets: [{ slug: 'knockout', name: '녹아웃 스테이지', label: '녹아웃 스테이지', bracket: knockout }],
      finalStandings: [
        { rank: 1, team: 'IG', note: '우승' }, { rank: 2, team: 'JDG', note: '준우승' },
        { rank: 3, team: 'LGD', note: '4강' }, { rank: 4, team: 'LNG', note: '4강' },
        { rank: 5, team: 'AL', note: '8강' }, { rank: 6, team: 'EDG', note: '8강' },
        { rank: 7, team: 'TES', note: '8강' }, { rank: 8, team: 'OMG', note: '8강' },
      ],
    };
    // ── 2025 ASI (LoL Asia Invitational) — 8팀. 그룹(4팀 2개조 싱글RR·조별 2위 진출) → 녹아웃(4팀 더블 엘리). 우승 BFX.
    const G = (rank, team, w, l, gw, gl, group) => ({ rank, team, w, l, gw, gl, group });
    const asiGroups = [
      G(1, 'WBG', 2, 1, 4, 2, 'A조'), G(2, 'DK', 2, 1, 4, 2, 'A조'), G(3, 'GAM', 1, 2, 2, 4, 'A조'), G(4, 'JDG', 1, 2, 2, 4, 'A조'),
      G(1, 'BFX', 3, 0, 6, 1, 'B조'), G(2, 'NS', 2, 1, 5, 2, 'B조'), G(3, 'NIP', 1, 2, 2, 5, 'B조'), G(4, 'MVK', 0, 3, 1, 6, 'B조'),
    ];
    // 녹아웃 — 4팀 더블 엘리(승자조 Bo3 → 승자조 결승 / 패자조 → 결승 Bo5). KeSPA 결선과 동일한 그리드.
    const asiKnockout = {
      totalRows: 7,
      rounds: [
        { matches: [
          { title: '승자조 M13', time: '10/10', startRow: 0, a: S('WBG', 'A조 1위', 1), b: S('NS', 'B조 2위', 2, 'win') },
          { title: '승자조 M14', time: '10/10', startRow: 2, a: S('BFX', 'B조 1위', 0), b: S('DK', 'A조 2위', 2, 'win') },
          { title: '패자조 M16', time: '10/11', startRow: 5, a: S('WBG', 'M13 패자', 0, 'elim'), b: S('BFX', 'M14 패자', 2, 'win') },
        ] },
        { matches: [
          { title: '승자조 결승 M15', time: '10/10', startRow: 1, a: S('NS', '', 0), b: S('DK', '', 2, 'win') },
          { title: '패자조 결승 M17', time: '10/11', startRow: 5, a: S('NS', 'M15 패자', 0, 'elim'), b: S('BFX', '', 2, 'win') },
        ] },
        { matches: [
          { title: '결승 M18', time: '10/12', startRow: 3, a: S('DK', '', 2, 'elim'), b: S('BFX', '', 3, 'msi') },
        ] },
      ],
      connectors: [
        [0, 0, 'b', 1, 0, 'a'], [0, 1, 'b', 1, 0, 'b'], [0, 2, 'b', 1, 1, 'b'],
        [1, 0, 'b', 2, 0, 'a'], [1, 1, 'b', 2, 0, 'b'],
      ],
    };
    const asi = {
      name: 'Asia Invitational', regLabel: '그룹 스테이지', parallelGroups: true,
      rows: asiGroups,
      brackets: [{ slug: 'knockout', name: '녹아웃 스테이지', label: '녹아웃 스테이지', bracket: asiKnockout }],
      finalStandings: [
        { rank: 1, team: 'BFX', note: '우승' }, { rank: 2, team: 'DK', note: '준우승' },
        { rank: 3, team: 'NS', note: '3위' }, { rank: 4, team: 'WBG', note: '4위' },
        { rank: 5, team: 'GAM', note: '' }, { rank: 6, team: 'NIP', note: '' },
        { rank: 7, team: 'JDG', note: '' }, { rank: 8, team: 'MVK', note: '' },
      ],
    };
    const dm = ((past.standings['2025'] = past.standings['2025'] || {}).demacia = past.standings['2025'].demacia || {});
    dm['Demacia Cup'] = demaciaCup;
    dm['ASI'] = asi;
    fs.writeFileSync(pastFile, JSON.stringify(past, null, 2) + '\n');
    console.log('2025 Demacia Cup 주입 완료 (스테이지1 → 스테이지2 → 녹아웃 · 우승 iG)');
    console.log('2025 ASI 주입 완료 (그룹 스테이지 → 녹아웃 4팀 더블엘리 · 우승 BFX)');
  } catch (e) { console.warn(`2025 Demacia Cup 주입 실패(무시): ${e.message}`); }
}

// ── 팀별 우승 경력 자동 산출 ──────────────────────────────────────────────
//   앱이 추적하는 2026 대회의 우승팀(finalStandings 1위 · champion)을 모아 팀 상세 페이지용 lolTitles.json 생성.
{
  const LEAGUE_LABEL = { lck: 'LCK', lpl: 'LPL', lec: 'LEC', lcs: 'LCS', lcp: 'LCP', cblol: 'CBLOL' };
  const titleFor = (segs) => {
    const [lg, sub] = segs;
    if (lg === 'fst') return '2026 First Stand';
    if (lg === 'msi') return '2026 Mid-Season Invitational';
    if (lg === 'worlds') return '2026 Worlds';
    if (lg === 'ewc') return '2026 Esports World Cup';
    if (lg === 'asiangames') return '2026 Asian Games';
    if (!sub) return null;
    if (lg === 'lck' && sub === 'LCK CUP') return '2026 LCK CUP';
    if (lg === 'lck' && sub === 'KeSPA CUP') return '2026 LoL KeSPA CUP';
    if (lg === 'cblol' && sub === 'Copa') return 'Copa CBLOL 2026'; // 앱 표기와 동일
    if (lg === 'cblol') return `CBLOL 2026 ${sub}`;
    const lab = LEAGUE_LABEL[lg] || lg.toUpperCase();
    return sub === lab ? `2026 ${lab}` : `2026 ${lab} ${sub}`; // sub이 리그명과 같으면 중복 제거(예: LCK)
  };
  const titles = {};
  // 대회 상징색 — 프론트(lolSim.json comp.color + PredictionPage PAST_DETAIL/SUBTAB_DETAIL/COMP_GRADIENT)와 일치.
  const COMP_COLOR = { lck: '#1c192a', lpl: '#D32F2F', lec: '#00E0B0', lcs: '#eeece7', lcp: '#F08040', cblol: '#0b0718', fst: '#ff5500', msi: '#191919', ewc: '#f74e16', asiangames: '#079a3e', demacia: '#1826a1', worlds: '#dddddd' };
  const compStyle = (year, lg, sub) => {
    const y = String(year);
    if (lg === 'demacia') return sub === 'Demacia Cup' ? { color: '#446aca', gradient: 'linear-gradient(180deg, #446aca, #61a1ea)' } : (sub === 'ASI' ? { color: '#7927ff' } : { color: COMP_COLOR.demacia });
    if (lg === 'ewc') return y === '2026' ? { gradient: 'linear-gradient(90deg, #f74e16, #d1b36f)' } : { color: '#eaeaea' };
    if (lg === 'fst') return { color: y === '2025' ? '#45002c' : '#ff5500' };
    if (lg === 'lck') {
      if (sub === 'LCK CUP') return { color: y === '2025' ? '#7f6b00' : '#2a45b3' };
      if (sub === 'KeSPA CUP') return { color: '#072148' };
      return { color: COMP_COLOR.lck };
    }
    if (lg === 'lcs') { if (y === '2025' && (sub === 'Split 1' || sub === 'Playoffs')) return { color: '#b2a27e' }; return { color: y === '2025' ? '#3483F0' : COMP_COLOR.lcs }; }
    if (lg === 'cblol') { if (y === '2025' && (sub === 'Etapa 1' || sub === 'Playoffs')) return { color: '#b2a27e' }; return { color: y === '2025' ? '#D94F30' : COMP_COLOR.cblol }; }
    if (lg === 'msi') return { color: y === '2025' ? '#fe0000' : y === '2024' ? '#000000' : COMP_COLOR.msi }; // 2025·2024 상징색은 개별 유지
    if (lg === 'worlds' && y === '2025') return { color: '#0e2bf4' };
    return { color: COMP_COLOR[lg] || '#888' };
  };
  const add = (short, name, style) => {
    if (!short || !name) return;
    (titles[short] = titles[short] || []);
    if (!titles[short].some((t) => t.name === name)) titles[short].push({ name, detail: '우승', ...(style || {}) });
  };
  // 섹션/라운드 브래킷의 결승(마지막 섹션·마지막 라운드·마지막 매치) 승자 = 우승자.
  const bracketChampion = (br) => {
    if (!br) return null;
    const rounds = (Array.isArray(br.sections) && br.sections.length)
      ? br.sections[br.sections.length - 1].rounds
      : br.rounds;
    if (!Array.isArray(rounds) || !rounds.length) return null;
    const lm = rounds[rounds.length - 1]?.matches?.slice(-1)[0];
    if (!lm || lm.a?.score == null || lm.b?.score == null || lm.a.score === lm.b.score) return null;
    return lm.a.score > lm.b.score ? lm.a.short : lm.b.short;
  };
  const SKIP_KEYS = ['rows', 'players', 'teams', 'rounds', 'sections', 'connectors', 'qual', 'fs1', 'fs2', 'finalStandings', 'standings', 'knockout', 'groups', 'playin', 'playoffs', 'swiss', 'bracket', 'qualifier'];
  const walk = (obj, segs) => {
    if (!obj || typeof obj !== 'object') return;
    // 우승 확정(note '우승')인 완료 대회만 반영 — 진행 중 대회의 잠정 순위 1위(생존팀 제외 후 상위)를 우승으로 오등록하지 않도록.
    const stl = compStyle(2026, segs[0], segs[1]);
    if (Array.isArray(obj.finalStandings) && obj.finalStandings[0]?.team && obj.finalStandings[0]?.note === '우승') add(obj.finalStandings[0].team, titleFor(segs), stl);
    if (typeof obj.champion === 'string') add(obj.champion, titleFor(segs), stl);
    // MSI/Worlds는 최종 순위 대신 결승 대진 결과로 우승자 판정 (플레이-인·스위스 제외).
    const seg = segs[segs.length - 1];
    if ((segs[0] === 'msi' && seg === '브래킷 스테이지') || (segs[0] === 'worlds' && seg === '녹아웃 스테이지')) {
      add(bracketChampion(obj.bracket), titleFor(segs), stl);
    }
    for (const k of Object.keys(obj)) {
      if (SKIP_KEYS.includes(k)) continue;
      if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) walk(obj[k], segs.concat(k));
    }
  };
  for (const lg of Object.keys(data.standings)) walk(data.standings[lg], [lg]);

  // 과거 에디션(2025 이하) 우승 경력 — 기준: 선발전 제외, 최종순위 1위 = 우승.
  try {
    const pastFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolPastEditions.json');
    const past = JSON.parse(fs.readFileSync(pastFile, 'utf8'));
    const DISP = { lck: 'LCK', lpl: 'LPL', lec: 'LEC', lcs: 'LCS', lcp: 'LCP', cblol: 'CBLOL' };
    const isSeonbal = (sub) => /선발전/.test(sub || ''); // '선발전' · '대표 선발전' 제외
    const champOf = (node) => (Array.isArray(node?.finalStandings) && node.finalStandings[0]?.team) || null;
    // 대회 표기 — 프론트 표시와 최대한 일치(2025 LTA 재편·CBLOL Etapa·LCK CUP 등).
    const compName = (year, lg, sub) => {
      if (lg === 'fst') return `${year} First Stand`;
      if (lg === 'msi') return `${year} Mid-Season Invitational`;
      if (lg === 'worlds') return `${year} Worlds`;
      if (String(year) === '2025' && (lg === 'lcs' || lg === 'cblol') && sub === 'Playoffs') return `${year} LTA Playoffs`;
      if (String(year) === '2025' && (lg === 'lcs' || lg === 'cblol') && (sub === 'Split 1' || sub === 'Etapa 1')) return `${year} LTA Split 1`; // 통합 스플릿 = 단일 우승
      if (String(year) === '2025' && lg === 'lcs') return sub === 'Split 1' ? `${year} LTA Split 1` : `${year} LTA North ${sub}`;
      if (String(year) === '2025' && lg === 'cblol') return sub === 'Etapa 1' ? `${year} LTA Etapa 1` : `${year} LTA Sul ${sub}`;
      if (lg === 'cblol') return sub === 'Copa' ? `Copa CBLOL ${year}` : `CBLOL ${year} ${sub}`;
      if (lg === 'lck' && sub === 'LCK CUP') return `${year} LCK CUP`;
      if (lg === 'lck' && sub === 'KeSPA CUP') return `${year} LoL KeSPA CUP`;
      if (lg === 'demacia') return sub === 'Demacia Cup' ? `${year} Demacia Cup` : (sub === 'ASI' ? `${year} Asia Invitational` : `${year} ${sub}`);
      if (String(year) === '2025' && lg === 'lcp') { const M = { Kickoff: 'Season Kickoff', Mid: 'Mid Season', Finals: 'Season Finals' }; if (M[sub]) return `${year} LCP ${M[sub]}`; }
      const disp = DISP[lg] || lg.toUpperCase();
      const subPart = (sub && sub !== disp) ? ` ${sub}` : '';
      return `${year} ${disp}${subPart}`;
    };
    for (const [year, lgs] of Object.entries(past.standings || {})) {
      if (year !== '2025' && year !== '2024') continue; // 2024~2026 대회 우승 경력 반영(2026은 라이브 data.standings에서 별도 산출)
      for (const [lg, v] of Object.entries(lgs || {})) {
        if (lg === 'ewc' && v?.champion) {                    // EWC(그룹+플레이오프 구조) — champion 필드로 우승 반영
          add(v.champion, `${year} Esports World Cup`, compStyle(year, 'ewc', null));
        } else if (v && Array.isArray(v.finalStandings)) {   // 단일 대회(msi/worlds/fst)
          add(champOf(v), compName(year, lg, null), compStyle(year, lg, null));
        } else if (v && typeof v === 'object') {             // 서브탭형 리그
          for (const [sub, node] of Object.entries(v)) {
            if (isSeonbal(sub) || sub === 'Road to MSI') continue; // 선발전·Road to MSI 제외
            if (lg === 'lcp' && (sub === 'PCS' || sub === 'VCS') && node && !node.finalStandings) {
              // 대회 선택형(2024 PCS·VCS) — 이벤트 → 스플릿 2단 구조
              for (const [sp, n2] of Object.entries(node)) add(champOf(n2), `${year} ${sub} ${sp}`, compStyle(year, lg, sp));
              continue;
            }
            add(champOf(node), compName(year, lg, sub), compStyle(year, lg, sub));
          }
        }
      }
    }
  } catch (e) { console.warn(`과거 우승 경력 산출 실패(무시): ${e.message}`); }

  // 정렬 — 최신 연도 위로, 같은 연도 내에서는 대회 개최 순서(대략)의 역순.
  // 개최 순서(이른 대회 → 늦은 대회). 최신순 정렬 시 뒤쪽(늦은 대회)이 위로 온다.
  //   LCK CUP·첫 스플릿(LPL Split 1 등)은 First Stand보다 먼저 진행 → First Stand 앞에 배치.
  const TITLE_ORDER = ['LCK CUP', 'Lock-In', 'Lock In', 'Versus', 'Winter', 'Kickoff', 'Split 1', 'Etapa 1', 'First Stand', 'Spring', 'Road to MSI', 'Mid-Season', 'Mid Season', 'Split 2', 'Etapa 2', 'Summer', 'Esports World Cup', '시즌 파이널', 'Season Finals', 'Split 3', 'Etapa 3', 'Playoffs', 'Copa', 'Worlds', 'KeSPA'];
  const ord = (name) => { const i = TITLE_ORDER.findIndex((k) => name.includes(k)); return i < 0 ? 99 : i; };
  const yearOf = (name) => { const m = name.match(/\b(20\d{2})\b/); return m ? Number(m[1]) : 0; };
  for (const short of Object.keys(titles)) titles[short].sort((a, b) => (yearOf(b.name) - yearOf(a.name)) || (ord(b.name) - ord(a.name)));
  const titlesFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolTitles.json');
  fs.writeFileSync(titlesFile, JSON.stringify({ updatedAt: data.updatedAt, titles }, null, 2) + '\n');
  console.log(`우승 경력 자동 산출: ${Object.keys(titles).length}개 팀 (${Object.values(titles).reduce((n, a) => n + a.length, 0)}개 타이틀)`);
}
