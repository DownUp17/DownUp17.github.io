// server/lolLive.js
// LoL 실시간 경기 — lolesports API(getLive → getEventDetails → livestats window)를 대신 호출해
// 진행 중 경기의 세트 스코어·현재 세트 골드/킬/오브젝트를 돌려준다.
// API 키는 환경변수 LOLESPORTS_API_KEY(Vercel 프로젝트 환경변수 / 로컬은 리포 루트 .env).
const API = 'https://esports-api.lolesports.com/persisted/gw';
const FEED = 'https://feed.lolesports.com/livestats/v1';
const CACHE_MS = 20 * 1000; // 방문자가 많아도 lolesports 호출은 20초에 한 번

let cache = { at: 0, data: null, pending: null };

const getJson = async (url, withKey) => {
  const res = await fetch(url, withKey ? { headers: { 'x-api-key': process.env.LOLESPORTS_API_KEY } } : undefined);
  if (!res.ok) throw new Error(`${url.split('?')[0]} → HTTP ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null; // livestats는 경기 시작 전 빈 응답(204)일 수 있음
};

// livestats 프레임 1개 → 팀별 요약
const teamFrame = (t) => t && ({
  gold: t.totalGold, kills: t.totalKills, towers: t.towers, inhibitors: t.inhibitors,
  barons: t.barons, dragons: (t.dragons || []).length,
});

async function liveGame(gameId) {
  // startingTime 없이 부르면 경기 시작 직후 프레임(골드 0)이 온다 → 최근 시각(10초 단위 내림)부터의 구간을 요청해 마지막 프레임 = 현재 상태.
  //   피드는 실제보다 늦게 쌓여 너무 최근 시각은 빈 응답/오류 → 40초·1분·1분 30초·2분·3분 전 순으로 물러나며 재시도.
  //   (시작 구간으로 폴백하면 경기 내내 0으로 보이므로 폴백하지 않음)
  let w = null;
  for (const sec of [40, 60, 90, 120, 180]) {
    const t = new Date(Math.floor((Date.now() - sec * 1000) / 10000) * 10000).toISOString();
    w = await getJson(`${FEED}/window/${gameId}?startingTime=${t}`).catch(() => null);
    if (w?.frames?.length) break;
  }
  const frame = w?.frames?.[w.frames.length - 1];
  if (!frame) return null;
  return {
    state: frame.gameState, // in_game / paused / finished
    blueTeamId: w.gameMetadata?.blueTeamMetadata?.esportsTeamId,
    redTeamId: w.gameMetadata?.redTeamMetadata?.esportsTeamId,
    blue: teamFrame(frame.blueTeam),
    red: teamFrame(frame.redTeam),
    frameTime: frame.rfc460Timestamp,
  };
}

async function build() {
  const live = await getJson(`${API}/getLive?hl=ko-KR`, true);
  const events = (live?.data?.schedule?.events || []).filter((e) => e.type === 'match' && e.state === 'inProgress');
  const matches = await Promise.all(events.map(async (e) => {
    const det = await getJson(`${API}/getEventDetails?hl=ko-KR&id=${e.match?.id || e.id}`, true).catch(() => null);
    const m = det?.data?.event?.match || e.match || {};
    const teams = (m.teams || e.match?.teams || []).map((t) => ({
      id: t.id, code: t.code, name: t.name, image: t.image, wins: t.result?.gameWins ?? 0,
    }));
    const games = m.games || [];
    const cur = games.find((g) => g.state === 'inProgress');
    const game = cur ? await liveGame(cur.id) : null;
    return {
      id: e.id,
      league: { name: e.league?.name, slug: e.league?.slug, image: e.league?.image },
      blockName: e.blockName,
      bestOf: m.strategy?.count || e.match?.strategy?.count || null,
      teams,
      game: game && { number: cur.number, ...game },
    };
  }));
  return { updatedAt: new Date().toISOString(), matches };
}

async function getLiveMatches() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (!cache.pending) {
    cache.pending = build()
      .then((data) => { cache = { at: Date.now(), data, pending: null }; return data; })
      .catch((err) => { cache.pending = null; if (cache.data) return cache.data; throw err; }); // 실패 시 직전 값 유지
  }
  return cache.pending;
}

module.exports = { getLiveMatches, liveGame };
