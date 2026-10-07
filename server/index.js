// server/index.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
// 로컬 실행 시 리포 루트 .env(LOLESPORTS_API_KEY 등) 로드 — Vercel에서는 프로젝트 환경변수 사용
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getLiveMatches } = require('./lolLive');

const app = express();

// CORS 설정 (GitHub Pages + 로컬 개발 모두 허용)
app.use(cors({
  origin: [
    'https://totaldu.github.io',   // 배포된 프론트엔드 (신규)
    'https://downup17.github.io',  // 구 주소 (계정명 변경 전 호환)
    'https://totaldu.com',         // production
    'https://www.totaldu.com',
    'http://localhost:5173'         // 로컬 개발용
  ],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// --- 설정값 ---
// 비밀값은 환경변수로만 주입 (로컬: 루트 .env, 배포: Vercel 프로젝트 설정)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;
const authConfigured = () => Boolean(ADMIN_PASSWORD && JWT_SECRET);

// --- 임시 데이터베이스 ---
let wikiArticles = [
  { id: 1, title: '위키 시작하기', content: '이곳은 지식 정리 플랫폼입니다.', updatedAt: new Date() },
  { id: 2, title: '정부 디자인 가이드', content: '상단 바는 군청색(#005596)을 사용합니다.', updatedAt: new Date() }
];
let nextId = 3;

// --- 관리자 인증 미들웨어 ---
const verifyAdmin = (req, res, next) => {
  if (!authConfigured()) return res.status(503).json({ message: "관리자 인증이 설정되지 않았습니다." });
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "권한이 없습니다." });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ message: "권한이 없습니다." });
  } catch (err) {
    return res.status(403).json({ message: "유효하지 않은 토큰입니다." });
  }
  next();
};

// --- API 라우트 ---

// 1. 관리자 로그인
app.post('/api/login', (req, res) => {
  if (!authConfigured()) return res.status(503).json({ message: "관리자 인증이 설정되지 않았습니다." });
  if (req.body?.password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token });
  }
  res.status(401).json({ message: "비밀번호가 틀렸습니다." });
});

// 2. 전체 문서 목록 (공개)
app.get('/api/articles', (req, res) => res.json(wikiArticles));

// 3. 문서 검색 (공개)
app.get('/api/search', (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const filtered = wikiArticles.filter(a => a.title.toLowerCase().includes(query));
  res.json(filtered);
});

// 4. 새 문서 작성 (관리자 전용)
app.post('/api/articles', verifyAdmin, (req, res) => {
  const newArticle = { id: nextId++, ...req.body, updatedAt: new Date() };
  wikiArticles.push(newArticle);
  res.status(201).json(newArticle);
});

// 5. LoL 실시간 경기 (공개) — 진행 중 경기·세트 스코어·현재 세트 골드/킬/오브젝트. 20초 캐시.
app.get('/api/lol/live', async (req, res) => {
  // 로컬 화면 확인용 예시 데이터(?demo=1) — 배포(NODE_ENV=production)에서는 무시
  if (req.query.demo && process.env.NODE_ENV !== 'production') {
    return res.json({ updatedAt: new Date().toISOString(), demo: true, matches: [{
      id: 'demo', league: { name: 'Worlds' }, blockName: '스위스 스테이지', bestOf: 3,
      teams: [{ id: 'a', code: 'T1', name: 'T1', wins: 1 }, { id: 'b', code: 'GEN', name: 'Gen.G', wins: 0 }],
      game: { number: 2, state: 'in_game', blueTeamId: 'b', redTeamId: 'a',
        blue: { gold: 41200, kills: 9, towers: 4, dragons: 2, barons: 0, inhibitors: 0 },
        red: { gold: 44800, kills: 13, towers: 6, dragons: 2, barons: 1, inhibitors: 1 } },
    }] });
  }
  if (!process.env.LOLESPORTS_API_KEY) return res.status(503).json({ message: 'LOLESPORTS_API_KEY 미설정' });
  try {
    res.set('Cache-Control', 'public, max-age=15');
    res.json(await getLiveMatches());
  } catch (err) {
    res.status(502).json({ message: '실시간 경기 정보를 가져오지 못했습니다.', detail: err.message });
  }
});

// Vercel 배포용 export
module.exports = app;

// 로컬 실행용 (Vercel에서는 무시됨)
if (require.main === module) {
  app.listen(4000, () => console.log('서버 실행 중: http://localhost:4000'));
}
