// client/src/components/LiveMatches.jsx
// 진행 중인 LoL 경기 — 백엔드(/api/lol/live, lolesports API 경유·20초 캐시)를 30초마다 조회.
// 진행 중 경기가 없으면 아무것도 표시하지 않는다.
import React, { useEffect, useState } from 'react';
import { API_BASE } from '../utils/apiBase';

const POLL_MS = 30 * 1000;

const TeamSide = ({ team, align, logo }) => (
  <div className={`flex items-center gap-2 min-w-0 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
    {(logo || team?.image) && <img src={logo || team.image} alt={team?.code} className="w-7 h-7 object-contain shrink-0" />}
    <span className="font-black text-white/90 truncate">{team?.code || '?'}</span>
  </div>
);

export default function LiveMatches({ logoOf }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    // 로컬 개발에서 ?livedemo 를 붙이면 백엔드 예시 데이터로 화면 확인(배포에선 동작 안 함)
    const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('livedemo');
    const load = () => fetch(`${API_BASE}/api/lol/live${demo ? '?demo=1' : ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setData(d); })
      .catch(() => { /* 일시 오류는 무시하고 다음 주기에 재시도 */ });
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const matches = data?.matches || [];
  if (!matches.length) return null;
  return (
    <section className="mb-8 flex flex-col gap-3">
      {matches.map((m) => {
        const [a, b] = m.teams;
        const g = m.game;
        // 카드 클릭 → lolesports 공식 라이브 페이지(리그별)에서 시청
        const watchUrl = m.league?.slug ? `https://lolesports.com/live/${m.league.slug}` : 'https://lolesports.com/live';
        return (
          <a key={m.id} href={watchUrl} target="_blank" rel="noopener noreferrer" title="라이브 시청"
            className="block rounded-xl bg-white/5 border border-red-500/30 p-4 hover:bg-white/10 hover:border-red-500/60 transition-colors">
            <div className="flex items-center gap-2 mb-3 text-xs">
              <span className="flex items-center gap-1.5 font-black text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />LIVE
              </span>
              <span className="text-white/50 font-bold">{m.league?.name}{m.blockName ? ` · ${m.blockName}` : ''}</span>
              {m.bestOf && <span className="text-white/30 ml-auto">Bo{m.bestOf}{g ? ` · ${g.number}세트` : ''}</span>}
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <TeamSide team={a} logo={logoOf?.(a?.code)} />
              <span className="font-black text-xl tabular-nums">{a?.wins ?? 0} : {b?.wins ?? 0}</span>
              <TeamSide team={b} logo={logoOf?.(b?.code)} align="right" />
            </div>
          </a>
        );
      })}
    </section>
  );
}
