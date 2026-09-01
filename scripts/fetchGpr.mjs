// scripts/fetchGpr.mjs
// lolesports.com GPR 페이지(서버 렌더 HTML)에서 팀별 GPR 점수·전적을 추출해
// client/src/data/gprTeams.json 의 score/w/l 을 갱신한다. 브라우저 불필요(서버 fetch).
//
// 실행: node scripts/fetchGpr.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '..', 'client', 'src', 'data', 'gprTeams.json');
const gprFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolGpr.json');
const URL = 'https://lolesports.com/ko-KR/gpr/2026/current';
// GPR 페이지 slug → lolGpr.json key 매핑
const SLUG_TO_KEY = { lck: 'LCK', lpl: 'LPL', lec: 'LEC', lcp: 'LCP', lcs: 'LCS', 'cblol-brazil': 'CBLOL' };

// gprTeams.json 의 short 는 GPR 사이트 코드를 그대로 사용 → 별칭 불필요
const ALIAS = {};

const res = await fetch(URL, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  },
});
if (!res.ok) throw new Error(`GPR fetch 실패: HTTP ${res.status}`);
const html = await res.text();

// 페이지의 RSC 페이로드에서 TeamGPR 블록별로 추출
const chunks = html.split('"__typename":"TeamGPR"');
const gpr = {};
for (const raw of chunks.slice(1)) {
  const ch = raw.slice(0, 6000);
  const code = ch.match(/"code":"([^"]+)"/);
  const score = ch.match(/"currentTeamGPR":\{[^}]*?"gprScore":(\d+)/);
  const wl = ch.match(/"teamMatchRecord":\{"__typename":"WinLoss","(?:wins":(\d+),"losses":(\d+)|losses":(\d+),"wins":(\d+))\}/);
  const gwl = ch.match(/"teamGameRecord":\{"__typename":"WinLoss","(?:wins":(\d+),"losses":(\d+)|losses":(\d+),"wins":(\d+))\}/);
  const logo = ch.match(/"image":"(https?:\/\/[^"]*\/teams\/[^"]+)"/i); // 팀 로고(리그 로고 제외)
  if (!code || !score) continue;
  const key = ALIAS[code[1]] || code[1];
  if (gpr[key]) continue; // 첫 등장(현재 시즌)만
  gpr[key] = {
    score: Number(score[1]),
    w: wl ? Number(wl[1] ?? wl[4]) : null,
    l: wl ? Number(wl[2] ?? wl[3]) : null,
    gw: gwl ? Number(gwl[1] ?? gwl[4]) : null, // 세트(게임) 승
    gl: gwl ? Number(gwl[2] ?? gwl[3]) : null, // 세트(게임) 패
    logo: logo ? logo[1].replace(/^http:/, 'https:') : null,
  };
}

const found = Object.keys(gpr).length;
console.log(`추출된 팀: ${found}`);
if (found < 50) throw new Error(`추출 팀 수 비정상(${found}). 페이지 구조 변경 가능성 — 갱신 중단.`);

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
let updated = 0;
let scoreChanged = 0; // 시뮬은 GPR 점수(score)만 입력으로 쓰므로 점수 변화만 별도 집계
const changedLeagues = new Set(); // 점수가 바뀐 팀이 속한 리그(이 리그만 시뮬 재계산)
const missing = [];
for (const t of data.teams) {
  const g = gpr[t.short];
  if (!g) { missing.push(t.short); continue; }
  if (t.score !== g.score) { scoreChanged++; if (t.league) changedLeagues.add(t.league); }
  if (t.score !== g.score || t.w !== g.w || t.l !== g.l || t.gw !== g.gw || t.gl !== g.gl || t.logo !== g.logo) updated++;
  t.score = g.score;
  if (g.w != null) t.w = g.w;
  if (g.l != null) t.l = g.l;
  if (g.gw != null) t.gw = g.gw;
  if (g.gl != null) t.gl = g.gl;
  if (g.logo) t.logo = g.logo;
}
if (missing.length) console.warn(`주의: GPR에서 못 찾은 팀 → ${missing.join(', ')}`);

data.updatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`gprTeams.json 갱신: ${updated}팀 변경(점수 변화 ${scoreChanged}팀), updatedAt=${data.updatedAt}`);

// 지역별 GPR 점수(leagueElo) 추출 후 lolGpr.json 갱신
const leagueEloRe = /"slug":"([^"]+)"\},"leagueElo":(\d+)/g;
const leagueElo = {};
let em;
while ((em = leagueEloRe.exec(html)) !== null) {
  const key = SLUG_TO_KEY[em[1]];
  if (key) leagueElo[key] = Number(em[2]);
}
if (Object.keys(leagueElo).length >= 6) {
  const gprData = JSON.parse(fs.readFileSync(gprFile, 'utf8'));
  let regionUpdated = 0;
  for (const region of gprData.regions) {
    if (leagueElo[region.key] != null && region.score !== leagueElo[region.key]) {
      region.score = leagueElo[region.key];
      regionUpdated++;
    }
  }
  gprData.fetchedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(gprFile, JSON.stringify(gprData, null, 2) + '\n');
  console.log(`lolGpr.json 갱신: ${regionUpdated}개 지역 점수 변경 (${Object.entries(leagueElo).map(([k,v]) => `${k}:${v}`).join(', ')})`);
} else {
  console.warn(`지역 GPR 추출 실패(${Object.keys(leagueElo).length}개) — lolGpr.json 유지`);
}

