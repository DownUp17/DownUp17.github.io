// scripts/buildTpr.mjs
// TotalDU GPR(TPR) — 각 팀의 2027 시즌 계약이 확정된 선수만, 각 선수의 "이전 팀"
// (2026 월즈 결승일 기준 소속, 없으면 직전 소속)의 GPR을 평균낸 레이팅.
//   GPR: lolesports 공식 시즌별 "Worlds 종료" 스냅샷(/gpr/{연도}/worlds) — 이전 팀 시즌 연도의 값을 쓴다.
//   로스터·이적 이력: Leaguepedia Cargo API (Players·Tenures) — 공식 발표 기반으로 갱신됨.
//   계약 확정 선수 = Leaguepedia 해당 팀 소속 비교체 선수 중 월즈 이후 입단·재계약 발표됐거나 2027 시즌까지 계약이 남은 선수.
//   complete = 5포지션 모두 채워지고 소속 선수 전원이 계약 확정(로스터 확정 팀). 아니면 확정 선수만으로 산출한 잠정값.
//   한 포지션에 2명 이상이면(예: BRO 미드 2명) 주전을 임의로 고르지 않고 소속 선수 전원을 평균한다.
//   가중 평균: 쉰 시즌 1개당 반영 비율 ×0.5 (2026 소속=1, 2025=0.5, 2024=0.25) × 이전 팀 그 시즌 출전 게임/팀 전체 게임.
//   대상 팀: gprTeams.json의 전 팀(LCK·LPL·LEC·LCS·LCP·CBLOL).
//
// 실행: node scripts/buildTpr.mjs  → client/src/data/lolTpr.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(__dirname, '..', 'client', 'src', 'data', 'lolTpr.json');

const REF_DATE = '2026-11-08'; // 이전 팀 판정 기준일(월즈 결승일)
const ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
// GPR 팀명 → Leaguepedia 팀 페이지명 (스폰서명·표기 차이만)
const ALIAS = {
  GEN: 'Gen.G', KT: 'KT Rolster', JDG: 'JD Gaming', DK: 'Dplus Kia', IG: 'Invictus Gaming', C9: 'Cloud9',
  DCG: 'Deep Cross Gaming', WE: 'Team WE', TLAW: 'Team Liquid', LNG: 'LNG Esports', KRX: 'Kiwoom DRX',
  BRO: 'HANJIN BRION', EDG: 'EDward Gaming', SHG: 'Fukuoka SoftBank HAWKS gaming', RED: 'RED Canids',
  LOS: 'LØS', LEV: 'Leviatan',
};

const gpr = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'data', 'gprTeams.json'), 'utf8')).teams; // 팀 목록·이름·리그만 사용

// 시즌별 월즈 종료 GPR (팀 코드 → 점수). 파싱은 fetchGpr.mjs와 같은 RSC 페이로드 방식.
const gprCache = {};
async function gprAt(year) {
  if (gprCache[year]) return gprCache[year];
  const res = await fetch(`https://lolesports.com/ko-KR/gpr/${year}/worlds`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' },
  });
  if (!res.ok) throw new Error(`${year} GPR fetch 실패: HTTP ${res.status}`);
  const html = await res.text();
  const out = {};
  for (const raw of html.split('"__typename":"TeamGPR"').slice(1)) {
    const ch = raw.slice(0, 6000);
    const code = ch.match(/"code":"([^"]+)"/);
    const score = ch.match(/"currentTeamGPR":\{[^}]*?"gprScore":(\d+)/);
    if (code && score && !(code[1] in out)) out[code[1]] = Number(score[1]); // 첫 등장 = 해당 시즌
  }
  if (Object.keys(out).length < 50) throw new Error(`${year} GPR 추출 팀 수 비정상(${Object.keys(out).length}) — 페이지 구조 변경 가능성`);
  return (gprCache[year] = out);
}
const lpName = (t) => ALIAS[t.short] || t.name;
const byLp = new Map(gpr.map((t) => [lpName(t).toLowerCase(), t])); // Cargo 비교는 대소문자 무시

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cargo(params) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = 'https://lol.fandom.com/api.php?' + new URLSearchParams({ action: 'cargoquery', format: 'json', limit: '500', ...params });
    const res = await fetch(url, { headers: { 'User-Agent': 'TotalDU-TPR/1.0 (totaldu.com)' } });
    const j = await res.json();
    if (j.error?.code === 'ratelimited') { await sleep(30000 * (attempt + 1)); continue; }
    if (j.error) throw new Error(`Cargo 오류: ${JSON.stringify(j.error)}`);
    await sleep(3000); // 연속 호출 간격(레이트 리밋 회피)
    const rows = j.cargoquery.map((x) => x.title);
    if (rows.length >= 500) throw new Error('Cargo 결과 500행 도달 — 페이지네이션 필요');
    return rows;
  }
  throw new Error('Cargo 레이트 리밋 재시도 초과');
}
const inList = (arr) => arr.map((s) => JSON.stringify(s)).join(',');

