// champStats.browser.js 결과(gzip+base64) → lolChampStats.json(요약) · lolChampDetail.json(리그·패치별)에 연도 단위로 덮어씀.
//   사용: node scripts/leaguepedia/applyChampStats.cjs <수신 파일>
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const DATA = path.join(__dirname, '..', '..', 'client', 'src', 'data');
const inp = process.argv[2];
const O = JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(inp, 'utf8'), 'base64')).toString());
const sf = path.join(DATA, 'lolChampStats.json'), df = path.join(DATA, 'lolChampDetail.json');
const sum = JSON.parse(fs.readFileSync(sf, 'utf8')), det = JSON.parse(fs.readFileSync(df, 'utf8'));
for (const [y, v] of Object.entries(O)) {
  // 경기가 0이면(수집 실패 등) 기존 데이터를 지우지 않음
  if (!v.summary?.games) { console.log('skip', y, '(경기 0)'); continue; }
  sum.years[y] = v.summary; det.years[y] = v.detail;
  console.log(y, '경기', v.summary.games, '챔피언', Object.keys(v.summary.champs).length);
}
sum.updatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(sf, JSON.stringify(sum));
fs.writeFileSync(df, JSON.stringify(det));
