// playerYears.browser.js 결과(gzip+base64, recv.cjs로 받은 파일) → client/src/data/lolPlayerYears.json 에 연도별로 합침
//   사용: node applyPlayerYears.cjs <받은 파일>
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const out = path.join(__dirname, '../../client/src/data/lolPlayerYears.json');
const got = JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync(process.argv[2], 'utf8').trim(), 'base64')).toString());
const cur = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : { years: {} };
Object.assign(cur.years, got);
cur.source = 'Leaguepedia ScoreboardPlayers (Primary 대회) — [팀, 역할, 경기, 승, K, D, A, CS, 골드, 분, 딜, 팀딜, 팀킬, 주 챔피언 5]';
cur.updatedAt = new Date().toISOString();
fs.writeFileSync(out, JSON.stringify(cur));
console.log('years', Object.keys(cur.years).join(','), (fs.statSync(out).size / 1e6).toFixed(2) + 'MB');