// 1) 팀명 매핑 검증 — Leaguepedia에 없는 이름이면 "선수 0명"과 구분이 안 되므로 중단
const lpNames = gpr.map(lpName);
const teamRows = await cargo({ tables: 'Teams', fields: 'Name', where: `Name IN (${inList(lpNames)})` });
const known = new Set(teamRows.map((r) => r.Name.toLowerCase()));
const unknown = lpNames.filter((n) => !known.has(n.toLowerCase()));
if (unknown.length) throw new Error(`Leaguepedia에 없는 팀명(ALIAS 보완 필요): ${unknown.join(', ')}`);

// 2) 현 소속 선수(비교체) → 5포지션이 모두 채워진 팀만 확정
const players = await cargo({
  tables: 'Players', fields: 'ID,OverviewPage,Team,Role,IsSubstitute',
  where: `Team IN (${inList(lpNames)}) AND Role IN (${inList(ROLES)}) AND (IsSubstitute IS NULL OR IsSubstitute=0) AND (IsRetired IS NULL OR IsRetired=0)`,
});
const roster = new Map(); // short → {role: [player]}
for (const p of players) {
  const t = byLp.get(p.Team.toLowerCase());
  if (!t) continue;
  const r = roster.get(t.short) || {};
  (r[p.Role] ||= []).push(p);
  roster.set(t.short, r);
}
const filled = gpr.filter((t) => ROLES.every((role) => roster.get(t.short)?.[role]?.length >= 1));

// 3) 전 팀 소속 선수들의 이적 이력(Tenures)·이적 기록(RosterChanges) — 행 수 제한 때문에 나눠서 조회
const pages = gpr.filter((t) => roster.has(t.short)).flatMap((t) => ROLES.flatMap((role) => (roster.get(t.short)[role] || []).map((p) => p.OverviewPage)));
async function cargoBatched(params, field, values, size = 25) {
  const out = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(...await cargo({ ...params, where: `${field} IN (${inList(values.slice(i, i + size))})` + (params.where ? ` AND ${params.where}` : '') }));
  }
  return out;
}
const tenures = await cargoBatched({ tables: 'Tenures', fields: 'Player,Team,DateJoin,DateLeave,ContractEnd,IsCurrent' }, 'Player', pages);
const joins = await cargoBatched({ tables: 'RosterChanges', fields: 'Player,Team,Date_Sort', where: `Direction="Join" AND Date_Sort > "${REF_DATE}"` }, 'Player', pages);
const same = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();

// 2027 시즌 확정 = 월즈 이후 현 팀 입단·재계약 발표(RosterChanges Join) 또는 2027 시즌을 덮는 계약 잔여.
//   재계약은 Tenures 계약 종료일이 갱신되지 않고 RosterChanges에만 Leave+Join으로 남아 둘 다 본다.
const CONTRACT_COVERS_2027 = '2027-11-01';
const committed = (p) => joins.some((j) => same(j.Player, p.OverviewPage) && same(j.Team, p.Team))
  || tenures.some((x) => same(x.Player, p.OverviewPage) && same(x.Team, p.Team) && x.IsCurrent === '1'
    && ((x.DateJoin || '') > REF_DATE || (x.ContractEnd || '') >= CONTRACT_COVERS_2027));
const confirmed = filled.filter((t) => ROLES.every((role) => roster.get(t.short)[role].every(committed)));

// 이전 팀 = 기준일 소속(GPR 보유 팀 우선). 기준일에 소속이 없으면(군 복무·휴식 등, 예: Deft→2024 KT) 직전 소속.
const prevTeam = (page) => {
  const mine = tenures.filter((x) => same(x.Player, page) && x.DateJoin && x.DateJoin <= REF_DATE);
  const at = mine.filter((x) => !x.DateLeave || x.DateLeave >= REF_DATE);
  const atPick = at.find((x) => byLp.has(x.Team.toLowerCase())) || at[0];
  const pick = atPick || mine.sort((a, b) => (b.DateLeave || '').localeCompare(a.DateLeave || ''))[0];
  // 시즌 연도: 기준일 소속이면 2026, 직전 소속이면 이탈 연도(1월 이탈은 전 시즌).
  // shortcut: 이탈 월로만 시즌을 추정 — 시즌 중반 이탈자가 생기면 출전 기록 기준으로 교체
  const leave = pick?.DateLeave || '';
  const year = atPick ? Number(REF_DATE.slice(0, 4)) : leave ? Number(leave.slice(0, 4)) - (leave.slice(5, 7) === '01' ? 1 : 0) : null;
  const team = pick && byLp.get(pick.Team.toLowerCase());
  return { team: team || null, name: pick?.Team ?? null, year };
};

