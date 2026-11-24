// Leaguepedia 경기 기록 수집 — lol.fandom.com 탭에서 실행(Node fetch는 Cloudflare 차단).
//   사용: 이 파일 내용을 fandom 페이지 콘솔/javascript_tool에서 실행 → window._st가 'done …'이 되면
//   sessionStorage.gzLP(gzip+base64)를 로컬 수신기(scripts/leaguepedia/recv.cjs)로 넘긴 뒤 applyChampStats.cjs로 적용.
//   YEARS 기본값 = 올해만(지난 시즌 기록은 바뀌지 않음).
(async (YEARS = window.LP_YEARS || [new Date().getFullYear()]) => { // 전 연도 재수집: window.LP_YEARS = [2011, …] 먼저 지정
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
      const gr = await all({ tables: 'ScoreboardGames=SG,Tournaments=T', join_on: 'SG.OverviewPage=T.OverviewPage', fields: 'SG.GameId=g,T.League=l,T.Name=n,T.IsQualifier=q,T.Region=rg,SG.Team1Bans=a,SG.Team2Bans=b', where: W(Y), order_by: 'SG.GameId' });
      // 패치는 CSV로 따로 받음 — JSON은 숫자로 바꿔 14.10→14.1, 26.20→26.2처럼 다른 패치와 합쳐 버림
      const PT = {};
      for (let off = 0; ; off += 5000) {
        const csv = await fetch('/index.php?title=Special:CargoExport&format=csv&limit=5000&' + new URLSearchParams({ tables: 'ScoreboardGames=SG,Tournaments=T', join_on: 'SG.OverviewPage=T.OverviewPage', fields: 'SG.GameId=g,SG.Patch=p', where: W(Y), order_by: 'SG.GameId', offset: off })).then((r) => r.text());
        const lines = csv.split(/\r?\n/).slice(1).filter(Boolean);
        for (const ln of lines) { const m = ln.match(/^("(?:[^"]|"")*"|[^,]*),(.*)$/); if (m) PT[m[1].replace(/^"|"$/g, '').replace(/""/g, '"')] = m[2].replace(/^"|"$/g, ''); }
        if (lines.length < 5000) break; await sl(400);
      }
      // 국제전 예선(Worlds 지역 선발전·EWC 온라인 예선 등)은 그 지역 리그 기록으로 넣음.
      //   지역 리그 = 그 해 같은 Region에서 (국제전·예선 제외) 경기가 가장 많은 리그. 예: 2026 China → LPL
      const INTL = /^(Worlds|MSI|FST|EWC|MSC|IEM|RR|AG|Masters)$/;
      // 플레이-인은 IsQualifier=1이어도 국제전 본 대회의 일부
      const isQual = (x) => (String(x.q) === '1' || /Regional Finals|Qualifier|Gauntlet/i.test(x.n || '')) && !/Play-?In/i.test(x.n || '');
      const regCnt = {};
      for (const x of gr) { const l = LG[x.l] || x.l; if (x.rg && l && !INTL.test(l) && !isQual(x)) { const o = (regCnt[x.rg] ??= {}); o[l] = (o[l] || 0) + 1; } }
      const regLeague = Object.fromEntries(Object.entries(regCnt).map(([rg, o]) => [rg, Object.entries(o).sort((a, b) => b[1] - a[1])[0][0]]));
      const GI = {}, gLP = {}, B = {}, bans = {}, iP = {}; // iP: 패치 → 그 패치로 치른 대회(예선 제외, 패치 아래 국제 로고용)
      for (const x of gr) {
        let l = LG[x.l] || x.l || '?'; const p = PT[x.g] || '?';
        if (/^(Worlds|MSI|FST|EWC|MSC)$/.test(l) && isQual(x) && regLeague[x.rg]) l = regLeague[x.rg]; // 아시안게임 예선은 국가대표라 제외
        GI[x.g] = { l, p };
        const o = (gLP[l] ??= {}); o[p] = (o[p] || 0) + 1;
        // 예선 제외 — 옛 Worlds 지역 선발전은 IsQualifier 표시 없이 'NA Regional Finals 2018'처럼 이름으로만 구분됨
        if (!isQual(x) && !(iP[p] ??= []).includes(l)) iP[p].push(l);
        for (const s of [x.a, x.b]) for (const c0 of (Array.isArray(s) ? s : String(s || '').split(','))) {
          const c = fix(c0); if (!c || c === 'None') continue;
          const bl = ((B[c] ??= {})[l] ??= {}); bl[p] = (bl[p] || 0) + 1; bans[c] = (bans[c] || 0) + 1;
        }
      }
      const rows = await all({ tables: 'ScoreboardPlayers=SP,Tournaments=T', join_on: 'SP.OverviewPage=T.OverviewPage', fields: 'SP.Champion=c,SP.Role=r,SP.PlayerWin=w,SP.Link=k,SP.Team=t,SP.GameId=g', where: W(Y), order_by: 'SP.GameId' });
      const C = {}, CL = {}, G = {}, PR = {}, PRL = {}, PL = {}, TM = {}, MT = {}; // MT: 리그 → 챔피언 → 같은 팀 챔피언 [경기, 승]
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
        const cs = Object.entries(v).filter(([k]) => k !== 'w' && k !== 'l').map(([, c]) => c);
        for (const a of cs) for (const b of cs) if (a !== b) { const M = (((MT[v.l] ??= {})[a] ??= {})[b] ??= [0, 0]); M[0]++; M[1] += v.w; }
        if (v.Bot && v.Support) { const key = v.Bot + '|' + v.Support; for (const P of [(PR[key] ??= [0, 0]), ((PRL[v.l] ??= {})[key] ??= [0, 0])]) { P[0]++; P[1] += v.w; } }
      }
      // 용량 줄이기: 리그·챔피언마다 같은 팀 챔피언 상위 15개만
      for (const o of Object.values(MT)) for (const a of Object.keys(o)) o[a] = Object.fromEntries(Object.entries(o[a]).sort((x, y) => y[1][0] - x[1][0]).slice(0, 15));
      for (const p of Object.values(PL)) p.c = Object.entries(p.c).sort((a, b) => b[1] - a[1]).slice(0, 5);
      OUT[Y] = { summary: { games: gr.length, champs: C, bans, pairs: PR, players: PL, teams: TM }, detail: { gLP, iP, champs: CL, bans: B, pairs: PRL, mates: MT } };
      window._st = 'Y' + Y + ' g' + gr.length;
    }
    const buf = new Uint8Array(await new Response(new Blob([JSON.stringify(OUT)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
    sessionStorage.setItem('gzLP', btoa(s));
    window._st = 'done ' + s.length;
  } catch (e) { window._st = 'fail ' + e; }
})();
