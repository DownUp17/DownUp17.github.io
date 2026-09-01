// scripts/simulateLol.mjs
// GPR 팀별 점수를 Elo식 승률로 변환해 각 리그를 몬테카를로로 시뮬레이션하고,
// client/src/data/lolSim.json 의 대회별 데이터를 채운다. FST는 실제 결과로 채운다.
//
// 실행: node scripts/simulateLol.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'client', 'src', 'data');

const gpr = JSON.parse(fs.readFileSync(path.join(dataDir, 'gprTeams.json'), 'utf8'));
const sim = JSON.parse(fs.readFileSync(path.join(dataDir, 'lolSim.json'), 'utf8'));
const standingsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'lolStandings.json'), 'utf8'));

const ITER = 100000;
const ELO_SCALE = 400;          // 점수차 400 = 약 10배 우세
const PLAYOFF_TEAMS = 6;        // 단순화: 상위 6팀 플레이오프
const GENERATED_AT = new Date().toISOString(); // 시:분까지 — 페이지에서 KST로 표시

// 시드 고정 PRNG (mulberry32) — 같은 입력이면 같은 결과 → 불필요한 커밋 방지
let _seed = 0x9e3779b9;
const rng = () => {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// 단판 승률
const gameProb = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / ELO_SCALE));

// 다전제(Bo n) 승률 — 게임별 시뮬레이션
const simSeries = (a, b, need) => {
  let wa = 0, wb = 0;
  const p = gameProb(a.score, b.score);
  while (wa < need && wb < need) (rng() < p ? wa++ : wb++);
  return wa === need ? a : b;
};

// Bo n 승률 해석식 (a 기준) — 표시용
const seriesProb = (pa, need) => {
  // need=2 (Bo3), need=3 (Bo5)
  const q = 1 - pa;
  if (need === 2) return pa * pa * (1 + 2 * q);
  return pa * pa * pa * (1 + 3 * q + 6 * q * q);
};

const pct = (x) => Math.round(x * 10000) / 100; // 소수2자리 %

function simulateLeague(teams) {
  const n = teams.length;
  const idx = teams.map((_, i) => i);
  const stat = teams.map(() => ({ sumRank: 0, rank1: 0, top6: 0, champ: 0, finalApp: 0 }));

  for (let it = 0; it < ITER; it++) {
    const wins = new Array(n).fill(0);
    // 싱글 라운드로빈 Bo3
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const w = simSeries(teams[i], teams[j], 2);
        if (w === teams[i]) wins[i]++; else wins[j]++;
      }
    }
    // 순위 (승수 desc, 동률은 무작위)
    const order = idx.slice().sort((a, b) => (wins[b] - wins[a]) || (rng() - 0.5));
    order.forEach((teamIdx, rank) => {
      stat[teamIdx].sumRank += rank + 1;
      if (rank === 0) stat[teamIdx].rank1++;
      if (rank < PLAYOFF_TEAMS) stat[teamIdx].top6++;
    });

    // 플레이오프 (상위 6, 1·2시드 부전승)
    const s = order.slice(0, PLAYOFF_TEAMS).map((i) => teams[i]);
    const qf1 = simSeries(s[2], s[5], 3);
    const qf2 = simSeries(s[3], s[4], 3);
    const sf1 = simSeries(s[0], qf2, 3);
    const sf2 = simSeries(s[1], qf1, 3);
    const champ = simSeries(sf1, sf2, 3);
    stat[teams.indexOf(sf1)].finalApp++;
    stat[teams.indexOf(sf2)].finalApp++;
    stat[teams.indexOf(champ)].champ++;
  }

  const standings = teams
    .map((t, i) => ({
      team: t.short,
      name: t.name,
      rating: t.score,
      avgRank: stat[i].sumRank / ITER,
      champ: pct(stat[i].champ / ITER),
      advance: pct(stat[i].top6 / ITER),
      rank1: pct(stat[i].rank1 / ITER),
    }))
    .sort((a, b) => b.champ - a.champ || a.avgRank - b.avgRank);

  // 상황별 확률 (자동 생성)
  const byChamp = [...standings];
  const seedByRating = [...teams].sort((a, b) => b.score - a.score);
  const top = byChamp[0], second = byChamp[1];
  const worstAdvance = [...standings].sort((a, b) => a.advance - b.advance)[0];
  const situations = [
    { label: `${top.team} 정규시즌 1위`, prob: top.rank1 },
    { label: `${top.team} 우승`, prob: top.champ },
    { label: `${second.team} 우승`, prob: second.champ },
    { label: `${worstAdvance.team} 플레이오프 진출`, prob: worstAdvance.advance },
  ];

  // 대진별 예측 — GPR 시드 기준 플레이오프 1라운드 + 예상 결승
  const seeds = seedByRating;
  const mk = (a, b) => {
    const pa = seriesProb(gameProb(a.score, b.score), 3);
    return { a: a.short, b: b.short, pA: Math.round(pa * 100), winner: pa >= 0.5 ? a.short : b.short };
  };
  const matches = [
    mk(seeds[2], seeds[5]),
    mk(seeds[3], seeds[4]),
    mk(seeds[0], seeds[1]),
  ];

  return { standings, situations, matches, seeds };
}