const drafts = [];
for (const t of gpr) {
  const ps = [];
  for (const role of ROLES) for (const p of (roster.get(t.short)?.[role] || []).filter(committed)) {
    const prev = prevTeam(p.OverviewPage);
    // shortcut: 이전 팀 매핑은 현 GPR 58팀 이름 기준 — 해체·리그 이탈 팀(예: 2024 FPX) 출신은 GPR 없음 처리
    const score = prev.team && prev.year ? (await gprAt(prev.year))[prev.team.short] ?? null : null;
    // 쉰 시즌 1개당 반영 비율 50% (사용자 지정: 2024 KT→2시즌 공백인 Deft는 25%)
    const rest = prev.year ? 0.5 ** (Number(REF_DATE.slice(0, 4)) - prev.year) : 1;
    ps.push({ role, name: p.ID, page: p.OverviewPage, lpTeam: prev.name, prevTeam: prev.team?.short ?? prev.name, prevYear: prev.year, prevGpr: score, rest });
  }
  drafts.push({ t, ps });
}

// 출전 비율 = 이전 팀 그 시즌(1~12월) 공식 경기 중 선수 출전 게임 / 팀 전체 게임 (Leaguepedia ScoreboardPlayers)
// KeSPA Cup(2군 기용 잦은 비시즌 컵)은 출전·팀 경기 수에서 제외 (사용자 지정)
const noCup = (a = '') => ` AND ${a}OverviewPage NOT LIKE "%KeSPA Cup%"`;
const played = {}; // `${year}|${team}` → { total, [link]: games }
const lc = (x) => (x || '').toLowerCase();
const wanted = {};
for (const { ps } of drafts) for (const p of ps) if (p.prevGpr != null) (wanted[p.prevYear] ||= new Set()).add(p.lpTeam);
for (const [year, set] of Object.entries(wanted)) {
  const span = `DateTime_UTC >= "${year}-01-01" AND DateTime_UTC < "${+year + 1}-01-01"`;
  const names = [...set];
  for (const r of await cargoBatched({ tables: 'ScoreboardPlayers', fields: 'Team,COUNT(DISTINCT GameId)=N', where: span + noCup(), group_by: 'Team' }, 'Team', names))
    (played[`${year}|${lc(r.Team)}`] ||= {}).total = +r.N;
  // 경기 기록의 Link는 당시 표기(예: Thanatos (Park Seung-kyu)) → PlayerRedirects로 현 선수 페이지에 맞춤
  for (const r of await cargoBatched({ tables: 'ScoreboardPlayers=SP,PlayerRedirects=PR', join_on: 'SP.Link=PR.AllName', fields: 'PR.OverviewPage=OP,SP.Team=Team,COUNT(*)=N', where: span.replaceAll('DateTime_UTC', 'SP.DateTime_UTC') + noCup('SP.'), group_by: 'PR.OverviewPage,SP.Team' }, 'SP.Team', names, 20))
    (played[`${year}|${lc(r.Team)}`] ||= {})[lc(r.OP)] = +r.N;
}

for (const { ps } of drafts) for (const p of ps) {
  const g = played[`${p.prevYear}|${lc(p.lpTeam)}`];
  p.games = g?.[lc(p.page)] ?? 0;
  p.teamGames = g?.total ?? 0;
}

