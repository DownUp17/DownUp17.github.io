// Worlds 우승 배경 — 팀 페이지·선수 페이지 공용.
//   화면에 고정(스크롤해도 따라옴). 메뉴(sticky header) 바로 아래부터 하단 흰색 바(footer) 위까지 채우고,
//   화면보다 큰 이미지는 스크롤 진행도에 맞춰 보이는 영역을 이동(맨 위 = 이미지 상단, 맨 아래 = 이미지 하단).
import React, { useEffect, useState } from 'react';
import { CHAMPION_BG, CHAMPION_BG_CONTAIN } from '../utils/championBg';

export default function ChampionBackground({ bgKey, resetKey }) {
  const bg = bgKey && CHAMPION_BG[bgKey];
  // 고정 배경의 시작 위치 = 사이트 상단 메뉴 높이 — 메뉴에 가려 이미지 상단이 잘리지 않도록.
  const [headerH, setHeaderH] = useState(0);
  useEffect(() => {
    const measure = () => setHeaderH(document.querySelector('header')?.offsetHeight || 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const [scrollPct, setScrollPct] = useState(0);
  const [footerGap, setFooterGap] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      // 진행도 = 하단 흰색 바가 보이기 시작하는 지점까지(맨 위 0% → 바 등장 직전 100%).
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
    // 사진 등이 늦게 로드되어 페이지 높이·흰색 바 위치가 바뀌면 다시 계산.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onScroll) : null;
    ro?.observe(document.body);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); window.removeEventListener('load', onScroll); ro?.disconnect(); };
  }, [resetKey]);
  if (!bg) return null;
  return (
    <div aria-hidden className="fixed inset-x-0 overflow-hidden pointer-events-none" style={{ top: headerH, bottom: footerGap }}>
      <div className="absolute inset-0">
        {CHAMPION_BG_CONTAIN.has(bgKey) ? (
          <>
            <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'blur(24px)', transform: 'scale(1.1)' }} />
            {/* 메인 이미지 — (화면 - 메뉴) 높이로 고정, 흰색 바가 보이는 동안엔 바와 함께 위로 밀림. */}
            <img src={bg} alt="" className="absolute inset-x-0 block w-full object-contain" style={{ top: -footerGap, height: `calc(100vh - ${headerH}px)`, objectPosition: 'center top' }} />
          </>
        ) : (
          <img src={bg} alt="" className="absolute inset-x-0 block w-full object-cover" style={{ top: -footerGap, height: `calc(100vh - ${headerH}px)`, objectPosition: `center ${scrollPct}%` }} />
        )}
        <div className="absolute inset-0" style={{ background: 'rgba(10,20,40,0.7)' }} />
      </div>
    </div>
  );
}
