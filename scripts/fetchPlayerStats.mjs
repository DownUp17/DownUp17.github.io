// scripts/fetchPlayerStats.mjs
// 2026 시즌 선수별 기록 — lolesports livestats(details·window)로 경기별 최종 성적을 모아 집계.
//   경기(게임) 단위 결과는 scripts/data/gameStatsCache.json에 캐시 → 매 실행 시 새로 끝난 게임만 조회.
//   출력: client/src/data/lolPlayerStats.json  { players: { esportsPlayerId: { name, team, role, games, k, d, a, kda, csm, gpm, dmgShare, kp, champions } } }
//   게임 최종 프레임: details/{gameId}?startingTime=(게임 시작 + 2시간) → 경기 종료 시점 마지막 프레임이 온다.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LOLESPORTS_API_KEY } from './lolesportsKey.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEASON = 2026;
const API = 'https://esports-api.lolesports.com/persisted/gw';
const FEED = 'https://feed.lolesports.com/livestats/v1';
const CACHE_FILE = path.join(__dirname, 'data', 'gameStatsCache.json');
const OUT_FILE = path.join(__dirname, '..', 'client', 'src', 'data', 'lolPlayerStats.json');

// 집계 대상: 지역 리그 + 국제대회 (팀 단위 대회. 국가대항전 AG는 제외)
const LEAGUES = {
  LCK: '98767991310872058', LPL: '98767991314006698', LEC: '98767991302996019', LCS: '98767991299243165',
  LCP: '113476371197627891', CBLOL: '98767991332355509', MSI: '98767991325878492', Worlds: '98767975604431411',
  EWC: '116838530616006090', 'KeSPA Cup': '116929044967296666', DCGI: '117126995932274206',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (url, key) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, key ? { headers: { 'x-api-key': LOLESPORTS_API_KEY } } : undefined);
      if (r.status === 204) return null;
      if (r.ok) { const t = await r.text(); return t ? JSON.parse(t) : null; }
      if (r.status === 400 || r.status === 404) return null;
    } catch { /* 재시도 */ }
    await sleep(800 * (i + 1));
  }
  return null;
};

let cache = { games: {}, matches: {} };
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { /* 최초 실행 */ }
cache.games = cache.games || {}; cache.matches = cache.matches || {}; cache.failed = cache.failed || {};
const RETRY_MS = 7 * 24 * 3600e3; // 피드 데이터가 없는 게임은 7일 뒤에 다시 시도

// 1) 시즌 완료 경기(match) 목록 — 리그별 일정(과거 페이지 포함)
async function seasonMatches(leagueId) {
  const out = [];
  let page = null;
  for (let i = 0; i < 30; i++) {
    const j = await getJson(`${API}/getSchedule?hl=ko-KR&leagueId=${leagueId}${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`, true);
    const ev = j?.data?.schedule?.events || [];
    out.push(...ev.filter((e) => e.type === 'match' && e.state === 'completed' && new Date(e.startTime).getUTCFullYear() === SEASON));
    if (ev.length && ev.every((e) => new Date(e.startTime).getUTCFullYear() < SEASON)) break;
    page = j?.data?.schedule?.pages?.older; if (!page) break;
  }
  return out;
}

// 2) 게임 1개 → 참가자 최종 기록
async function gameStats(gameId) {
  const w = await getJson(`${FEED}/window/${gameId}`); // 시작 구간 + 메타데이터(선수·챔피언·팀)
  if (!w?.frames?.length || !w.gameMetadata) return null;
  const t0 = new Date(w.frames[0].rfc460Timestamp).getTime();
  const end = new Date(Math.floor((t0 + 2 * 3600e3) / 10000) * 10000).toISOString();
  const d = await getJson(`${FEED}/details/${gameId}?startingTime=${end}`);
  const last = d?.frames?.[d.frames.length - 1];
  const wl = await getJson(`${FEED}/window/${gameId}?startingTime=${end}`);
  const lastW = wl?.frames?.[wl.frames.length - 1];
  if (!last || !lastW || lastW.gameState !== 'finished') return null; // 미완료·데이터 없음
  const minutes = Math.max(1, (new Date(lastW.rfc460Timestamp).getTime() - t0) / 60000);
  const meta = [...(w.gameMetadata.blueTeamMetadata.participantMetadata || []).map((p) => ({ ...p, side: 'blue' })),
    ...(w.gameMetadata.redTeamMetadata.participantMetadata || []).map((p) => ({ ...p, side: 'red' }))];
  const teamOf = { blue: w.gameMetadata.blueTeamMetadata.esportsTeamId, red: w.gameMetadata.redTeamMetadata.esportsTeamId };
  // (승패는 livestats에 넥서스 파괴 정보가 없어 집계하지 않음)
  return {
    minutes: Math.round(minutes * 10) / 10,
    players: last.participants.map((p) => {
      const m = meta.find((x) => x.participantId === p.participantId) || {};
      return {
        pid: m.esportsPlayerId || null, name: m.summonerName || null, champ: m.championId || null, role: m.role || null, team: teamOf[m.side] || null,
        k: p.kills, d: p.deaths, a: p.assists, cs: p.creepScore, gold: p.totalGoldEarned,
        dmg: Math.round((p.championDamageShare || 0) * 1000) / 1000, kp: Math.round((p.killParticipation || 0) * 1000) / 1000,
      };
    }),
  };
}

