// 백엔드(Vercel) 주소. 로컬 → localhost, 배포(close beta·open beta·prod) → Vercel에 연결된 단일 백엔드.
//   (예전 beta 전용 백엔드 down-up17-github-io는 Vercel 연결이 끊겨 갱신되지 않으므로 사용하지 않음)
export const API_BASE = import.meta.env.DEV
  ? 'http://localhost:4000'
  : 'https://totaldu-github-io.vercel.app';
