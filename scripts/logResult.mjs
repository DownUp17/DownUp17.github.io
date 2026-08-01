// scripts/logResult.mjs
// 경기 결과를 기록하고 시뮬레이션 예측과 비교해 predictionLog.csv에 저장한다.
//
// 사용법:
//   node scripts/logResult.mjs <competition> <teamA> <teamB> <actualWinner> [date]
//   date는 YYYY-MM-DD 형식. 생략하면 오늘 날짜.
//
// 예시:
//   node scripts/logResult.mjs lck HLE BFX HLE
//   node scripts/logResult.mjs lck HLE BFX HLE 2026-06-15
//   node scripts/logResult.mjs lpl JDG NIP NIP 2026-06-14
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'client', 'src', 'data');
const csvPath = path.join(dataDir, 'predictionLog.csv');

const [, , competition, teamA, teamB, actualWinner, dateArg] = process.argv;

if (!competition || !teamA || !teamB || !actualWinner) {
  console.error('사용법: node scripts/logResult.mjs <competition> <teamA> <teamB> <actualWinner> [date]');
  console.error('예시:  node scripts/logResult.mjs lck HLE BFX HLE');
  console.error('예시:  node scripts/logResult.mjs lck HLE BFX HLE 2026-06-15');
  process.exit(1);
}

if (dateArg && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
  console.error(`날짜 형식 오류: "${dateArg}" — YYYY-MM-DD 형식으로 입력하세요. (예: 2026-06-15)`);
  process.exit(1);
}

const simPath = path.join(dataDir, 'lolSim.json');
const sim = JSON.parse(fs.readFileSync(simPath, 'utf8'));

const comp = sim.competitions.find((c) => c.key === competition.toLowerCase());
if (!comp) {
  console.error(`대회 키를 찾을 수 없습니다: "${competition}"`);
  console.error('유효한 키:', sim.competitions.map((c) => c.key).join(', '));
  process.exit(1);
}

const a = teamA.toUpperCase();
const b = teamB.toUpperCase();
const actual = actualWinner.toUpperCase();

if (actual !== a && actual !== b) {
  console.error(`실제 승자는 "${a}" 또는 "${b}" 중 하나여야 합니다. 입력값: "${actual}"`);
  process.exit(1);
}

const match = comp.matches?.find(
  (m) => (m.a === a && m.b === b) || (m.a === b && m.b === a)
);

let pA, predicted;
if (match) {
  // 팀 순서 맞추기 (a·b가 반대일 경우 pA 반전)
  if (match.a === a) {
    pA = match.pA;
    predicted = pA >= 50 ? a : b;
  } else {
    pA = 100 - match.pA;
    predicted = pA >= 50 ? a : b;
  }
} else {
  // 매칭되는 경기가 없으면 pA를 직접 물어보거나 null로 기록
  console.warn(`경고: lolSim.json에서 "${a} vs ${b}" 경기를 찾지 못했습니다. pA=null로 기록합니다.`);
  pA = null;
  predicted = null;
}

const correct = predicted !== null ? predicted === actual : null;
const date = dateArg ?? new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// CSV 헤더
const header = 'date,competition,team_a,team_b,pA,predicted_winner,actual_winner,correct';
const row = [date, competition.toLowerCase(), a, b, pA ?? '', predicted ?? '', actual, correct ?? ''].join(',');

// 중복 확인 (같은 날짜·대회·팀 조합)
let existingContent = '';
if (fs.existsSync(csvPath)) {
  existingContent = fs.readFileSync(csvPath, 'utf8');
  const lines = existingContent.trim().split('\n');
  for (const line of lines.slice(1)) {
    const [d, c, ta, tb] = line.split(',');
    if (c === competition.toLowerCase() && ((ta === a && tb === b) || (ta === b && tb === a))) {
      console.error(`이미 기록된 경기입니다: ${c} ${ta} vs ${tb} (${d})`);
      console.error('덮어쓰려면 CSV 파일에서 해당 행을 직접 삭제 후 다시 실행하세요.');
      process.exit(1);
    }
  }
}

if (!existingContent) {
  fs.writeFileSync(csvPath, header + '\n' + row + '\n', 'utf8');
} else {
  fs.appendFileSync(csvPath, row + '\n', 'utf8');
}

const resultText = correct === true ? '✓ 예측 성공' : correct === false ? '✗ 예측 실패' : '? (pA 없음)';
console.log(`기록 완료: [${competition.toUpperCase()}] ${a} vs ${b}`);
console.log(`  예측: ${predicted ?? '?'} (pA ${pA ?? '?'}%) | 실제: ${actual} | ${resultText}`);
