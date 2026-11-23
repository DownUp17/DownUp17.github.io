// 브라우저(fandom 탭) → 로컬 파일 전달용 1회성 수신기. 사용: node recv.cjs <저장 경로>
//   fandom 탭에서 location.href = 'http://localhost:5793/#' + encodeURIComponent(데이터) 로 이동하면 저장 후 종료.
const http = require('http'), fs = require('fs');
const out = process.argv[2];
if (!out) { console.error('usage: node recv.cjs <out file>'); process.exit(1); }
const page = '<script>fetch("/",{method:"POST",body:decodeURIComponent(location.hash.slice(1))}).then(r=>r.text()).then(t=>document.body.textContent=t)</script>';
http.createServer((q, r) => {
  if (q.method === 'GET') { r.setHeader('content-type', 'text/html'); r.end(page); return; }
  let b = ''; q.setEncoding('utf8'); q.on('data', (d) => (b += d));
  q.on('end', () => { fs.writeFileSync(out, b); r.end('ok ' + b.length); console.log('saved', out, b.length); setTimeout(() => process.exit(0), 300); });
}).listen(5793, () => console.log('listening 5793'));
