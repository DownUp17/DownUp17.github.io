// Leaguepedia 선수 연도별 기록 수집 — lol.fandom.com 탭에서 실행(champStats.browser.js와 같은 방식).
//   window.LP_YEARS = [2011, …] 지정 후 실행 → window._st 'done …' → sessionStorage.gzPY(gzip+base64)를 recv.cjs로 전달 → applyPlayerYears.cjs
//   결과: { [연도]: { [소문자 이름]: [[팀, 역할, 경기, 승, K, D, A, CS, 골드, 분, 딜, 팀딜, 팀킬, [[챔피언, 경기]…]] …] } }
(async (YEARS = window.LP_YEARS || [new Date().getFullYear()]) => {
  window._st = 'run';
  try {
    const sl = (ms) => new Promise((s) => setTimeout(s, ms));
    const q = async (p) => {
      const u = '/index.php?title=Special:CargoExport&format=json&limit=5000&' + new URLSearchParams(p);
      for (let i = 0; i < 6; i++) { try { const r = await fetch(u).then((x) => x.json()); if (Array.isArray(r)) return r; } catch { /* 재시도 */ } await sl(8000); }
      throw new Error(u);
    };
    const all = async (p) => { let rows = []; for (let off = 0; ; off += 5000) { const r = await q({ ...p, offset: off }); rows = rows.concat(r); if (r.length < 5000) break; await sl(400); } return rows; };
    const W = (Y) => `T.Year="${Y}" AND T.TournamentLevel="Primary" AND T.League<>"Esports Nations Cup"`;
    const N = (v) => Number(v) || 0;
    const OUT = {};
    for (const Y of YEARS) {
      const len = {};
      for (const x of await all({ tables: 'ScoreboardGames=SG,Tournaments=T', join_on: 'SG.OverviewPage=T.OverviewPage', fields: 'SG.GameId=g,SG.Gamelength_Number=m', where: W(Y), order_by: 'SG.GameId' })) len[x.g] = N(x.m);
      const rows = await all({ tables: 'ScoreboardPlayers=SP,Tournaments=T', join_on: 'SP.OverviewPage=T.OverviewPage',
        fields: 'SP.Link=k,SP.Team=t,SP.Role=r,SP.Champion=c,SP.PlayerWin=w,SP.Kills=K,SP.Deaths=D,SP.Assists=A,SP.CS=cs,SP.Gold=go,SP.DamageToChampions=dm,SP.TeamKills=tk,SP.GameId=g',
        where: W(Y), order_by: 'SP.GameId' });
      const teamDmg = {}; for (const x of rows) teamDmg[x.g + '|' + x.t] = (teamDmg[x.g + '|' + x.t] || 0) + N(x.dm);
      const P = {};
      for (const x of rows) {
        const name = String(x.k || '').replace(/\s*\(.*\)$/, '').trim().toLowerCase(); if (!name) continue;
        const e = ((P[name] ??= {})[x.k + '|' + x.t] ??= { t: x.t, r: {}, v: Array(12).fill(0), c: {} });
        e.r[x.r] = (e.r[x.r] || 0) + 1;
        const add = [1, x.w === 'Yes' ? 1 : 0, N(x.K), N(x.D), N(x.A), N(x.cs), N(x.go), len[x.g] || 0, N(x.dm), teamDmg[x.g + '|' + x.t] || 0, N(x.tk)];
        add.forEach((a, i) => (e.v[i] += a));
        e.c[x.c] = (e.c[x.c] || 0) + 1;
      }
      OUT[Y] = Object.fromEntries(Object.entries(P).map(([n, o]) => [n, Object.values(o).map((e) => [e.t, Object.entries(e.r).sort((a, b) => b[1] - a[1])[0][0], ...e.v.slice(0, 11).map((v) => Math.round(v)), Object.entries(e.c).sort((a, b) => b[1] - a[1]).slice(0, 5)])]));
      window._st = 'Y' + Y + ' r' + rows.length;
    }
    const buf = new Uint8Array(await new Response(new Blob([JSON.stringify(OUT)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
    sessionStorage.setItem('gzPY', btoa(s));
    window._st = 'done ' + s.length;
  } catch (e) { window._st = 'fail ' + e; }
})();