// ---- 2026 LCK 전용 시뮬레이션 ----
// 정규시즌 4라운드(Bo3): 1~2R 10팀 더블 라운드로빈 → 상위5 레전드/하위5 라이즈 분할,
//   3~4R 그룹 내 더블 라운드로빈(승수 연계). 최종 순위는 레전드 1~5위, 라이즈 6~10위.
// 플레이인(Bo5, 4팀: 레전드5·라이즈1~3): 1경기 승자 직행, 최종전 승자 직행 → 2팀.
// 플레이오프(Bo5, 6팀 더블 엘리미네이션): 시드 1~4 직행 + 플레이인 2팀(5·6시드).
//   '지목=더 낮은 시드 선택' 가정 → 표준 시드 대진(3v6, 4v5, 1·2시드 UB R2 부전승).
// fixed: { [short]: { w, group } } — 현재까지(정규 1·2R) 결과를 고정하고 잔여 경기만 시뮬.
//   주어지면 그룹 배정과 누적 승수를 실제 순위표로 고정하고 3·4R부터 시뮬레이션한다.
function simulateLCK(teams, fixed, playinFixed = {}, playoffFixed = {}) {
  const n = teams.length; // 10
  const ti = (obj) => teams.indexOf(obj);
  const stat = teams.map(() => ({ sumRank: 0, rank1: 0, piPlus: 0, playoff: 0, worlds: 0, champ: 0, finalApp: 0 }));
  // HLE = MSI 챔피언 확정 Worlds 진출. LCK 4슬롯(HLE 1 + 국내 플레이오프 3).
  const hleTeam = teams.find((t) => t.short === 'HLE');
  // 플레이-인·플레이오프 확정 결과 반영: 해당 대진(무순서 페어)에 확정 승자가 있으면 그 결과로,
  //   없으면 시뮬레이션. (진행에 맞춰 갱신)
  const pinKey = (a, b) => [a.short, b.short].sort().join('|');
  const pinDecide = (a, b) => {
    const w = playinFixed[pinKey(a, b)];
    if (w) return a.short === w ? a : b;
    return simSeries(a, b, 3);
  };
  // 플레이오프 매치는 라운드/매치 위치별로 fixed 조회.
  //   팀 페어 키만으로 매칭하면 같은 두 팀이 다른 라운드에서 재대결할 때
  //   (예: UB R1 M2 KT vs DK 결과가 LB R2 KT vs DK 매치에 잘못 재사용) 편향 발생.
  const poDecide = (a, b, matchKey) => {
    const w = matchKey ? playoffFixed[matchKey] : undefined;
    if (w) return a.short === w ? a : (b.short === w ? b : simSeries(a, b, 3));
    return simSeries(a, b, 3);
  };

  // 그룹 잔여 대진 스케줄 구성 — [i,j] 팀 인덱스 시리즈 목록 반환.
  //   s3played가 있으면 팀별 잔여 경기 수(rem = 8 - 소화)를 만족하는 근사 스케줄을,
  //   없으면 완전 더블 라운드로빈(쌍별 2시리즈)을 반환한다.
  //   (실제 잔여 대진표는 모르므로 잔여 많은 팀부터 그리디 매칭으로 근사)
  const buildSchedule = (groupIdx, s3played) => {
    const N = groupIdx.length;
    const gamesPerTeam = 2 * (N - 1);
    if (!s3played) {
      const full = [];
      for (let a = 0; a < N; a++)
        for (let b = a + 1; b < N; b++)
          for (let g = 0; g < 2; g++) full.push([groupIdx[a], groupIdx[b]]);
      return full;
    }
    const rem = groupIdx.map((i) => Math.max(0, gamesPerTeam - s3played[i]));
    const pairCnt = {};
    const key = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
    const sched = [];
    let guard = 0;
    while (guard++ < 10000) {
      const avail = groupIdx.map((_, k) => k).filter((k) => rem[k] > 0).sort((a, b) => rem[b] - rem[a]);
      if (avail.length < 2) break;
      const k1 = avail[0];
      const k2 = avail.slice(1).find((k) => (pairCnt[key(groupIdx[k1], groupIdx[k])] || 0) < 2);
      if (k2 === undefined) break;
      sched.push([groupIdx[k1], groupIdx[k2]]);
      rem[k1]--; rem[k2]--;
      pairCnt[key(groupIdx[k1], groupIdx[k2])] = (pairCnt[key(groupIdx[k1], groupIdx[k2])] || 0) + 1;
    }
    return sched;
  };

  // 스케줄(시리즈 목록)을 시뮬 — 누적 wins·gd에 가산
  const playSchedule = (sched, wins, gd) => {
    for (const [i, j] of sched) {
      let wa = 0, wb = 0;
      const p = gameProb(teams[i].score, teams[j].score);
      while (wa < 2 && wb < 2) (rng() < p ? wa++ : wb++);
      if (wa === 2) wins[i]++; else wins[j]++;
      gd[i] += wa - wb; gd[j] += wb - wa;
    }
  };

  // 고정 모드 사전 계산: 그룹 멤버 인덱스 + 1·2R 누적 승수·득실차(시작값)
  // s3played: 1·2R(Split2) = 18경기 완료 기준으로 Split3 소화 경기 수 계산.
  //   잔여 대진 스케줄은 rng와 무관(팀별 잔여수만 반영)하므로 루프 밖에서 1회 구성.
  const idxAll = teams.map((_, i) => i);
  const fixedLegend = fixed && idxAll.filter((i) => fixed[teams[i].short]?.group === 'Legend');
  const fixedRise = fixed && idxAll.filter((i) => fixed[teams[i].short]?.group === 'Rise');
  // 정규시즌 확정 rank (tie-break용). fixed 데이터에 rank 있으면 그것으로 정렬 유지.
  const fixedRank = fixed && ((i) => fixed[teams[i].short]?.rank ?? 99);
  const startWins = fixed && teams.map((t) => fixed[t.short]?.w ?? 0);
  const startGd = fixed && teams.map((t) => fixed[t.short]?.gd ?? 0);
  const startS3Played = fixed && teams.map((t) => Math.max(0, (fixed[t.short]?.total ?? 0) - 18));
  const legendSched = fixed && buildSchedule(fixedLegend, startS3Played);
  const riseSched = fixed && buildSchedule(fixedRise, startS3Played);

  for (let it = 0; it < ITER; it++) {
    let wins, gd, legend, rise;

    if (fixed) {
      // 정규 1·2R 결과 고정: 그룹·누적 승수·득실차를 실제 순위표에서 가져오고 3·4R 잔여만 시뮬
      wins = startWins.slice();
      gd = startGd.slice();
      legend = fixedLegend;
      rise = fixedRise;
      playSchedule(legendSched, wins, gd);
      playSchedule(riseSched, wins, gd);
    } else {
      wins = new Array(n).fill(0);
      gd = new Array(n).fill(0);
      const idx = idxAll.slice();
      // 1~2R: 10팀 더블 라운드로빈
      playSchedule(buildSchedule(idx), wins, gd);
      // 1~2R 성적으로 그룹 분할 (상위5 레전드 / 하위5 라이즈), 동률 득실차 → 무작위
      const order12 = idx.slice().sort((a, b) => (wins[b] - wins[a]) || (gd[b] - gd[a]) || (rng() - 0.5));
      legend = order12.slice(0, 5);
      rise = order12.slice(5);
      // 3~4R: 그룹 내 더블 라운드로빈 (1~2R 승수·득실차 연계)
      playSchedule(buildSchedule(legend), wins, gd);
      playSchedule(buildSchedule(rise), wins, gd);
    }

    // 최종 순위 — 그룹 내 누적 승수 기준, 동률 시 득실차 → 확정 rank(tiebreak) → 무작위
    //   fixed 데이터에 rank가 있으면 실제 tiebreak 결과(예: GEN 1위·HLE 2위)를 존중해 무작위 편향 제거
    const tieBreak = fixedRank ? (a, b) => fixedRank(a) - fixedRank(b) : () => rng() - 0.5;
    const legOrder = legend.slice().sort((a, b) => (wins[b] - wins[a]) || (gd[b] - gd[a]) || tieBreak(a, b));
    const riseOrder = rise.slice().sort((a, b) => (wins[b] - wins[a]) || (gd[b] - gd[a]) || tieBreak(a, b));
    legOrder.forEach((tIdx, k) => {
      stat[tIdx].sumRank += k + 1;
      if (k === 0) stat[tIdx].rank1++;
      stat[tIdx].piPlus++; // 레전드 1~5위: 플옵 직행 또는 플레이인 → PI+
    });
    riseOrder.forEach((tIdx, k) => {
      stat[tIdx].sumRank += 6 + k;
      if (k < 3) stat[tIdx].piPlus++; // 라이즈 1~3위: 플레이인 → PI+
    });

    // 플레이인 (Bo5): L5 vs R1 → 승자 직행 / 패자 최종전, R2 vs R3 → 승자 최종전
    const L5 = teams[legOrder[4]], R1 = teams[riseOrder[0]], R2 = teams[riseOrder[1]], R3 = teams[riseOrder[2]];
    const pin1W = pinDecide(L5, R1);
    const pin1L = pin1W === L5 ? R1 : L5;
    const pin2W = pinDecide(R2, R3);
    const finalW = pinDecide(pin1L, pin2W); // 최종전 승자 → 직행

    // 6팀 시드: 1~4 레전드 직행, 5 = 플레이인 1경기 승자, 6 = 최종전 승자
    const s1 = teams[legOrder[0]], s2 = teams[legOrder[1]], s3 = teams[legOrder[2]], s4 = teams[legOrder[3]];
    const s5 = pin1W, s6 = finalW;
    [s1, s2, s3, s4, s5, s6].forEach((t) => { stat[ti(t)].playoff++; });
    const seedNum = new Map([[s1, 1], [s2, 2], [s3, 3], [s4, 4], [s5, 5], [s6, 6]]);
    const seedOf = (t) => seedNum.get(t);

    // 플레이오프 — 6팀 더블 엘리미네이션 (Bo5) · 진행된 매치는 poDecide로 실제 결과 고정
    // 승자조 R1: 3v6, 4v5
    const ub1m1W = poDecide(s3, s6, 'UB R1 M1'), ub1m1L = ub1m1W === s3 ? s6 : s3;
    const ub1m2W = poDecide(s4, s5, 'UB R1 M2'), ub1m2L = ub1m2W === s4 ? s5 : s4;
    // 1위가 더 낮은 시드를 지목 → 승자조 R2 대진
    const lowW = seedOf(ub1m1W) > seedOf(ub1m2W) ? ub1m1W : ub1m2W;
    const highW = seedOf(ub1m1W) > seedOf(ub1m2W) ? ub1m2W : ub1m1W;
    const ub2m1W = poDecide(s1, lowW, 'UB R2 M1'), ub2m1L = ub2m1W === s1 ? lowW : s1;
    const ub2m2W = poDecide(s2, highW, 'UB R2 M2'), ub2m2L = ub2m2W === s2 ? highW : s2;
    // 승자조 R3 → 승자 그랜드파이널 직행, 패자 로어파이널
    const ub3W = poDecide(ub2m1W, ub2m2W, 'UB R3'), ub3L = ub3W === ub2m1W ? ub2m2W : ub2m1W;
    // 패자조: UB R2 패자 중 시드 높은 팀 → LB R3, 낮은 팀 → LB R2
    const ub2lHigh = seedOf(ub2m1L) < seedOf(ub2m2L) ? ub2m1L : ub2m2L;
    const ub2lLow = seedOf(ub2m1L) < seedOf(ub2m2L) ? ub2m2L : ub2m1L;
    const lb1W = poDecide(ub1m1L, ub1m2L, 'LB R1');
    const lb2W = poDecide(ub2lLow, lb1W, 'LB R2');
    const lb3W = poDecide(ub2lHigh, lb2W, 'LB R3');
    const lowerFinalsW = poDecide(ub3L, lb3W, 'Lower Finals');
    // 그랜드파이널
    const champ = poDecide(ub3W, lowerFinalsW, 'Grand Finals');
    stat[ti(ub3W)].finalApp++;
    stat[ti(lowerFinalsW)].finalApp++;
    stat[ti(champ)].champ++;

    // Worlds 진출 — LCK 4슬롯: HLE는 플레이오프 진출만 하면 확정(MSI 챔피언 슬롯)
    // + 국내 플레이오프 최종 3위 이내. HLE가 top-3에 포함되면 4위(lb3L)도 추가 슬롯.
    const gfLoser = ub3W === champ ? lowerFinalsW : ub3W;
    const lfLoser = lowerFinalsW === ub3L ? lb3W : ub3L;
    const lb3L = lb3W === ub2lHigh ? lb2W : ub2lHigh;
    const hleInPlayoff = hleTeam && [s1, s2, s3, s4, s5, s6].includes(hleTeam);
    if (hleInPlayoff) stat[ti(hleTeam)].worlds++;
    const domesticTop3 = [champ, gfLoser, lfLoser];
    domesticTop3.forEach((t) => { if (t !== hleTeam) stat[ti(t)].worlds++; });
    if (hleInPlayoff && domesticTop3.some((t) => t === hleTeam)) stat[ti(lb3L)].worlds++;
  }

  const standings = teams
    .map((t, i) => ({
      team: t.short,
      name: t.name,
      rating: t.score,
      avgRank: stat[i].sumRank / ITER,
      champ: pct(stat[i].champ / ITER),
      worlds: pct(stat[i].worlds / ITER),
      advance: pct(stat[i].playoff / ITER),
      piPlus: pct(stat[i].piPlus / ITER),
      rank1: pct(stat[i].rank1 / ITER),
    }))
    .sort((a, b) => b.champ - a.champ || a.avgRank - b.avgRank);

  // 상황별 확률
  const byChamp = [...standings];
  const top = byChamp[0], second = byChamp[1];
  const worstAdvance = [...standings].filter((s) => s.advance > 0).sort((a, b) => a.advance - b.advance)[0];
  const situations = [
    { label: `${top.team} 정규시즌 1위`, prob: top.rank1 },
    { label: `${top.team} 우승`, prob: top.champ },
    { label: `${second.team} 우승`, prob: second.champ },
    { label: `${worstAdvance.team} 플레이오프 진출`, prob: worstAdvance.advance },
  ];

  // 대진별 예측 — GPR 레이팅 시드 기준 플레이오프 대진(3v6 / 4v5 / 1v2 예상)
  const seeds = [...teams].sort((a, b) => b.score - a.score);
  const mk = (a, b) => {
    const pa = seriesProb(gameProb(a.score, b.score), 3);
    return { a: a.short, b: b.short, pA: Math.round(pa * 100), winner: pa >= 0.5 ? a.short : b.short };
  };
  const matches = [mk(seeds[2], seeds[5]), mk(seeds[3], seeds[4]), mk(seeds[0], seeds[1])];

  return { standings, situations, matches };
}