// 이전 팀에서 0경기(벤치·2군)면 마지막으로 출전한 시즌의 GPR 팀으로 대체 — 쉰 시즌 감쇠 동일 적용 (사용자: Calix는 2025 출전분 50%)
const FIRST_GPR_YEAR = 2024; // lolesports /gpr/{연도}/worlds 존재 최초 연도
const benched = drafts.flatMap((d) => d.ps).filter((p) => p.teamGames && !p.games);
if (benched.length) {
  const hist = await cargoBatched({ tables: 'ScoreboardPlayers=SP,PlayerRedirects=PR', join_on: 'SP.Link=PR.AllName',
    fields: 'PR.OverviewPage=OP,SP.Team=Team,YEAR(SP.DateTime_UTC)=Y,COUNT(*)=N', where: `SP.DateTime_UTC >= "${FIRST_GPR_YEAR}-01-01"` + noCup('SP.'),
    group_by: 'PR.OverviewPage,SP.Team,YEAR(SP.DateTime_UTC)' }, 'PR.OverviewPage', [...new Set(benched.map((p) => p.page))]);
  for (const p of benched) {
    const last = hist.filter((h) => same(h.OP, p.page) && +h.Y < p.prevYear && byLp.has(lc(h.Team)))
      .sort((a, b) => b.Y - a.Y || b.N - a.N)[0];
    if (!last) continue;
    const [tot] = await cargo({ tables: 'ScoreboardPlayers', fields: 'COUNT(DISTINCT GameId)=N', where: `Team="${last.Team}" AND DateTime_UTC >= "${last.Y}-01-01" AND DateTime_UTC < "${+last.Y + 1}-01-01"` + noCup() });
    Object.assign(p, { lpTeam: last.Team, prevTeam: byLp.get(lc(last.Team)).short, prevYear: +last.Y, prevGpr: (await gprAt(+last.Y))[byLp.get(lc(last.Team)).short] ?? null,
      games: +last.N, teamGames: +tot.N, rest: 0.5 ** (Number(REF_DATE.slice(0, 4)) - +last.Y) });
  }
}

const teams = [];
for (const { t, ps } of drafts) {
  for (const p of ps) {
    // shortcut: 팀 경기 기록이 없으면(이름 불일치 등) 출전 비율 1로 둠 — 발생 시 콘솔 경고 확인
    const share = p.teamGames ? p.games / p.teamGames : 1;
    if (!p.teamGames && p.prevGpr != null) console.warn(`경기 기록 없음: ${p.prevYear} ${p.lpTeam} (${p.name})`);
    p.weight = Math.round(p.rest * share * 1000) / 1000;
    delete p.page; delete p.lpTeam; delete p.rest;
  }
  const known = ps.filter((p) => p.prevGpr != null && p.weight > 0);
  // shortcut: GPR 없는 이전 팀(2군·ERL·무소속) 선수는 평균에서 제외, coverage로 표기 — 보정 규칙이 정해지면 교체
  const wSum = known.reduce((s, p) => s + p.weight, 0);
  const tpr = known.length ? Math.round(known.reduce((s, p) => s + p.prevGpr * p.weight, 0) / wSum) : null;
  if (tpr == null) continue; // 계약 확정 선수가 없거나 전원 GPR 없음·미출전 → pending
  const roles = ROLES.filter((role) => ps.some((p) => p.role === role)).length;
  teams.push({ short: t.short, name: t.name, league: t.league, tpr, complete: confirmed.includes(t), roles, coverage: `${known.length}/${ps.length}`, players: ps });
}
teams.sort((a, b) => (b.tpr ?? -1) - (a.tpr ?? -1));

for (const t of teams) console.assert(!t.complete || t.roles === 5, `TPR 자체검사 실패: ${t.short} 확정 팀인데 포지션 누락`);

const pending = gpr.filter((t) => !teams.some((x) => x.short === t.short)).map((t) => {
  const ps = ROLES.flatMap((role) => roster.get(t.short)?.[role] || []);
  return {
    short: t.short, league: t.league, filled: ROLES.filter((role) => roster.get(t.short)?.[role]?.length >= 1).length,
    // 5포지션이 찼어도 2027 발표가 안 난 선수(계약 만료 후 미발표 등)가 있으면 미확정
    ...(filled.includes(t) && { unannounced: ps.filter((p) => !committed(p)).map((p) => p.ID) }),
  };
});

fs.writeFileSync(outFile, JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'Leaguepedia (lol.fandom.com) Players·Tenures·RosterChanges',
  gprBase: 'lolesports.com/gpr/{연도}/worlds (시즌별 월즈 종료 스냅샷)',
  refDate: REF_DATE,
  teams, pending,
}, null, 2) + '\n');
console.log(`TPR: 산출 ${teams.length}팀(로스터 확정 ${teams.filter((t) => t.complete).length}) / 산출 불가 ${pending.length}팀 → lolTpr.json`);
for (const t of teams) console.log(`${t.league.padEnd(5)} ${t.short.padEnd(5)} TPR ${t.tpr} ${t.complete ? '확정' : `잠정 ${t.roles}/5`} (${t.coverage}) ${t.players.map((p) => `${p.name}←${p.prevYear ?? ''}${p.prevTeam ?? '?'}:${p.prevGpr ?? '-'}×${p.weight}`).join(' ')}`);