async function main() {
  let newGames = 0, failed = 0;
  for (const [lname, lid] of Object.entries(LEAGUES)) {
    const matches = await seasonMatches(lid);
    let lgNew = 0;
    for (const e of matches) {
      const mid = e.match.id;
      // 경기 → 게임 ID 목록(캐시)
      if (!cache.matches[mid]) {
        const det = await getJson(`${API}/getEventDetails?hl=ko-KR&id=${mid}`, true);
        const games = (det?.data?.event?.match?.games || []).filter((g) => g.state === 'completed').map((g) => g.id);
        if (!games.length) continue;
        cache.matches[mid] = { league: lname, start: e.startTime, games };
        await sleep(60);
      }
      for (const gid of cache.matches[mid].games) {
        if (cache.games[gid] || (cache.failed[gid] && Date.now() - cache.failed[gid] < RETRY_MS)) continue;
        const g = await gameStats(gid).catch(() => null);
        if (g) { cache.games[gid] = { league: lname, match: mid, ...g }; delete cache.failed[gid]; newGames++; lgNew++; } else { cache.failed[gid] = Date.now(); failed++; }
        if (g && lgNew % 25 === 0) console.log(`  ${lname}: 신규 게임 ${lgNew}…`);
        await sleep(60);
      }
    }
    console.log(`${lname}: 완료 경기 ${matches.length} · 신규 게임 ${lgNew}`);
    // 리그마다 캐시 저장 — 중간에 끊겨도 다음 실행에서 이어서 진행
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  }
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));

  // 3) 선수별 집계
  // CtO(상대 대비) 가중치 w = (상대 팀 GPR) / (우리 팀 GPR). 팀 ID → 약칭(lolRosters) → GPR 점수(gprTeams).
  //   GPR이 없는 팀(초청팀 등)이 낀 게임은 CtO 집계에서만 제외.
  const readJson = (f) => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'data', f), 'utf8')); } catch { return null; } };
  const gprByShort = Object.fromEntries((readJson('gprTeams.json')?.teams || []).map((t) => [t.short, t.score]));
  const gprById = {};
  for (const [short, v] of Object.entries(readJson('lolRosters.json')?.rosters || {})) if (v.id && gprByShort[short] != null) gprById[v.id] = gprByShort[short];
  const P = {};
  for (const g of Object.values(cache.games)) {
    for (const p of g.players) {
      if (!p.pid) continue;
      const s = (P[p.pid] = P[p.pid] || { name: p.name, role: p.role, team: p.team, games: 0, k: 0, d: 0, a: 0, cs: 0, gold: 0, min: 0, dmg: 0, kp: 0, champs: {}, leagues: {},
        cto: { games: 0, w: 0, ka: 0, d: 0, cs: 0, gold: 0, min: 0, dmg: 0, kp: 0 } });
      // CtO — 같은 게임의 상대 팀 GPR / 우리 팀 GPR. 킬·어시스트·CS·골드·딜 비중·킬 관여에 가중, 데스는 그대로.
      const oppId = g.players.find((x) => x.team && x.team !== p.team)?.team;
      const own = gprById[p.team], opp = gprById[oppId];
      if (own && opp) {
        const w = opp / own, c = s.cto;
        c.games++; c.w += w; c.ka += w * (p.k + p.a); c.d += p.d; c.cs += w * p.cs; c.gold += w * p.gold; c.min += g.minutes; c.dmg += w * p.dmg; c.kp += w * p.kp;
      }
      s.name = p.name; s.role = p.role || s.role; s.team = p.team || s.team; // 최신 경기 기준으로 갱신
      s.games++; s.k += p.k; s.d += p.d; s.a += p.a; s.cs += p.cs; s.gold += p.gold; s.min += g.minutes; s.dmg += p.dmg; s.kp += p.kp;
      if (p.champ) s.champs[p.champ] = (s.champs[p.champ] || 0) + 1;
      s.leagues[g.league] = (s.leagues[g.league] || 0) + 1;
    }
  }
  const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
  const players = Object.fromEntries(Object.entries(P).map(([pid, s]) => [pid, {
    name: s.name, role: s.role, teamId: s.team, games: s.games,
    k: r1(s.k / s.games), d: r1(s.d / s.games), a: r1(s.a / s.games),
    kda: r2((s.k + s.a) / Math.max(1, s.d)), csm: r1(s.cs / s.min), gpm: Math.round(s.gold / s.min),
    dmgShare: r2(s.dmg / s.games), kp: r2(s.kp / s.games),
    // CtO(상대 대비): 상대가 강할수록(가중치 > 1) 높게, 약할수록 낮게 반영한 같은 지표
    cto: s.cto.games ? {
      games: s.cto.games, weight: r2(s.cto.w / s.cto.games), // weight = 평균 상대 강도(상대 GPR / 우리 GPR)
      kda: r2(s.cto.ka / Math.max(1, s.cto.d)), csm: r1(s.cto.cs / s.cto.min), gpm: Math.round(s.cto.gold / s.cto.min),
      dmgShare: r2(s.cto.dmg / s.cto.games), kp: r2(s.cto.kp / s.cto.games),
    } : null,
    champions: Object.entries(s.champs).sort((a, b) => b[1] - a[1]).slice(0, 5),
    leagues: s.leagues,
  }]));
  fs.writeFileSync(OUT_FILE, JSON.stringify({ updatedAt: new Date().toISOString().slice(0, 10), season: SEASON, games: Object.keys(cache.games).length, players }, null, 1) + '\n');
  console.log(`선수 기록 저장: ${Object.keys(players).length}명 · 게임 ${Object.keys(cache.games).length} (신규 ${newGames}, 실패 ${failed})`);
}

// 단일 게임 확인: node scripts/fetchPlayerStats.mjs --game <gameId>
if (process.argv[2] === '--game') gameStats(process.argv[3]).then((g) => console.log(JSON.stringify(g, null, 1)));
else main();