// ---- 6개 리그 시뮬레이션 ----
// 인자로 리그를 지정하면 그 리그만 재계산하고 나머지는 기존 lolSim.json 값을 유지한다.
//   예: node scripts/simulateLol.mjs LCK LPL  → LCK·LPL만 시뮬. 인자 없으면 전체.
const ALL_LEAGUES = ['LCK', 'LPL', 'LEC', 'LCP', 'LCS', 'CBLOL'];
const argLeagues = process.argv.slice(2).map((s) => s.toUpperCase());
const leagues = argLeagues.length ? ALL_LEAGUES.filter((l) => argLeagues.includes(l)) : ALL_LEAGUES;
// LCK 현재 순위표(정규 1·2R 완료)를 고정 입력으로 사용 → 잔여 경기만 시뮬
const lckRows = standingsData.standings?.lck?.LCK?.rows;
// 그룹명 정규화 — 데이터가 '레전드 그룹'/'라이즈 그룹'(한글)이어도 시뮬은 Legend/Rise로 판별
const normLckGroup = (g) => (/레전드/.test(g) ? 'Legend' : /라이즈/.test(g) ? 'Rise' : g);
const lckFixed = lckRows && Object.fromEntries(
  lckRows.map((r) => [r.team, { w: r.w, group: normLckGroup(r.group), gd: (r.gw ?? 0) - (r.gl ?? 0), total: r.w + r.l, rank: r.rank }])
);

