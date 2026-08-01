// scripts/predictionStats.mjs
// predictionLog.csv를 읽어 예측 성공률 통계를 출력한다.
//
// 사용법:
//   node scripts/predictionStats.mjs           # 전체 통계
//   node scripts/predictionStats.mjs lck       # 특정 대회만
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(__dirname, '..', 'client', 'src', 'data', 'predictionLog.csv');

if (!fs.existsSync(csvPath)) {
  console.log('기록된 경기 결과가 없습니다. (predictionLog.csv 미존재)');
  console.log('node scripts/logResult.mjs <competition> <teamA> <teamB> <actualWinner> 로 결과를 기록하세요.');
  process.exit(0);
}

const filterComp = process.argv[2]?.toLowerCase();

const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
const rows = lines.slice(1).map((l) => {
  const [date, competition, team_a, team_b, pA, predicted_winner, actual_winner, correct] = l.split(',');
  return { date, competition, team_a, team_b, pA: pA ? Number(pA) : null, predicted_winner, actual_winner, correct: correct === 'true' ? true : correct === 'false' ? false : null };
}).filter((r) => !filterComp || r.competition === filterComp);

if (rows.length === 0) {
  console.log(filterComp ? `"${filterComp}" 대회 기록이 없습니다.` : '기록된 경기가 없습니다.');
  process.exit(0);
}

const valid = rows.filter((r) => r.correct !== null);
const correct = valid.filter((r) => r.correct === true);
const rate = valid.length > 0 ? ((correct.length / valid.length) * 100).toFixed(1) : '—';

const header = filterComp
  ? `[${filterComp.toUpperCase()}] 예측 성공률`
  : '전체 예측 성공률';

console.log(`\n=== ${header} ===`);
console.log(`총 ${valid.length}경기 중 ${correct.length}경기 예측 성공 → ${rate}%\n`);

// 대회별 집계
const byComp = {};
for (const r of valid) {
  if (!byComp[r.competition]) byComp[r.competition] = { ok: 0, total: 0 };
  byComp[r.competition].total++;
  if (r.correct) byComp[r.competition].ok++;
}

if (!filterComp && Object.keys(byComp).length > 1) {
  console.log('── 대회별 ──');
  for (const [comp, { ok, total }] of Object.entries(byComp)) {
    const r = ((ok / total) * 100).toFixed(1);
    console.log(`  ${comp.padEnd(8)} ${ok}/${total} (${r}%)`);
  }
  console.log('');
}

// 경기별 상세
console.log('── 경기별 상세 ──');
const colW = 6;
for (const r of rows) {
  const flag = r.correct === true ? '✓' : r.correct === false ? '✗' : '?';
  const pAStr = r.pA != null ? `${r.pA}%` : '  ?';
  console.log(
    `  ${flag} [${r.competition.toUpperCase()}] ` +
    `${r.team_a.padEnd(colW)} vs ${r.team_b.padEnd(colW)}` +
    `  예측: ${(r.predicted_winner || '?').padEnd(colW)} (${pAStr.padStart(4)})` +
    `  실제: ${r.actual_winner.padEnd(colW)}` +
    `  (${r.date})`
  );
}
console.log('');