// 경기 결과만 바뀐 경우(GPR 점수는 그대로)에도 해당 대회의 시뮬만 재실행.
// 각 대회별로 개별 시그니처를 저장·비교해 변화한 대회의 리그만 simLeagues에 추가한다.
let bracketChangedLeagues = [];
try {
  const stPath = path.join(__dirname, '..', 'client', 'src', 'data', 'lolStandings.json');
  const simPath = path.join(__dirname, '..', 'client', 'src', 'data', 'lolSim.json');
  const st = JSON.parse(fs.readFileSync(stPath, 'utf8'));
  const simData = JSON.parse(fs.readFileSync(simPath, 'utf8'));
  // 대회 → 리그 매핑(시뮬 대상). Worlds/DCGI는 아직 시뮬 미지원이라 제외.
  const bracketSigs = {
    MSI: JSON.stringify({
      pi: st.standings?.msi?.['플레이-인 스테이지']?.bracket ?? null,
      br: st.standings?.msi?.['브래킷 스테이지']?.bracket ?? null,
    }),
    LCK: JSON.stringify({
      pi: st.standings?.lck?.LCK?.playin ?? null,
      po: st.standings?.lck?.LCK?.playoffs ?? null,
    }),
    LPL: JSON.stringify({
      po: st.standings?.lpl?.['Split 3']?.playoffs ?? null,
      rq: st.standings?.lpl?.['대표 선발전']?.qualifier ?? null,
    }),
    LCP: JSON.stringify({
      swiss: st.standings?.lcp?.['Split 3']?.swiss ?? null,
      pi: st.standings?.lcp?.['Split 3']?.playin ?? null,
      po: st.standings?.lcp?.['Split 3']?.playoffs ?? null,
    }),
  };
  const oldSigs = simData.bracketSigs || {};
  bracketChangedLeagues = Object.keys(bracketSigs).filter((k) => oldSigs[k] !== bracketSigs[k]);
} catch (e) {
  console.warn(`브래킷 변화 감지 실패(무시): ${e.message}`);
}

// GPR 점수·브래킷 결과가 바뀐 리그만 시뮬 재계산 (변화 없는 리그는 기존 결과 유지).
const simLeagues = Array.from(new Set([...changedLeagues, ...bracketChangedLeagues]));
if (simLeagues.length) {
  const parts = [];
  if (changedLeagues.length) parts.push(`GPR 변화 [${changedLeagues.join(', ')}]`);
  if (bracketChangedLeagues.length) parts.push(`브래킷 변화 [${bracketChangedLeagues.join(', ')}]`);
  console.log(`— ${parts.join(' + ')} → 시뮬 재실행 [${simLeagues.join(', ')}] —`);
  execFileSync('node', [path.join(__dirname, 'simulateLol.mjs'), ...simLeagues], { stdio: 'inherit' });
} else {
  console.log('— GPR·브래킷 변화 없음 → 시뮬레이션 생략 —');
}