// LCK 플레이-인 확정 결과 추출 — { "TEAMA|TEAMB"(정렬): 승자 short }.
//   실제 경기가 진행되면 그 결과를 시뮬에 고정해 PO/Worlds/우승 확률을 갱신한다.
function extractLckPlayinFixed() {
  const out = {};
  const playin = standingsData.standings?.lck?.LCK?.playin;
  if (!playin?.rounds) return out;
  for (const r of playin.rounds) {
    for (const m of r.matches || []) {
      const { a, b } = m;
      if (!a?.short || !b?.short) continue;
      let w = null;
      if (a.win || a.msi) w = a.short;
      else if (b.win || b.msi) w = b.short;
      else if (a.score != null && b.score != null && a.score !== b.score) w = a.score > b.score ? a.short : b.short;
      if (w) out[[a.short, b.short].sort().join('|')] = w;
    }
  }
  return out;
}
const lckPlayinFixed = extractLckPlayinFixed();
const lckPlayinKeys = Object.keys(lckPlayinFixed);
if (lckPlayinKeys.length) console.log(`LCK 플레이-인 확정 반영: ${lckPlayinKeys.map((k) => `${k}→${lckPlayinFixed[k]}`).join(', ')}`);

// 플레이오프 확정 결과도 시뮬 고정 — 진행된 매치는 실제 승자로.
function extractLckPlayoffFixed() {
  // 매치 위치(title) → 승자. 팀 페어 키가 아니라 매치별로 저장해야
  //   같은 두 팀이 다른 라운드에서 재대결할 때 이전 결과가 잘못 재사용되지 않음.
  const out = {};
  const po = standingsData.standings?.lck?.LCK?.playoffs;
  if (!po?.rounds) return out;
  for (const r of po.rounds) {
    for (const m of r.matches || []) {
      const { a, b } = m;
      if (!a?.short || !b?.short || !m.title) continue;
      let w = null;
      if (a.win || a.msi) w = a.short;
      else if (b.win || b.msi) w = b.short;
      else if (a.score != null && b.score != null && a.score !== b.score) w = a.score > b.score ? a.short : b.short;
      if (w) out[m.title] = w;
    }
  }
  return out;
}
const lckPlayoffFixed = extractLckPlayoffFixed();
const lckPlayoffKeys = Object.keys(lckPlayoffFixed);
if (lckPlayoffKeys.length) console.log(`LCK 플레이오프 확정 반영: ${lckPlayoffKeys.map((k) => `${k}→${lckPlayoffFixed[k]}`).join(', ')}`);

for (const lg of leagues) {
  const teams = gpr.teams.filter((t) => t.league === lg);
  const isLck = lg === 'LCK';
  const { standings, situations, matches } = isLck ? simulateLCK(teams, lckFixed, lckPlayinFixed, lckPlayoffFixed) : simulateLeague(teams);
  const comp = sim.competitions.find((c) => c.key === lg.toLowerCase());
  comp.ready = true;
  comp.status = 'ongoing';
  comp.stage = isLck ? '' : '정규시즌 + 플레이오프 (시즌 전체)';
  comp.format = isLck
    ? '정규시즌 1-2R (Bo3) → 그룹분할 → 정규시즌 3-4R (Bo3) → 플레이인 (Bo5) → 플레이오프 (Bo5)'
    : '싱글 라운드로빈 Bo3 → 상위 6팀 Bo5 플레이오프';
  comp.iterations = ITER;
  comp.generatedAt = GENERATED_AT;
  comp.teams = teams.map((t) => ({ name: t.name, short: t.short, rating: t.score }));
  comp.standings = standings;
  comp.situations = situations;
  comp.matches = matches;
  console.log(`${lg}: 우승1위 ${standings[0].team} ${standings[0].champ}% / 팀수 ${teams.length}`);
}

// 플레이-인 브래킷에서 이미 끝난 경기 결과를 추출 (lolStandings.json — fetchStandings가 갱신).
//   pairing[key]=[a,b] : 1라운드 실제 대진, fixed[key]=승자 short : 확정 결과.
//   key = 'Match N'의 N / 최종 진출전 'F'. 진행 흐름에 따라 확률이 실제 결과를 반영하도록 한다.
function extractMsiPlayinFixed() {
  const out = { pairing: {}, fixed: {} };
  const bracket = standingsData.standings?.msi?.['플레이-인 스테이지']?.bracket;
  if (!bracket?.sections) return out;
  const winnerOf = (m) => {
    const { a, b } = m;
    if (!a?.short || !b?.short) return null;
    if (a.win || a.msi) return a.short;
    if (b.win || b.msi) return b.short;
    if (a.score != null && b.score != null && a.score !== b.score) return a.score > b.score ? a.short : b.short;
    return null; // 시드만 채워지고 미진행
  };
  for (const sec of bracket.sections)
    for (const r of sec.rounds || [])
      for (const m of r.matches || []) {
        const mm = (m.title || '').match(/Match\s*(\d+)/);
        const key = mm ? mm[1] : (/최종\s*진출전/.test(m.title || '') ? 'F' : null);
        if (!key) continue;
        if (m.a?.short && m.b?.short) out.pairing[key] = [m.a.short, m.b.short];
        const w = winnerOf(m);
        if (w) out.fixed[key] = w;
      }
  return out;
}

