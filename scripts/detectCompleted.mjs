// scripts/detectCompleted.mjs
// 추적 중인 모든 대회의 공식 일정에서 '완료된 경기' ID를 모아, 지난 실행 때 저장한 목록과 비교한다.
// 새로 완료된 경기가 있으면 GITHUB_OUTPUT 에 changed=true 를 쓰고 목록을 갱신한다(워크플로가 이후 갱신 단계를 실행).
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

const baselineOnly = Object.keys(prev.leagues).length === 0;
const changed = fresh.length > 0;
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');

console.log(baselineOnly ? '기준선 생성(첫 실행)' : changed ? `새로 완료된 경기 ${fresh.length}건: ${fresh.join(', ')}` : '새로 완료된 경기 없음');
if (failed === Object.keys(LEAGUES).length) { console.error('모든 대회 조회 실패'); process.exit(1); }
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
