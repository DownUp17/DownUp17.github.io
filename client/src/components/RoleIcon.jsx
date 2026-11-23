// 포지션(탑·정글·미드·원딜·서폿) 아이콘 — 글자 대신 표시. 흰색 SVG, title/alt로 한글 명칭 제공.
import React from 'react';
import topIcon from '../assets/roles/top.svg';
import jugIcon from '../assets/roles/jug.svg';
import midIcon from '../assets/roles/mid.svg';
import botIcon from '../assets/roles/bot.svg';
import sptIcon from '../assets/roles/spt.svg';

export const ROLE_KO = { top: '탑', jungle: '정글', mid: '미드', bottom: '원딜', support: '서폿' };
const ROLE_ICON = { top: topIcon, jungle: jugIcon, mid: midIcon, bottom: botIcon, support: sptIcon };

const RoleIcon = ({ role: raw, size = 16, className = '' }) => {
  // Leaguepedia 표기(Top/Bot/Support)도 받음
  const role = { bot: 'bottom' }[String(raw).toLowerCase()] || String(raw).toLowerCase();
  const src = ROLE_ICON[role];
  if (!src) return <>{ROLE_KO[role] ?? raw}</>;
  return (
    <img src={src} alt={ROLE_KO[role]} title={ROLE_KO[role]} width={size} height={size}
      className={`inline-block object-contain ${className}`} style={{ width: size, height: size }} />
  );
};

export default RoleIcon;