// 브래킷 스테이지(8팀 더블 엘리미네이션) 실제 대진·결과 추출.
//   pairing[n]=[a,b] : 라운드1(M1~M4) 확정 대진, fixed[key]=승자 short (Match N / 결승 'GF').
//   라운드1 4경기 대진이 모두 확정되면 ready=true → 실제 대진으로 시뮬레이션.
function extractMsiBracketFixed() {
  const out = { pairing: {}, fixed: {}, ready: false };
  const bracket = standingsData.standings?.msi?.['브래킷 스테이지']?.bracket;
  if (!bracket?.sections) return out;
  const winnerOf = (m) => {
    const { a, b } = m;
    if (!a?.short || !b?.short) return null;
    if (a.win || a.msi) return a.short;
    if (b.win || b.msi) return b.short;
    if (a.score != null && b.score != null && a.score !== b.score) return a.score > b.score ? a.short : b.short;
    return null;
  };
  for (const sec of bracket.sections)
    for (const r of sec.rounds || [])
      for (const m of r.matches || []) {
        const mm = (m.title || '').match(/Match\s*(\d+)/);
        const key = mm ? mm[1] : (/Grand\s*Finals|결승/i.test(m.title || '') ? 'GF' : null);
        if (!key) continue;
        if (m.a?.short && m.b?.short && +key <= 4) out.pairing[key] = [m.a.short, m.b.short];
        const w = winnerOf(m);
        if (w) out.fixed[key] = w;
      }
  out.ready = ['1', '2', '3', '4'].every((n) => out.pairing[n]);
  return out;
}

// ---- 2026 MSI 전용 시뮬레이션 ----
// 플레이-인(4팀, 더블 엘리미네이션 변형): M1·M2 → M3 승자전(M1w-M2w),
//   M4 하위조1R(M1l-M2l) → M5 하위조2R(M3l-M4w) → 최종 진출전(M3w-M5w) → 1팀만 브래킷 진출.
//   이미 끝난 경기(fixed)는 그 결과로 고정하고 남은 경기만 시뮬레이션한다.
// 브래킷 스테이지(8팀, 표준 더블 엘리미네이션): 실제 대진(bracketInfo.ready)이 확정되면
//   그 대진·확정 결과로 시뮬레이션하고, 미확정이면 직행 7팀+생존팀을 GPR 점수로 시드(폴백).
function simulateMSI(direct, playIn, fixedInfo = { pairing: {}, fixed: {} }, bracketInfo = { pairing: {}, fixed: {}, ready: false }) {
  const champCount = {};
  const advanceCount = {};
  [...direct, ...playIn].forEach((t) => { champCount[t.short] = 0; });
  playIn.forEach((t) => { advanceCount[t.short] = 0; });

  const byS = Object.fromEntries(playIn.map((t) => [t.short, t]));
  const byAll = Object.fromEntries([...direct, ...playIn].map((t) => [t.short, t]));
  const [kc, dcg, t1, tlaw] = playIn;
  // 1라운드 대진: 실제 브래킷(Match1·Match2) 기준, 없으면 기본 순서
  const pairFor = (key, defA, defB) => {
    const p = fixedInfo.pairing[key];
    return p && byS[p[0]] && byS[p[1]] ? [byS[p[0]], byS[p[1]]] : [defA, defB];
  };
  const [m1a, m1b] = pairFor('1', t1, tlaw);
  const [m2a, m2b] = pairFor('2', kc, dcg);
  // 확정 경기는 그 승자 반환, 아니면 시뮬레이션
  const decide = (fx) => (key, A, B) => {
    const w = fx[key];
    if (w && (A.short === w || B.short === w)) return A.short === w ? A : B;
    return simSeries(A, B, 3);
  };
  const piDecide = decide(fixedInfo.fixed);
  const brDecide = decide(bracketInfo.fixed);
  const other = (w, A, B) => (w === A ? B : A);

  // 브래킷 스테이지 실제 대진(라운드1 팀). 8팀이 모두 해석되면 사용.
  const BP = bracketInfo.ready ? {
    1: (bracketInfo.pairing['1'] || []).map((s) => byAll[s]),
    2: (bracketInfo.pairing['2'] || []).map((s) => byAll[s]),
    3: (bracketInfo.pairing['3'] || []).map((s) => byAll[s]),
    4: (bracketInfo.pairing['4'] || []).map((s) => byAll[s]),
  } : null;
  const useActualBracket = !!BP && [1, 2, 3, 4].every((n) => BP[n][0] && BP[n][1]);

  for (let it = 0; it < ITER; it++) {
    // 플레이-인 (확정 결과 우선)
    const m1w = piDecide('1', m1a, m1b), m1l = other(m1w, m1a, m1b);
    const m2w = piDecide('2', m2a, m2b), m2l = other(m2w, m2a, m2b);
    const m3w = piDecide('3', m1w, m2w), m3l = other(m3w, m1w, m2w);
    const m4w = piDecide('4', m1l, m2l);
    const m5w = piDecide('5', m3l, m4w);
    const survivor = piDecide('F', m3w, m5w);
    advanceCount[survivor.short]++;

    let champ;
    if (useActualBracket) {
      // 실제 브래킷 대진 + 확정 결과 (M1~M13 → 결승 GF)
      const [b1a, b1b] = BP[1], [b2a, b2b] = BP[2], [b3a, b3b] = BP[3], [b4a, b4b] = BP[4];
      const w1 = brDecide('1', b1a, b1b), l1 = other(w1, b1a, b1b);
      const w2 = brDecide('2', b2a, b2b), l2 = other(w2, b2a, b2b);
      const w3 = brDecide('3', b3a, b3b), l3 = other(w3, b3a, b3b);
      const w4 = brDecide('4', b4a, b4b), l4 = other(w4, b4a, b4b);
      const w5 = brDecide('5', w1, w2), l5 = other(w5, w1, w2);   // 상위 2R
      const w6 = brDecide('6', w3, w4), l6 = other(w6, w3, w4);
      const w7 = brDecide('7', l1, l2);                            // 하위 1R
      const w8 = brDecide('8', l3, l4);
      const w9 = brDecide('9', l5, w8);                            // 하위 2R
      const w10 = brDecide('10', l6, w7);
      const w11 = brDecide('11', w5, w6), l11 = other(w11, w5, w6); // 상위 결승
      const w12 = brDecide('12', w9, w10);                         // 하위 3R
      const w13 = brDecide('13', l11, w12);                        // 하위 결승
      champ = brDecide('GF', w11, w13);                            // 그랜드 파이널
    } else {
      // 폴백: 직행 7팀 + 생존팀 = 8팀, GPR 점수로 시드
      const [s1, s2, s3, s4, s5, s6, s7, s8] = [...direct, survivor].sort((a, b) => b.score - a.score);
      const wb1aW = simSeries(s1, s8, 3), wb1aL = wb1aW === s1 ? s8 : s1;
      const wb1bW = simSeries(s4, s5, 3), wb1bL = wb1bW === s4 ? s5 : s4;
      const wb1cW = simSeries(s2, s7, 3), wb1cL = wb1cW === s2 ? s7 : s2;
      const wb1dW = simSeries(s3, s6, 3), wb1dL = wb1dW === s3 ? s6 : s3;
      const wb2aW = simSeries(wb1aW, wb1bW, 3), wb2aL = wb2aW === wb1aW ? wb1bW : wb1aW;
      const wb2bW = simSeries(wb1cW, wb1dW, 3), wb2bL = wb2bW === wb1cW ? wb1dW : wb1cW;
      const lb1aW = simSeries(wb1aL, wb1bL, 3);
      const lb1bW = simSeries(wb1cL, wb1dL, 3);
      const wbFinalW = simSeries(wb2aW, wb2bW, 3), wbFinalL = wbFinalW === wb2aW ? wb2bW : wb2aW;
      const lb2aW = simSeries(wb2aL, lb1bW, 3);
      const lb2bW = simSeries(wb2bL, lb1aW, 3);
      const lb3W = simSeries(lb2aW, lb2bW, 3);
      const lowerFinalW = simSeries(wbFinalL, lb3W, 3);
      champ = simSeries(wbFinalW, lowerFinalW, 3);
    }
    champCount[champ.short]++;
  }

  return [...direct, ...playIn]
    .map((t) => {
      const row = { team: t.short, name: t.name, rating: t.score, champ: pct(champCount[t.short] / ITER) };
      if (advanceCount[t.short] != null) row.advance = pct(advanceCount[t.short] / ITER);
      return row;
    })
    .sort((a, b) => b.champ - a.champ);
}

