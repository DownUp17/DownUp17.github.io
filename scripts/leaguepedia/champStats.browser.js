// Leaguepedia 경기 기록 수집 — lol.fandom.com 탭에서 실행(Node fetch는 Cloudflare 차단).
//   사용: 이 파일 내용을 fandom 페이지 콘솔/javascript_tool에서 실행 → window._st가 'done …'이 되면
//   sessionStorage.gzLP(gzip+base64)를 로컬 수신기(scripts/leaguepedia/recv.cjs)로 넘긴 뒤 applyChampStats.cjs로 적용.
//   YEARS 기본값 = 올해만(지난 시즌 기록은 바뀌지 않음).
(async (YEARS = [new Date().getFullYear()]) => {
  window._st = 'run';
  try {
    const sl = (ms) => new Promise((s) => setTimeout(s, ms));
    const q = async (p) => {
      const u = '/index.php?title=Special:CargoExport&format=json&limit=5000&' + new URLSearchParams(p);
      for (let i = 0; i < 6; i++) { try { const r = await fetch(u).then((x) => x.json()); if (Array.isArray(r)) return r; } catch { /* 재시도 */ } await sl(8000); }
      throw new Error(u);
    };
    const all = async (p) => { let rows = []; for (let off = 0; ; off += 5000) { const r = await q({ ...p, offset: off }); rows = rows.concat(r); if (r.length < 5000) break; await sl(400); } return rows; };
    const LG = {}; for (const x of await q({ tables: 'Leagues', fields: 'League,League_Short=s' })) LG[x.League] = x.s || x.League;
    LG['World Championship'] = 'Worlds';
    const fix = (s) => String(s || '').replace(/&amp;/g, '&').trim();
    const W = (Y) => `T.Year="${Y}" AND T.TournamentLevel="Primary" AND T.League<>"Esports Nations Cup"`;
    const OUT = {};
    for (const Y of YEARS) {
      const gr = await all({ tables: 'ScoreboardGames=SG,Tournaments=T', join_on: 'SG.OverviewPage=T.OverviewPage', fields: 'SG.GameId=g,SG.Patch=p,T.League=l,SG.Team1Bans=a,SG.Team2Bans=b', where: W(Y), order_by: 'SG.GameId' });
      const GI = {}, gLP = {}, B = {}, bans = {};
      for (const x of gr) {
        const l = LG[x.l] || x.l || '?', p = String(x.p || '?'); GI[x.g] = { l, p };
        const o = (gLP[l] ??= {}); o[p] = (o[p] || 0) + 1;
        for (const s of [x.a, x.b]) for (const c0 of (Array.isArray(s) ? s : String(s || '').split(','))) {
          const c = fix(c0); if (!c || c === 'None') continue;
          const bl = ((B[c] ??= {})[l] ??= {}); bl[p] = (bl[p] || 0) + 1; bans[c] = (bans[c] || 0) + 1;
        }
      }
      const rows = await all({ tables: 'ScoreboardPlayers=SP,Tournaments=T', join_on: 'SP.OverviewPage=T.OverviewPage', fields: 'SP.Champion=c,SP.Role=r,SP.PlayerWin=w,SP.Link=k,SP.Team=t,SP.GameId=g', where: W(Y), order_by: 'SP.GameId' });
      const C = {}, CL = {}, G = {}, PR = {}, PRL = {}, PL = {}, TM = {};
      for (const x of rows) {
        const c = fix(x.c), w = x.w === 'Yes' ? 1 : 0, gi = GI[x.g] || { l: '?', p: '?' }; if (!c) continue;
        const e = (C[c] ??= { n: 0, w: 0, r: {} }); e.n++; e.w += w; (e.r[x.r] ??= [0, 0]); e.r[x.r][0]++; e.r[x.r][1] += w;
        const el = ((CL[c] ??= {})[gi.l] ??= { n: 0, w: 0, r: {}, p: {} }); el.n++; el.w += w;
        for (const [o, key] of [[el.r, x.r], [el.p, gi.p]]) { const v = (o[key] ??= [0, 0]); v[0]++; v[1] += w; }
        const pl = (PL[x.k] ??= { t: x.t, n: 0, w: 0, c: {} }); pl.t = x.t; pl.n++; pl.w += w; pl.c[c] = (pl.c[c] || 0) + 1;
        (G[x.g + '|' + x.t] ??= { w, l: gi.l })[x.r] = c;
      }
      for (const [k, v] of Object.entries(G)) {
        const tm = k.split('|')[1]; const T = (TM[tm] ??= [0, 0]); T[0]++; T[1] += v.w;
        if (v.Bot && v.Support) { const key = v.Bot + '|' + v.Support; for (const P of [(PR[key] ??= [0, 0]), ((PRL[v.l] ??= {})[key] ??= [0, 0])]) { P[0]++; P[1] += v.w; } }
      }
      for (const p of Object.values(PL)) p.c = Object.entries(p.c).sort((a, b) => b[1] - a[1]).slice(0, 5);
      OUT[Y] = { summary: { games: gr.length, champs: C, bans, pairs: PR, players: PL, teams: TM }, detail: { gLP, champs: CL, bans: B, pairs: PRL } };
      window._st = 'Y' + Y + ' g' + gr.length;
    }
    const buf = new Uint8Array(await new Response(new Blob([JSON.stringify(OUT)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
    sessionStorage.setItem('gzLP', btoa(s));
    window._st = 'done ' + s.length;
  } catch (e) { window._st = 'fail ' + e; }
})();
