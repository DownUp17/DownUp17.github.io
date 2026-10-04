// lolesports API 키 — 코드에 직접 두지 않고 환경변수(LOLESPORTS_API_KEY)에서 읽는다.
//   로컬: 리포 루트의 .env(gitignore 대상)에 LOLESPORTS_API_KEY=... 로 저장.
//   GitHub Actions: 리포 Secrets의 LOLESPORTS_API_KEY를 워크플로 env로 전달.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.LOLESPORTS_API_KEY) {
  try {
    for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*LOLESPORTS_API_KEY\s*=\s*(.*?)\s*$/);
      if (m) process.env.LOLESPORTS_API_KEY = m[1].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* .env 없음 */ }
}
export const LOLESPORTS_API_KEY = process.env.LOLESPORTS_API_KEY;
if (!LOLESPORTS_API_KEY) {
  console.error('LOLESPORTS_API_KEY가 없습니다. 리포 루트 .env 또는 환경변수(GitHub Actions는 Secrets)에 설정하세요.');
  process.exit(1);
}