// ---- 2026 LPL Split 3 전용 시뮬레이션 ----
// 럼블 스테이지(조별 Bo3 더블 라운드로빈, 등봉조 8팀·열반조 4팀):
//   등봉 1~6위 녹아웃 직행 / 등봉 7·8위·열반 1·2위 → 기사의 길(Bo5) 승자 녹아웃 합류 / 열반 3·4위 탈락.
// 녹아웃 스테이지(8팀 더블 엘리미네이션 Bo5): 직행 6팀 + 기사의 길 승자 2팀을 GPR 점수로 시드(MSI 브래킷과 동일 페어링).
function simulateLplSplit3(ascend, nirvana, fixedAscend = {}, fixedNirvana = {}) {
  const stat = {};
  [...ascend, ...nirvana].forEach((t) => { stat[t.short] = { kiPlus: 0, knockout: 0, champ: 0, worlds: 0 }; });

  // 현재 순위표(W-L, gw-gl)를 시작값으로 고정하고 잔여 경기만 시뮬.
  //   팀별 잔여 경기 수(rem = 2(N-1) - 소화)를 만족하는 근사 스케줄을 1회 구성하고,
  //   매 반복은 그 대진의 승패만 시뮬한다. 동률 타이브레이커: 득실차(gd) → 랜덤.
  //   (실제 잔여 대진표를 모르므로 잔여 많은 팀부터 그리디 매칭으로 근사)
  const buildSched = (group, fixedRec) => {
    const N = group.length;
    const gamesPerTeam = 2 * (N - 1);
    const rem = group.map(t => { const r = fixedRec?.[t.short]; const p = r ? ((r.w ?? 0) + (r.l ?? 0)) : 0; return Math.max(0, gamesPerTeam - p); });
    const pairCnt = {};
    const key = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
    const sched = [];
    let guard = 0;
    while (guard++ < 10000) {
      const avail = group.map((_, k) => k).filter((k) => rem[k] > 0).sort((a, b) => rem[b] - rem[a]);
      if (avail.length < 2) break;
      const k1 = avail[0];
      const k2 = avail.slice(1).find((k) => (pairCnt[key(k1, k)] || 0) < 2);
      if (k2 === undefined) break;
      sched.push([k1, k2]);
      rem[k1]--; rem[k2]--;
      pairCnt[key(k1, k2)] = (pairCnt[key(k1, k2)] || 0) + 1;
    }
    return sched;
  };
  const aSched = buildSched(ascend, fixedAscend);
  const nSched = buildSched(nirvana, fixedNirvana);
  const rankGroup = (group, fixedRec, sched) => {
    const wins = group.map(t => fixedRec?.[t.short]?.w ?? 0);
    const gd = group.map(t => { const r = fixedRec?.[t.short]; return r ? ((r.gw ?? 0) - (r.gl ?? 0)) : 0; });
    for (const [a, b] of sched) {
      let wa = 0, wb = 0;
      const p = gameProb(group[a].score, group[b].score);
      while (wa < 2 && wb < 2) (rng() < p ? wa++ : wb++);
      if (wa === 2) wins[a]++; else wins[b]++;
      gd[a] += wa - wb;
      gd[b] += wb - wa;
    }
    return group.map((_, i) => i).sort((a, b) => (wins[b] - wins[a]) || (gd[b] - gd[a]) || (rng() - 0.5)).map((i) => group[i]);
  };

  for (let it = 0; it < ITER; it++) {
    const aRanked = rankGroup(ascend, fixedAscend, aSched); // 등봉 1~8위
    const nRanked = rankGroup(nirvana, fixedNirvana, nSched); // 열반 1~4위
    const direct = aRanked.slice(0, 6);
    const [a7, a8] = aRanked.slice(6, 8);
    const [n1, n2] = nRanked.slice(0, 2);

    // 기사의 길+ = 기사의 길 또는 녹아웃 스테이지 둘 중 하나라도 진출 (등봉조 전원 + 열반 1·2위)
    [...aRanked, n1, n2].forEach((t) => { stat[t.short].kiPlus++; });

    // 기사의 길 (Bo5)
    const ki1W = simSeries(a7, n2, 3);
    const ki2W = simSeries(a8, n1, 3);
    const knockoutTeams = [...direct, ki1W, ki2W];
    knockoutTeams.forEach((t) => { stat[t.short].knockout++; });

    // 녹아웃 스테이지: 8팀 더블 엘리미네이션, GPR 점수로 시드
    const [s1, s2, s3, s4, s5, s6, s7, s8] = [...knockoutTeams].sort((a, b) => b.score - a.score);
    const wb1aW = simSeries(s1, s8, 3), wb1aL = wb1aW === s1 ? s8 : s1;
    const wb1bW = simSeries(s4, s5, 3), wb1bL = wb1bW === s4 ? s5 : s4;
    const wb1cW = simSeries(s2, s7, 3), wb1cL = wb1cW === s2 ? s7 : s2;
    const wb1dW = simSeries(s3, s6, 3), wb1dL = wb1dW === s3 ? s6 : s3;
    const wb2aW = simSeries(wb1aW, wb1bW, 3), wb2aL = wb2aW === wb1aW ? wb1bW : wb1aW;
    const wb2bW = simSeries(wb1cW, wb1dW, 3), wb2bL = wb2bW === wb1cW ? wb1dW : wb1cW;
    const lb1aW = simSeries(wb1aL, wb1bL, 3);
    const lb1bW = simSeries(wb1cL, wb1dL, 3);
    const wbFinalW = simSeries(wb2aW, wb2bW, 3), wbFinalL = wbFinalW === wb2aW ? wb2bW : wb2aW;
    const lb2aW = simSeries(wb2aL, lb1bW, 3);
    const lb2bW = simSeries(wb2bL, lb1aW, 3);
    const lb3W = simSeries(lb2aW, lb2bW, 3);
    const lowerFinalW = simSeries(wbFinalL, lb3W, 3);
    const champ = simSeries(wbFinalW, lowerFinalW, 3);
    stat[champ.short].champ++;
    // Worlds 진출 = 녹아웃 스테이지 최종 4위 이내 (LPL 4슬롯)
    const lb3L = lb3W === lb2aW ? lb2bW : lb2aW; // 4위
    const lowerFinalL = lowerFinalW === wbFinalL ? lb3W : wbFinalL; // 3위
    const gfLoser = champ === wbFinalW ? lowerFinalW : wbFinalW; // 2위
    [champ, gfLoser, lowerFinalL, lb3L].forEach((t) => { stat[t.short].worlds++; });
  }

  return [...ascend, ...nirvana].map((t) => ({
    team: t.short,
    name: t.name,
    rating: t.score,
    piPlus: pct(stat[t.short].kiPlus / ITER),
    advance: pct(stat[t.short].knockout / ITER),
    champ: pct(stat[t.short].champ / ITER),
    worlds: pct(stat[t.short].worlds / ITER),
  }));
}

