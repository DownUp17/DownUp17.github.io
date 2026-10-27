// scripts/bracketSigs.mjs
// 대회별 대진·결과 시그니처 — "GPR 변화 없이 경기 결과만 바뀐 대회"를 감지하는 기준값.
//   simulateLol.mjs가 시뮬 후 lolSim.json의 bracketSigs에 저장하고,
//   fetchGpr.mjs가 새 순위표로 다시 계산해 비교 → 달라진 대회만 시뮬 재실행.
//   두 스크립트가 반드시 같은 정의를 써야 하므로 여기 한 곳에서만 관리한다.
//   (예전엔 양쪽에 따로 적혀 있어 WORLDS 키가 fetchGpr에서 빠져 Worlds 경기 결과가 반영되지 않았음)
export function computeBracketSigs(standings) {
  const s = standings || {};
  return {
    MSI: JSON.stringify({
      pi: s.msi?.['플레이-인 스테이지']?.bracket ?? null,
      br: s.msi?.['브래킷 스테이지']?.bracket ?? null,
    }),
    LCK: JSON.stringify({
      pi: s.lck?.LCK?.playin ?? null,
      po: s.lck?.LCK?.playoffs ?? null,
    }),
    LPL: JSON.stringify({
      po: s.lpl?.['Split 3']?.playoffs ?? null,
      rq: s.lpl?.['대표 선발전']?.qualifier ?? null,
    }),
    LCP: JSON.stringify({
      swiss: s.lcp?.['Split 3']?.swiss ?? null,
      pi: s.lcp?.['Split 3']?.playin ?? null,
      po: s.lcp?.['Split 3']?.playoffs ?? null,
    }),
    LEC: JSON.stringify({
      po: s.lec?.Summer?.playoffs ?? null,
    }),
    LCS: JSON.stringify({
      po: s.lcs?.Summer?.playoffs ?? null,
    }),
    CBLOL: JSON.stringify({
      po: s.cblol?.['Split 2']?.playoffs ?? null,
    }),
    WORLDS: JSON.stringify({ pi: s.worlds?.playin ?? null, sw: s.worlds?.swiss ?? null, ko: s.worlds?.knockout ?? null }),
    DCGI: JSON.stringify({
      q: s.demacia?.qualifiers ?? null,
      g: s.demacia?.group ?? null,
      k: s.demacia?.knockout ?? null,
    }),
  };
}
