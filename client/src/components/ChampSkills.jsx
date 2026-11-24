// 챔피언 스킬 아이콘(패시브·Q·W·E·R) — Riot Data Dragon에서 실시간으로 받음(최신 버전, 한글 이름).
//   Leaguepedia 챔피언 이름(예: "Kai'Sa", "Wukong") → Data Dragon id("Kaisa", "MonkeyKing")는 영어 목록의 name으로 찾음.
import React, { useEffect, useState } from 'react';

const DD = 'https://ddragon.leagueoflegends.com';
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// 스킬을 쓰고 그 스킬이 끝나기 전에 점멸이 가능한 스킬(점멸 후 위치에서 효과가 이어짐. 예: 아리 E 시전 모션 중 점멸) — 공식 데이터에 없어 수기 목록.
// shortcut: 사용자 검토 전 초안 — 사이온 Q·라칸 W·갈리오 E는 불가로 확인돼 제외, 틀리거나 빠진 항목은 여기서 고침
export const FLASH_SKILLS = {
  Ahri: ['E'], LeeSin: ['R'], Gragas: ['E'], Rell: ['W'], Sejuani: ['Q'], JarvanIV: ['Q'],
  Shen: ['E'], Vi: ['Q'], Riven: ['E'], Varus: ['Q'], Yasuo: ['Q'], Kennen: ['R'],
  Galio: [['W', 2019]], // [키, 마지막 가능 연도] — 9.14(2019.7) 패치에서 W 충전 중 점멸 삭제
};
const canFlash = (id, key, year) => (FLASH_SKILLS[id] || []).some((s) => (Array.isArray(s) ? s[0] === key && !(year > s[1]) : s === key));
let base; // 버전·이름→id 목록은 한 번만 받음
const loadBase = () => (base ??= (async () => {
  const ver = (await fetch(`${DD}/api/versions.json`).then((r) => r.json()))[0];
  const list = await fetch(`${DD}/cdn/${ver}/data/en_US/champion.json`).then((r) => r.json());
  const ids = {};
  for (const c of Object.values(list.data)) { ids[norm(c.name)] = c.id; ids[norm(c.id)] = c.id; }
  return { ver, ids };
})());

export default function ChampSkills({ name, year, size = 28 }) {
  const [sk, setSk] = useState(null);
  useEffect(() => {
    let alive = true; setSk(null);
    loadBase().then(async ({ ver, ids }) => {
      const id = ids[norm(name)] || ids[norm(name).replace('willump', '')]; // "Nunu & Willump" → Nunu
      if (!id) return;
      const c = (await fetch(`${DD}/cdn/${ver}/data/ko_KR/champion/${id}.json`).then((r) => r.json())).data[id];
      if (alive) setSk([
        { key: 'P', name: c.passive.name, src: `${DD}/cdn/${ver}/img/passive/${c.passive.image.full}` },
        ...c.spells.map((s, i) => ({ key: 'QWER'[i], name: s.name, src: `${DD}/cdn/${ver}/img/spell/${s.image.full}`, flash: canFlash(id, 'QWER'[i], +year) })),
      ].map((s) => ({ ...s, flashSrc: `${DD}/cdn/${ver}/img/spell/SummonerFlash.png` })));
    }).catch(() => {}); // 네트워크 실패 시 아이콘만 생략
    return () => { alive = false; };
  }, [name, year]);
  if (!sk) return null;
  return (
    <div className="flex items-end gap-1.5">
      {sk.map((s) => (
        <div key={s.key} className="flex flex-col items-center" title={`${s.key} · ${s.name}${s.flash ? ' (사용 중 점멸 가능)' : ''}`}>
          <img src={s.src} alt={`${s.key} ${s.name}`} width={size} height={size} className="rounded border border-white/15" style={{ width: size, height: size }} />
          <span className="mt-0.5 text-[9px] font-black text-white/40 leading-none">{s.key}</span>
          {/* 스킬 사용 중 점멸 가능 */}
          {s.flash ? <img src={s.flashSrc} alt="점멸 가능" title="스킬 사용 중 점멸 가능" className="mt-0.5 w-3 h-3 rounded-sm" /> : <span className="mt-0.5 h-3" />}
        </div>
      ))}
    </div>
  );
}