// ---- 2026 LCP Split 3 전용 시뮬레이션 ----
// 스위스 스테이지(8팀, Bo3/Bo5): 3승 시 플레이오프 진출·3패 시 탈락, 챔피언십 포인트(CP) 부여.
//   1R: 상위4 vs 하위4 무작위. 이후 라운드: 같은 승패기록끼리 대진(재대결 회피), 홀수조는 페어다운.
//   3승/3패가 걸린 경기는 Bo5, 그 외 Bo3.
// 플레이오프(4팀 더블 엘리미네이션 Bo5): 우승팀 + 결승 진출 2팀 Worlds. 3번째 Worlds는 잔여팀 중 CP 최다.
const CP_TABLE = { '3-0': 50, '3-1': 40, '3-2': 30, '2-3': 15, '1-3': 3, '0-3': 0 };

function simulateLcpSplit3(seeded) {
  const stat = {};
  seeded.forEach((t) => { stat[t.short] = { playoff: 0, worlds: 0, champ: 0 }; });
  const top4 = seeded.slice(0, 4), bot4 = seeded.slice(4, 8);
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  for (let it = 0; it < ITER; it++) {
    const rec = new Map(seeded.map((t) => [t, { w: 0, l: 0, opp: new Set() }]));
    const play = (x, y, need) => {
      const w = simSeries(x, y, need), l = w === x ? y : x;
      rec.get(w).w++; rec.get(l).l++;
      rec.get(x).opp.add(y); rec.get(y).opp.add(x);
    };
    // 1R: 상위4 vs 하위4 무작위
    const drawn = shuffle(bot4);
    shuffle(top4).forEach((t, i) => play(t, drawn[i], 2));
    // 이후 라운드: 전원 3승/3패 확정될 때까지
    for (let guard = 0; guard < 12; guard++) {
      const active = seeded.filter((t) => rec.get(t).w < 3 && rec.get(t).l < 3);
      if (!active.length) break;
      const byRec = {};
      active.forEach((t) => { const r = rec.get(t); const k = r.w + '-' + r.l; (byRec[k] = byRec[k] || []).push(t); });
      const keys = Object.keys(byRec).sort((a, c) => {
        const [aw, al] = a.split('-').map(Number), [cw, cl] = c.split('-').map(Number);
        return cw - aw || al - cl;
      });
      let carry = null;
      for (const k of keys) {
        let pool = shuffle(byRec[k]);
        if (carry) { pool.unshift(carry); carry = null; }
        if (pool.length % 2 === 1) carry = pool.pop(); // 홀수조 → 최하위 페어다운
        const [pw, pl] = k.split('-').map(Number);
        const need = (pw === 2 || pl === 2) ? 3 : 2; // 3승/3패 걸린 경기 Bo5
        while (pool.length >= 2) {
          const x = pool.shift();
          let idx = pool.findIndex((y) => !rec.get(x).opp.has(y)); // 재대결 회피
          if (idx < 0) idx = 0;
          const y = pool.splice(idx, 1)[0];
          play(x, y, need);
        }
      }
    }
    const cpOf = (t) => { const r = rec.get(t); return CP_TABLE[r.w + '-' + r.l] ?? 0; };
    // 플레이오프 진출 4팀 (승수 → CP → 레이팅 순)
    const playoff = [...seeded].sort((a, c) => rec.get(c).w - rec.get(a).w || cpOf(c) - cpOf(a) || c.score - a.score).slice(0, 4);
    playoff.forEach((t) => stat[t.short].playoff++);
    // 플레이오프: 4팀 더블 엘리미네이션 Bo5
    const [s1, s2, s3, s4] = playoff;
    const ub1 = simSeries(s1, s4, 3), ub1l = ub1 === s1 ? s4 : s1;
    const ub2 = simSeries(s2, s3, 3), ub2l = ub2 === s2 ? s3 : s2;
    const ubf = simSeries(ub1, ub2, 3), ubfl = ubf === ub1 ? ub2 : ub1;
    const lb = simSeries(ub1l, ub2l, 3);
    const lbf = simSeries(ubfl, lb, 3);
    const champ = simSeries(ubf, lbf, 3);
    const runner = champ === ubf ? lbf : ubf;
    stat[champ.short].champ++;
    // Worlds: 우승·준우승 확정 + 잔여팀 중 CP 최다 1팀
    stat[champ.short].worlds++; stat[runner.short].worlds++;
    const rest = seeded.filter((t) => t !== champ && t !== runner).sort((a, c) => cpOf(c) - cpOf(a) || c.score - a.score);
    if (rest[0]) stat[rest[0].short].worlds++;
  }

  return seeded.map((t) => ({
    team: t.short, name: t.name, rating: t.score,
    advance: pct(stat[t.short].playoff / ITER),
    worlds: pct(stat[t.short].worlds / ITER),
    champ: pct(stat[t.short].champ / ITER),
  }));
}

