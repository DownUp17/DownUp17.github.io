// scripts/fetchRosters.mjs
// lolesports API에서 각 팀의 선수 로스터를 가져와 lolRosters.json 생성

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LOLESPORTS_API_KEY } from './lolesportsKey.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_KEY = LOLESPORTS_API_KEY; // 환경변수(.env / Actions Secrets)에서 로드 — scripts/lolesportsKey.mjs

// short → lolesports team ID
const TEAM_IDS = {
  // LCK
  GEN: '100205573495116443',
  T1:  '98767991853197861',
  HLE: '100205573496804586',
  KT:  '99566404579461230',
  DK:  '100725845018863243',
  BFX: '100725845022060229',
  KRX: '99566404585387054',
  BRO: '105505619546859895',
  NS:  '102747101565183056',
  DNS: '99566404581868574',
  // LPL
  BLG: '99566404853854212',
  TES: '99566404854685458',
  JDG: '99566404852189289',
  AL:  '99566404856367466',
  WBG: '99566404853058754',
  NIP: '101388912914513220',
  IG:  '99566404848691211',
  WE:  '98767991887166787',
  LNG: '99566404850008779',
  TT:  '101388912911039804',
  LGD: '99566404846951820',
  EDG: '98767991882270868',
  UP:  '103461966986776720',
  OMG: '99566404845279652',
  // LEC
  G2:   '98767991926151025',
  FNC:  '98767991866488695',
  VIT:  '99322214695067838',
  KC:   '111692118851466302',
  SK:   '101383793567806688',
  GX:   '101383793572656373',
  MKOI: '103461966965149786',
  SHFT: '107563714667537640',
  TH:   '109637393694097670',
  NAVI: '114868016111590239',
  // LCS
  LYON: '99566405941863385',
  C9:   '98767991877340524',
  FLY:  '98926509892121852',
  TLAW: '98926509885559666',
  DIG:  '98926509883054987',
  DSG:  '110428362822825796',
  SR:   '111504538396430510',
  SEN:  '115688562107799886',
  // LCP
  TSW: '113661839307879869',
  GAM: '98767991954244555',
  DCG: '107700204561086446',
  CFO: '107700199633958891',
  MVK: '107251245690956393',
  SHG: '103535282119620510',
  GZ:  '109675490370327425',
  DFM: '100285330168091787',
  // CBLOL
  FUR:  '100205576309502431',
  RED:  '99566408221961358',
  LOUD: '105397404796640412',
  PAIN: '99566408217955692',
  VKS:  '99566408219409348',
  LOS:  '109480204628225868',
  FX:   '109480056092207899',
  LEV:  '107598699275015260',
};

const ROLE_ORDER = ['top', 'jungle', 'mid', 'bottom', 'support'];

// 주전 판별용 리그 일정 (MyPredictionPage 와 동일)
const LEAGUE_IDS = [
  '98767991310872058',  // LCK
  '98767991314006698',  // LPL
  '98767991302996019',  // LEC
  '98767991299243165',  // LCS
  '98767991325878492',  // MSI
  '113476371197627891', // LCP
  '98767991332355509',  // CBLOL
  // 국제·이벤트 대회 — 시즌 후반 마지막 경기가 이쪽에 있는 팀(예: LCP 팀의 DCGI)도 최신 라인업으로 판별
  '98767975604431411',  // Worlds
  '113464388705111224', // First Stand
  '116838530616006090', // EWC
  '116929044967296666', // KeSPA Cup
  '117126995932274206', // DCGI
];

const api = (path) =>
  fetch(`https://esports-api.lolesports.com/persisted/gw/${path}`, {
    headers: { 'x-api-key': API_KEY },
  }).then((r) => r.json());

async function fetchTeam(id) {
  const json = await api(`getTeams?hl=ko-KR&id=${id}`);
  return json?.data?.teams?.[0] ?? null;
}

