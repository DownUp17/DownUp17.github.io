// client/src/pages/TeamPage.jsx
import React, { useEffect, useState } from 'react';
import RoleIcon from '../components/RoleIcon';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import rosters from '../data/lolRosters.json';
import gprTeamsData from '../data/gprTeams.json';
import gpr from '../data/lolGpr.json';
import teamTitles from '../data/lolTitles.json';
import { textOn } from '../utils/colorContrast';
import t1Bg from '../assets/champion-bg/t1.webp';
import krxBg from '../assets/champion-bg/krx.webp';
import edgBg from '../assets/champion-bg/edg.webp';
import dkBg from '../assets/champion-bg/dk.webp';
import igBg from '../assets/champion-bg/ig.webp';
import genBg from '../assets/champion-bg/gen.webp';
import fncBg from '../assets/champion-bg/fnc.webp';
import hleBg from '../assets/champion-bg/hle.webp';
import blgBg from '../assets/champion-bg/blg.webp';
import jdgBg from '../assets/champion-bg/jdg.webp';
import g2Bg from '../assets/champion-bg/g2.webp';

const gprTeamMap = Object.fromEntries(gprTeamsData.teams.map(t => [t.short, t]));
const leagueColorMap = Object.fromEntries(gpr.regions.map(r => [r.key, r.color]));

// 우승 배경 이미지(Worlds 우승 기념 스킨 일러스트) — 팀 상세 페이지 배경으로 사용, 가독성을 위해 어두운 오버레이를 덧씌운다.
const CHAMPION_BG = { T1: t1Bg, KRX: krxBg, EDG: edgBg, DK: dkBg, IG: igBg, GEN: genBg, FNC: fncBg, HLE: hleBg, BLG: blgBg, JDG: jdgBg, G2: g2Bg };
// 세로로 긴 이미지 — 그림 전체를 가운데에 표시하고 양옆은 같은 이미지를 흐리게 채운다.
const CHAMPION_BG_CONTAIN = new Set(['IG']);

const ROLE_ORDER = ['top', 'jungle', 'mid', 'bottom', 'support'];