const byShort = (short) => gpr.teams.find((t) => t.short === short);
const lplS3Rows = standingsData.standings?.lpl?.['Split 3']?.rows || [];
const lplAscend = lplS3Rows.filter((r) => r.group === '등봉조').map((r) => byShort(r.team)).filter(Boolean);
const lplNirvana = lplS3Rows.filter((r) => r.group === '열반조').map((r) => byShort(r.team)).filter(Boolean);
const makeLplFixed = (rows) => Object.fromEntries(rows.map(r => [r.team, { w: r.w, l: r.l, gw: r.gw ?? 0, gl: r.gl ?? 0 }]));
const lplFixedAscend = makeLplFixed(lplS3Rows.filter(r => r.group === '등봉조'));
const lplFixedNirvana = makeLplFixed(lplS3Rows.filter(r => r.group === '열반조'));
if (lplAscend.length === 8 && lplNirvana.length === 4) {
  const split3Standings = simulateLplSplit3(lplAscend, lplNirvana, lplFixedAscend, lplFixedNirvana);
  const lplComp = sim.competitions.find((c) => c.key === 'lpl');
  lplComp.split3 = split3Standings;
  const split3Champ = [...split3Standings].sort((a, b) => b.champ - a.champ)[0];
  console.log(`LPL Split3: 우승1위 ${split3Champ.team} ${split3Champ.champ}%`);
}

// LCP Split 3 (스위스 스테이지 + 4팀 더블 엘리 플레이오프) — GPR 상위4=상위 시드
const lcpTeams = gpr.teams.filter((t) => t.league === 'LCP').sort((a, b) => b.score - a.score);
if (lcpTeams.length === 8) {
  const lcpS3 = simulateLcpSplit3(lcpTeams);
  const lcpComp = sim.competitions.find((c) => c.key === 'lcp');
  if (lcpComp) lcpComp.split3 = lcpS3;
  const top = [...lcpS3].sort((a, b) => b.champ - a.champ)[0];
  console.log(`LCP Split3: 우승1위 ${top.team} ${top.champ}% · 플옵1위 ${[...lcpS3].sort((a, b) => b.advance - a.advance)[0].team}`);
}

const msiDirect = ['G2', 'HLE', 'TSW', 'FUR', 'TES', 'BLG', 'LYON'].map(byShort);
const msiPlayIn = ['KC', 'DCG', 'T1', 'TLAW'].map(byShort);
const msiFixed = extractMsiPlayinFixed();
const msiBracketInfo = extractMsiBracketFixed();
const msiStandings = simulateMSI(msiDirect, msiPlayIn, msiFixed, msiBracketInfo);
const fixedKeys = Object.keys(msiFixed.fixed);
if (fixedKeys.length) console.log(`MSI 플레이-인 확정 반영: ${fixedKeys.map((k) => `${k}=${msiFixed.fixed[k]}`).join(', ')}`);
if (msiBracketInfo.ready) console.log(`MSI 브래킷 실제 대진 반영 (확정 ${Object.keys(msiBracketInfo.fixed).length}경기)`);
const msi = sim.competitions.find((c) => c.key === 'msi');
msi.ready = true;
msi.status = 'upcoming';
msi.iterations = ITER;
msi.generatedAt = GENERATED_AT;
msi.teams = [...msiDirect, ...msiPlayIn].map((t) => ({ name: t.name, short: t.short, rating: t.score }));
msi.standings = msiStandings;
console.log(`MSI: 우승1위 ${msiStandings[0].team} ${msiStandings[0].champ}%`);

// ---- FST 2026 (종료) 실제 결과 ----
const fstTeams = gpr.teams.filter((t) => t.fst).sort((a, b) => a.fst - b.fst);
const fst = sim.competitions.find((c) => c.key === 'fst');
fst.ready = true;
fst.status = 'finished';
fst.stage = '2026 First Stand (시즌 첫 국제전)';
fst.format = '8개 지역 대표 · 더블 엘리미네이션';
fst.finalResult = {
  champion: fstTeams[0].name,
  runnerUp: fstTeams[1].name,
  standings: fstTeams.map((t) => ({
    rank: t.fst,
    team: t.name,
    note: `${t.league}${t.fst === 1 ? ' · 우승' : t.fst === 2 ? ' · 준우승' : ''}`,
  })),
};
console.log(`FST: 우승 ${fstTeams[0].name}`);

// 브래킷 시그니처 저장 — fetchGpr가 "GPR 변화 없이 경기 결과만 바뀐 대회"를
// 감지해 해당 리그만 시뮬 재실행하도록 하는 기준값. 대회별로 개별 시그니처 저장.
sim.bracketSigs = {
  MSI: JSON.stringify({
    pi: standingsData.standings?.msi?.['플레이-인 스테이지']?.bracket ?? null,
    br: standingsData.standings?.msi?.['브래킷 스테이지']?.bracket ?? null,
  }),
  LCK: JSON.stringify({
    pi: standingsData.standings?.lck?.LCK?.playin ?? null,
    po: standingsData.standings?.lck?.LCK?.playoffs ?? null,
  }),
  LPL: JSON.stringify({
    po: standingsData.standings?.lpl?.['Split 3']?.playoffs ?? null,
    rq: standingsData.standings?.lpl?.['대표 선발전']?.qualifier ?? null,
  }),
  LCP: JSON.stringify({
    swiss: standingsData.standings?.lcp?.['Split 3']?.swiss ?? null,
    pi: standingsData.standings?.lcp?.['Split 3']?.playin ?? null,
    po: standingsData.standings?.lcp?.['Split 3']?.playoffs ?? null,
  }),
};
delete sim.msiBracketSig; // 이전 형식(단일 문자열) 제거

sim.updatedAt = new Date().toISOString(); // 시간까지 포함(페이지에서 KST로 표시)
fs.writeFileSync(path.join(dataDir, 'lolSim.json'), JSON.stringify(sim, null, 2) + '\n');
console.log('lolSim.json 갱신 완료');
