// client/src/utils/liveScores.js
// LIVE(진행 중) 경기의 세트 스코어를 대진표 데이터(lolStandings.json)에 바로 반영.
//   대진표 경기와 LIVE 경기를 '두 팀 약칭 조합(순서 무관)'으로 연결하고, 아직 결과가 확정되지 않은 경기만 갱신한다.
//   (확정된 결과·다른 경기는 건드리지 않음 · 3시간마다 갱신되는 정적 데이터 위에 덮어쓰기만 함)
//   지원 형식: ① 대진표 슬롯형 { a: { short, score }, b: { short, score } } (리그 플레이오프 등)
//             ② 매치 객체형 { a: 'GEN', b: 'T1', scoreA, scoreB, winner } (DCGI·Asian Games)
const CODE_MAP = { KSA: 'SAU', MAS: 'MYS' }; // lolesports 국가 코드 → 앱(Asian Games) 코드

const key = (x, y) => [x, y].sort().join('|');

const decidedSlot = (m) => !!(m.a?.win || m.b?.win || m.a?.msi || m.b?.msi || m.a?.elim || m.b?.elim);

export function applyLiveScores(root, liveMatches) {
  const live = {};
  for (const m of liveMatches || []) {
    const [t1, t2] = m.teams || [];
    const c1 = CODE_MAP[t1?.code] || t1?.code, c2 = CODE_MAP[t2?.code] || t2?.code;
    if (c1 && c2) live[key(c1, c2)] = { [c1]: t1.wins ?? 0, [c2]: t2.wins ?? 0 };
  }
  if (!Object.keys(live).length) return false;
  let changed = false;
  const visit = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) visit(x); return; }
    const A = o.a, B = o.b;
    if (A && B && typeof A === 'object' && typeof B === 'object' && A.short && B.short) {
      const w = live[key(A.short, B.short)];
      if (w && !decidedSlot(o) && (A.score !== w[A.short] || B.score !== w[B.short] || !o.live)) {
        A.score = w[A.short]; B.score = w[B.short]; o.live = true; changed = true;
      }
    } else if (typeof A === 'string' && typeof B === 'string') {
      const w = live[key(A, B)];
      if (w && !o.winner && (o.scoreA !== w[A] || o.scoreB !== w[B] || o.state !== 'inProgress')) {
        o.scoreA = w[A]; o.scoreB = w[B]; o.state = 'inProgress'; o.live = true; changed = true;
      }
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') visit(v);
  };
  visit(root);
  return changed;
}