const TeamPage = () => {
  const { teamShort } = useParams();
  const navigate = useNavigate();
  const team = gprTeamMap[teamShort];
  const roster = rosters.rosters[teamShort];
  const leagueColor = leagueColorMap[team?.league?.toLowerCase()] || '#888';
  // 상세 페이지 진입 시 항상 최상단부터 표시(이전 페이지의 스크롤 위치가 남지 않게).
  useEffect(() => { window.scrollTo(0, 0); }, [teamShort]);
  // 고정 배경의 시작 위치 = 사이트 상단 메뉴(sticky header) 높이 — 메뉴에 가려 이미지 상단이 잘리지 않도록.
  const [headerH, setHeaderH] = useState(0);
  useEffect(() => {
    const measure = () => setHeaderH(document.querySelector('header')?.offsetHeight || 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  // 화면보다 큰(잘리는) 배경 — 스크롤 진행도에 맞춰 보이는 영역 이동(맨 위 = 이미지 상단, 맨 아래 = 이미지 하단).
  const [scrollPct, setScrollPct] = useState(0);
  const [footerGap, setFooterGap] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      // 진행도 = 하단 흰색 바가 보이기 시작하는 지점까지(맨 위 0% → 바 등장 직전 100%).
      //   바가 보일 때는 항상 이미지 하단까지 보여, 바 쪽으로 이미지 하단이 숨지 않는다.
      const footer = document.querySelector('footer');
      const footerDocTop = footer ? footer.getBoundingClientRect().top + window.scrollY : document.documentElement.scrollHeight;
      const max = footerDocTop - window.innerHeight;
      setScrollPct(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 100);
      // 하단 흰색 바가 화면에 들어온 만큼 배경 영역을 줄임 — 이미지가 바 뒤로 들어가지 않게.
      const ft = footer?.getBoundingClientRect().top;
      setFooterGap(ft != null ? Math.max(0, window.innerHeight - ft) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', onScroll);
    // 새로고침 직후 선수 사진 등이 늦게 로드되어 페이지 높이·흰색 바 위치가 바뀌면 다시 계산.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onScroll) : null;
    ro?.observe(document.body);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); window.removeEventListener('load', onScroll); ro?.disconnect(); };
  }, [teamShort]);
  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-white/50 text-lg font-bold">팀을 찾을 수 없습니다</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-sm text-white/40 hover:text-white/70">← 돌아가기</button>
        </div>
      </div>
    );
  }

  // 주전(스타터)만, 역할 순서대로 한 명씩 — 가로 일렬 배치용.
  const starters = ROLE_ORDER
    .map((role) => (roster?.players ?? []).find((p) => p.role === role && p.starter !== false))
    .filter(Boolean);
  // 우승 경력 — API에 없어 수기 관리(lolTitles.json). 팀 약칭 → [{ name, detail }].
  const titles = teamTitles.titles?.[teamShort] || [];

  const teamBg = CHAMPION_BG[teamShort];
  return (
    <div className="relative overflow-hidden min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] p-6 md:p-12 text-white">
      {/* 팀 배경 — 화면에 고정(스크롤해도 따라옴). 메뉴 바로 아래부터 이미지 상단을 맞추고, 넘치면 하단을 자른다. */}
      {teamBg && (
        <div aria-hidden className="fixed inset-x-0 overflow-hidden pointer-events-none" style={{ top: headerH, bottom: footerGap }}>
          {/* 배경 영역 = 메뉴 아래 ~ 흰색 바 위. 이미지는 이 영역에 맞춰 채워 어느 바 뒤로도 들어가지 않는다. */}
          <div className="absolute inset-0">
          {CHAMPION_BG_CONTAIN.has(teamShort) ? (
            <>
              <img src={teamBg} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'blur(24px)', transform: 'scale(1.1)' }} />
              {/* 메인 이미지 — 크기는 (화면 - 메뉴) 높이로 고정(축소 없음). 평소엔 상단이 메뉴에 붙고,
                  흰색 바가 보이는 동안엔 바가 올라온 만큼 함께 위로 밀려 하단이 바 위에 보인다. */}
              <img src={teamBg} alt="" className="absolute inset-x-0 block w-full object-contain" style={{ top: -footerGap, height: `calc(100vh - ${headerH}px)`, objectPosition: 'center top' }} />
            </>
          ) : (
            // 크기 고정(축소 없음) — 바 등장 전엔 스크롤 진행도로 상→하 이동, 바가 보이는 동안엔 바와 함께 위로 밀림.
            <img src={teamBg} alt="" className="absolute inset-x-0 block w-full object-cover" style={{ top: -footerGap, height: `calc(100vh - ${headerH}px)`, objectPosition: `center ${scrollPct}%` }} />
          )}
          <div className="absolute inset-0" style={{ background: 'rgba(10,20,40,0.7)' }} />
          </div>
        </div>
      )}
      <div className="relative max-w-2xl mx-auto">

        {/* 뒤로가기 */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-white/40 hover:text-white/70 transition-colors text-sm font-bold mb-8"
        >
          <ChevronLeft size={16} />
          돌아가기
        </button>

        {/* 팀 헤더 */}
        <div className="flex items-center gap-5 mb-8 pb-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {team.logo && (
            <img src={team.logo} alt={team.short} className="w-20 h-20 object-contain shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl md:text-3xl font-black text-white">{team.name}</h1>
              <span
                className="text-sm font-black px-2.5 py-1 rounded-lg"
                style={{ backgroundColor: leagueColor, color: textOn(leagueColor) }}
              >
                {team.league}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-white/50">
              <span>GPR <span className="font-black text-white/80">{team.score}</span></span>
              {team.w != null && <span>{team.w}승 {team.l}패</span>}
            </div>
          </div>
        </div>

        {/* 주전 선수 — 역할 순서대로 가로 일렬 배치 */}
        {starters.length > 0 ? (
          <div>
            <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">주전 로스터</h2>
            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {starters.map(p => (
                <div
                  key={p.name}
                  className="flex flex-col items-center text-center p-2 sm:p-3 rounded-xl"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-full aspect-square max-w-[72px] rounded-xl overflow-hidden bg-white/5 mb-2">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-cover object-top"
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">?</div>
                    )}
                  </div>
                  <span className="font-black text-white text-sm sm:text-base leading-tight truncate max-w-full">{p.name}</span>
                  <span
                    className="mt-1.5 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-lg"
                    style={{ backgroundColor: leagueColor + '25', color: leagueColor }}
                  >
                    <RoleIcon role={p.role} size={16} className="align-middle" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-white/30 text-sm text-center py-16">선수 정보 없음</p>
        )}

        {/* 우승 경력 */}
        {titles.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xs font-black text-white/30 uppercase tracking-widest mb-3">우승 경력(2021-)</h2>
            <div className="flex flex-col gap-2">
              {titles.map((t, i) => {
                const fg = t.gradient ? '#fff' : (t.color ? textOn(t.color) : 'rgba(255,255,255,0.9)');
                const bg = t.gradient
                  ? { backgroundImage: t.gradient, backgroundOrigin: 'border-box', backgroundClip: 'border-box' }
                  : { backgroundColor: t.color || 'rgba(255,255,255,0.04)' };
                // 클릭 시 해당 대회로 이동 — link: { tab, year?, event?, sub? }
                const href = t.link ? (() => {
                  const q = new URLSearchParams();
                  if (t.link.year) q.set('year', t.link.year);
                  if (t.link.event) q.set('event', t.link.event);
                  if (t.link.sub) q.set('sub', t.link.sub);
                  const qs = q.toString();
                  return `/lol/prediction/${t.link.tab}${qs ? `?${qs}` : ''}`;
                })() : null;
                return (
                  <div
                    key={i}
                    role={href ? 'link' : undefined}
                    tabIndex={href ? 0 : undefined}
                    onClick={href ? () => { navigate(href); window.scrollTo(0, 0); } : undefined}
                    onKeyDown={href ? (e) => { if (e.key === 'Enter') { navigate(href); window.scrollTo(0, 0); } } : undefined}
                    className={`p-3 rounded-xl${href ? ' cursor-pointer transition-opacity hover:opacity-80' : ''}`}
                    style={{ ...bg, border: `1px solid ${t.gradient ? 'transparent' : 'rgba(255,255,255,0.12)'}` }}
                  >
                    <span className="font-bold text-sm" style={{ color: fg }}>{t.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-white/20 text-[11px] text-right mt-8">
          출처: lolesports.com · {rosters.updatedAt} 기준
        </p>
      </div>
    </div>
  );
};

export default TeamPage;
