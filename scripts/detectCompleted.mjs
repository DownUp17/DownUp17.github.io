// scripts/detectCompleted.mjs
// 추적 중인 모든 대회의 공식 일정에서 '완료된 경기' ID를 모아, 지난 실행 때 저장한 목록과 비교한다.
// 새로 완료된 경기가 있으면 GITHUB_OUTPUT 에 changed=true 를 쓰고 목록을 갱신한다(워크플로가 이후 갱신 단계를 실행).
// 추가로 '진행 중' 경기(getLive — 사이트의 실시간 경기 기능과 같은 소스)에서 한 팀이 시리즈 승리 포인트
//   (Bo1=1, Bo3=2, Bo5=3 승)에 도달하면 경기 종료 처리(completed)를 기다리지 않고 갱신을 시작한다.
//
// 실행: node scripts/detectCompleted.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LOLESPORTS_API_KEY } from './lolesportsKey.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, 'data', 'completedMatches.json');

const API = 'https://esports-api.lolesports.com/persisted/gw';
const LEAGUES = {
  lck: '98767991310872058',
  lpl: '98767991314006698',
  lec: '98767991302996019',
  lcp: '113476371197627891',
  lcs: '98767991299243165',
  cblol: '98767991332355509',
  msi: '98767991325878492',
  worlds: '98767975604431411',
  fst: '113464388705111224',
  demacia: '117126995932274206',
  asiangames: '117228885404001005',
  ewc: '116838530616006090',
};

// getLive 이벤트의 리그 slug → 추적 대회 (이 대회들의 경기만 승리 포인트 감지)
const LIVE_SLUGS = new Set(['lck', 'lpl', 'lec', 'lcp', 'lcs', 'cblol-brazil', 'msi', 'worlds', 'first_stand', 'demacia_cup', 'asian_games', 'ewc_lol']);
const keyOf = (slug) => ({ 'cblol-brazil': 'cblol', first_stand: 'fst', demacia_cup: 'demacia', asian_games: 'asiangames', ewc_lol: 'ewc' }[slug] || slug);

const get = async (params) => {
  const res = await fetch(`${API}/getSchedule?` + new URLSearchParams({ hl: 'ko-KR', ...params }), { headers: { 'x-api-key': LOLESPORTS_API_KEY } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { leagues: {} };
const next = { leagues: {} };
const fresh = [];
let failed = 0;

for (const [key, leagueId] of Object.entries(LEAGUES)) {
  try {
    // 기본 페이지(현재 시점 주변) + 한 페이지 이전까지 — 최근 완료 경기를 놓치지 않기 위함
    const ids = new Set();
    let token = null;
    for (let i = 0; i < 2; i++) {
      const j = await get({ leagueId, ...(token ? { pageToken: token } : {}) });
      for (const e of j.data?.schedule?.events || []) if (e.type === 'match' && e.state === 'completed' && e.match?.id) ids.add(e.match.id);
      token = j.data?.schedule?.pages?.older;
      if (!token) break;
    }
    const before = new Set(prev.leagues[key] || []);
    // 이전 목록과 합집합으로 보존(페이지 범위 밖으로 밀려난 옛 경기를 새 경기로 오인하지 않도록)
    next.leagues[key] = [...new Set([...before, ...ids])].sort();
    // 목록이 아직 없는 첫 실행은 기준선만 만들고 '새 경기'로 보지 않는다
    if (prev.leagues[key]) for (const id of ids) if (!before.has(id)) fresh.push(`${key}:${id}`);
  } catch (e) {
    failed++;
    next.leagues[key] = prev.leagues[key] || []; // 실패한 대회는 기존 목록 유지
    console.warn(`${key} 일정 조회 실패(무시): ${e.message}`);
  }
}

// ── 승리 포인트 도달 감지 ──────────────────────────────────────────────────────
//   진행 중 경기마다 getEventDetails 로 세트 스코어·bestOf 를 읽어 need(=⌊bestOf/2⌋+1)승에 도달한 팀이 있으면
//   그 경기를 한 번만 '확정'으로 기록한다. 공식 순위·대진 API 는 경기가 completed 가 된 뒤에야 승패를 반영하므로,
//   새로 확정된 경기가 있으면 completed 가 될 때까지(최대 CLINCH_WAIT_MS) 기다렸다가 갱신을 시작한다.
const CLINCH_WAIT_MS = 5 * 60 * 1000;
const CLINCH_POLL_MS = 15 * 1000;
const prevClinched = new Set(prev.clinched || []);
const nextClinched = new Set(prevClinched);
const newClinch = [];
const winsNeeded = (bestOf) => Math.floor((bestOf || 1) / 2) + 1;
try {
  const live = await (await fetch(`${API}/getLive?hl=ko-KR`, { headers: { 'x-api-key': LOLESPORTS_API_KEY } })).json();
  const events = (live?.data?.schedule?.events || []).filter((e) => e.type === 'match' && e.state === 'inProgress' && LIVE_SLUGS.has(e.league?.slug));
  for (const e of events) {
    const id = e.match?.id || e.id;
    if (prevClinched.has(id)) continue;
    const det = await (await fetch(`${API}/getEventDetails?hl=ko-KR&id=${id}`, { headers: { 'x-api-key': LOLESPORTS_API_KEY } })).json().catch(() => null);
    const m = det?.data?.event?.match || e.match || {};
    const need = winsNeeded(m.strategy?.count || e.match?.strategy?.count);
    const point = (m.teams || []).find((t) => (t.result?.gameWins ?? 0) >= need);
    if (point) { nextClinched.add(id); newClinch.push({ id, league: keyOf(e.league.slug), team: point.code, wins: point.result.gameWins, need }); }
  }
} catch (err) { console.warn(`실시간 경기 조회 실패(무시): ${err.message}`); }

if (newClinch.length) {
  for (const c of newClinch) fresh.push(`${c.league}:${c.id}(승리 포인트 ${c.team} ${c.wins}/${c.need})`);
  // 확정된 경기가 completed 가 될 때까지 대기 — 아니면 갱신이 승자 없는 중간 스코어만 가져온다
  const deadline = Date.now() + CLINCH_WAIT_MS;
  const pending = new Map(newClinch.map((c) => [c.id, c.league]));
  while (pending.size && Date.now() < deadline) {
    for (const [id, lg] of [...pending]) {
      try {
        const j = await get({ leagueId: LEAGUES[lg] });
        const ev = (j.data?.schedule?.events || []).find((x) => x.match?.id === id);
        if (ev?.state === 'completed') { pending.delete(id); next.leagues[lg] = [...new Set([...(next.leagues[lg] || []), id])].sort(); }
      } catch { /* 다음 시도에서 재조회 */ }
    }
    if (pending.size) await new Promise((r) => setTimeout(r, CLINCH_POLL_MS));
  }
  if (pending.size) console.warn(`completed 확인 전 대기 시간 초과 — 그대로 갱신 진행: ${[...pending.keys()].join(', ')}`);
}
next.clinched = [...nextClinched].slice(-300);

const baselineOnly = Object.keys(prev.leagues).length === 0;
const changed = fresh.length > 0;
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');

console.log(baselineOnly ? '기준선 생성(첫 실행)' : changed ? `갱신 대상 경기 ${fresh.length}건: ${fresh.join(', ')}` : '새로 완료되거나 승리 포인트에 도달한 경기 없음');
if (failed === Object.keys(LEAGUES).length) { console.error('모든 대회 조회 실패'); process.exit(1); }
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
