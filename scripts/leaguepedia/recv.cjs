// 브라우저(fandom 탭) → 로컬 파일 전달용 수신기. 사용: node recv.cjs <저장 경로>
//   주소 길이 한도(~2MB) 때문에 조각으로 받음: fandom 탭에서 조각 i(0부터)/전체 n마다
//   location.href = 'http://localhost:5793/#' + i + '/' + n + '/' + encodeURIComponent(조각) 로 이동 → 다시 fandom으로 돌아와 다음 조각.
//   n개를 다 받으면 이어 붙여 저장하고 종료. (조각 없이 '#데이터'만 오면 그대로 저장)
const http = require('http'), fs = require('fs');
const out = process.argv[2];
if (!out) { console.error('usage: node recv.cjs <out file>'); process.exit(1); }
const page = '<script>fetch("/",{method:"POST",body:location.hash.slice(1)}).then(r=>r.text()).then(t=>document.body.textContent=t)</script>';
const parts = [];
http.createServer((q, r) => {
  if (q.method === 'GET') { r.setHeader('content-type', 'text/html'); r.end(page); return; }
  let b = ''; q.setEncoding('utf8'); q.on('data', (d) => (b += d));
  q.on('end', () => {
    const m = b.match(/^(\d+)\/(\d+)\/([\s\S]*)$/);
    const [i, n, data] = m ? [+m[1], +m[2], decodeURIComponent(m[3])] : [0, 1, decodeURIComponent(b)];
    parts[i] = data;
    const got = parts.filter((x) => x != null).length;
    r.end(`ok ${i + 1}/${n} (${data.length})`);
    console.log('part', i + 1, '/', n, data.length);
    if (got === n) { fs.writeFileSync(out, parts.join('')); console.log('saved', out); setTimeout(() => process.exit(0), 300); }
  });
}).listen(5793, () => console.log('listening 5793'));