// 모든 리그의 완료 경기를 모아 팀코드 → 최근 완료 matchId 맵 생성
// (일정 API의 팀 객체에는 id가 없고 code만 있으므로 code 기준으로 키 생성)
async function buildRecentMatchMap() {
  const recent = {}; // teamCode → { startTime, matchId }
  for (const lid of LEAGUE_IDS) {
    try {
      const json = await api(`getSchedule?hl=ko-KR&leagueId=${lid}`);
      const events = json?.data?.schedule?.events ?? [];
      for (const e of events) {
        if (e.type !== 'match' || e.state !== 'completed') continue;
        for (const t of e.match.teams) {
          if (!t.code) continue;
          const prev = recent[t.code];
          if (!prev || new Date(e.startTime) > new Date(prev.startTime)) {
            recent[t.code] = { startTime: e.startTime, matchId: e.match.id };
          }
        }
      }
    } catch (e) {
      console.log(`  schedule ${lid} ERROR: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  return recent;
}

// 라인업 소환사명에서 팀 코드 접두사 제거: "GEN Kiin"(공백) / "BLGBin"(공백 없음) 모두 처리
const stripCode = (n, code) => {
  if (code && n.startsWith(code + ' ')) return n.slice(code.length + 1).trim();
  if (code && n.startsWith(code)) return n.slice(code.length).trim();
  return n.replace(/^\S+\s+/, '').trim();
};

// 이름 정규화: 소문자화 + 공백/구두점 제거 + 혼동 문자 통일
// window 피드에 "BrokenBIade"(대문자 I)처럼 l↔I 오타가 있어 정확 매칭이 실패하므로
// i·l·1·| 을 한 글자로, o·0 을 한 글자로 접어 매칭한다.
const normName = (s) =>
  s.toLowerCase().replace(/[\s_.\-]/g, '').replace(/[il1|]/g, 'i').replace(/0/g, 'o');

// 편집거리 ≤1 판정 (치환·삽입·삭제 1회 이내). 정규화 후에도 "Nia"↔"Nia1",
// "sasi"↔"sasii" 처럼 한 글자 차이가 나는 표기 불일치를 흡수한다.
const within1 = (a, b) => {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    let diff = 0;
    for (let i = 0; i < la; i++) if (a[i] !== b[i] && ++diff > 1) return false;
    return true;
  }
  const [s, l] = la < lb ? [a, b] : [b, a];
  let i = 0, j = 0, skipped = false;
  while (i < s.length && j < l.length) {
    if (s[i] === l[j]) { i++; j++; }
    else { if (skipped) return false; skipped = true; j++; }
  }
  return true;
};

// 최근 경기 game1 라인업 → 해당 팀 주전 소환사명 Set
// 주의: getEventDetails 의 blue/red 와 livestats window 의 blue/red 배정이 서로 다르므로
//       side 매핑 대신 로스터 이름과 가장 많이 일치하는 블록을 주전 라인업으로 선택한다.
async function fetchStarters(matchId, teamCode, rosterNames) {
  const det = await api(`getEventDetails?hl=ko-KR&id=${matchId}`);
  const game = det?.data?.event?.match?.games?.find((g) => g.state === 'completed');
  if (!game) return null;
  const r = await fetch(`https://feed.lolesports.com/livestats/v1/window/${game.id}`, {
    headers: { 'x-api-key': API_KEY },
  });
  if (r.status !== 200) return null;
  const win = await r.json();
  const rosterArr = [...rosterNames];

  // window 블록의 라인업 이름을 로스터 원본 이름에 1:1 매칭 (정확 → 편집거리≤1 폴백)
  const matchBlock = (meta) => {
    const winNorms = (meta?.participantMetadata ?? []).map((p) => normName(stripCode(p.summonerName, teamCode)));
    const used = new Set();
    const matched = new Set();
    // 1차: 정규화 정확 일치
    const exactDone = new Array(winNorms.length).fill(false);
    winNorms.forEach((s, idx) => {
      const o = rosterArr.find((n) => !used.has(n) && normName(n) === s);
      if (o) { used.add(o); matched.add(o); exactDone[idx] = true; }
    });
    // 2차: 남은 슬롯에 편집거리≤1 폴백
    winNorms.forEach((s, idx) => {
      if (exactDone[idx]) return;
      const o = rosterArr.find((n) => !used.has(n) && within1(normName(n), s));
      if (o) { used.add(o); matched.add(o); }
    });
    return matched;
  };

  let best = null, bestCount = 0;
  for (const b of [win?.gameMetadata?.blueTeamMetadata, win?.gameMetadata?.redTeamMetadata]) {
    const matched = matchBlock(b);
    if (matched.size > bestCount) { bestCount = matched.size; best = matched; }
  }
  // 5명 중 4명 이상 일치할 때만 신뢰. 그 미만은 오래된·교체된 라인업일 가능성이 커
  // 일부만 주전으로 잘못 표기되는 것을 막고 역할순 폴백에 맡긴다.
  return best && best.size >= 4 ? best : null;
}

async function main() {
  console.log('Building recent match map...');
  const recentMatch = await buildRecentMatchMap();
  console.log(`  ${Object.keys(recentMatch).length} teams have recent matches\n`);

  const rosters = {};
  const shorts = Object.keys(TEAM_IDS);

  for (const short of shorts) {
    const id = TEAM_IDS[short];
    process.stdout.write(`Fetching ${short}...`);
    try {
      const team = await fetchTeam(id);
      if (!team) { console.log(' no data'); continue; }

      const rosterPlayers = (team.players ?? []).filter(p => ROLE_ORDER.includes(p.role));
      const rosterNames = new Set(rosterPlayers.map(p => p.summonerName));

      // 최근 경기 주전 라인업 판별 (팀 코드로 최근 경기 조회)
      let starters = null;
      const rm = recentMatch[team.code];
      if (rm) {
        try {
          starters = await fetchStarters(rm.matchId, team.code, rosterNames);
        } catch { /* 라인업 조회 실패 시 무시 */ }
      }

      const players = rosterPlayers
        .map(p => ({
          id: p.id, // esports 선수 ID — 시즌 기록(lolPlayerStats.json) 연결용
          name: p.summonerName,
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          role: p.role,
          image: (p.image || '').replace(/^http:\/\//, 'https://'), // http 이미지 → https(혼합 콘텐츠 경고 방지)
          starter: starters ? starters.has(p.summonerName) : false,
          _role: p.role,
        }))
        // 역할 순서 → 같은 역할 내에서는 주전 먼저
        .sort((a, b) => {
          const r = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
          if (r !== 0) return r;
          return (b.starter ? 1 : 0) - (a.starter ? 1 : 0);
        });
      // 최근 라인업으로 주전을 못 정한 경우(경기 기록 없음 등): 역할별 첫 번째 선수를 주전으로 표시
      if (!starters) for (const role of ROLE_ORDER) { const p = players.find((x) => x.role === role); if (p) p.starter = true; }
      for (const p of players) delete p._role;

      // getTeams 팀 정보(공식 로고·배경·소속 리그·활동 상태) — 팀 페이지 로고 대체·리그 표기용
      const https = (u) => (u || '').replace(/^http:\/\//, 'https://');
      rosters[short] = {
        id, players,
        team: { name: team.name, code: team.code, slug: team.slug, status: team.status, homeLeague: team.homeLeague || null, image: https(team.image), alternativeImage: https(team.alternativeImage), backgroundImage: https(team.backgroundImage) },
      };
      console.log(` ${players.length} players${starters ? ` (주전 ${players.filter(p => p.starter).length})` : ''}`);
    } catch (e) {
      console.log(` ERROR: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 80));
  }

  const out = {
    updatedAt: new Date().toISOString().slice(0, 10),
    rosters,
  };
  // getTeams(전체, id 없이) — 활동·해체 팀 전부의 공식 로고·팀명(lolTeamsAll.json).
  //   과거 대회의 옛 팀(로고 미보유)을 표시할 때 대체 로고로 사용. 같은 약칭이 여럿이면 활동 중인 팀 우선.
  try {
    const all = (await api('getTeams?hl=ko-KR'))?.data?.teams || [];
    const https2 = (u) => (u || '').replace(/^http:\/\//, 'https://');
    const byCode = {}, byName = {};
    for (const t of all.filter((x) => x.image)) {
      const img = https2(t.image);
      if (!byName[t.name]) byName[t.name] = img;
      const prev = byCode[t.code];
      if (!prev || (prev.status !== 'active' && t.status === 'active')) byCode[t.code] = { name: t.name, image: img, status: t.status };
    }
    const slim = Object.fromEntries(Object.entries(byCode).map(([c, v]) => [c, [v.name, v.image]]));
    writeFileSync(resolve(__dirname, '../client/src/data/lolTeamsAll.json'), JSON.stringify({ updatedAt: new Date().toISOString().slice(0, 10), byCode: slim, byName }) + '\n');
    console.log(`전체 팀 정보 저장: ${all.length}팀 (약칭 ${Object.keys(slim).length})`);
  } catch (e) { console.log(`전체 팀 정보 실패(무시): ${e.message}`); }

  // getLeagues — 리그 공식 로고·지역·표시 순서(lolLeagues.json)
  try {
    const lj = await api('getLeagues?hl=ko-KR');
    const leagues = (lj?.data?.leagues || []).map((l) => ({ id: l.id, slug: l.slug, name: l.name, region: l.region, image: (l.image || '').replace(/^http:\/\//, 'https://'), priority: l.displayPriority?.position ?? null, status: l.displayPriority?.status ?? null }));
    writeFileSync(resolve(__dirname, '../client/src/data/lolLeagues.json'), JSON.stringify({ updatedAt: new Date().toISOString().slice(0, 10), leagues }, null, 2) + '\n');
    console.log(`리그 정보 저장: ${leagues.length}개`);
  } catch (e) { console.log(`리그 정보 실패(무시): ${e.message}`); }

  const outPath = resolve(__dirname, '../client/src/data/lolRosters.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nSaved to ${outPath}`);
}

main();
