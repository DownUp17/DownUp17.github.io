// Worlds 우승 배경 이미지(우승 기념 스킨 일러스트) — 팀 페이지·선수 페이지 공용.
import t1Bg from '../assets/champion-bg/t1.webp';
import krxBg from '../assets/champion-bg/krx.webp';
import edgBg from '../assets/champion-bg/edg.webp';
import dkBg from '../assets/champion-bg/dk.webp';
import igBg from '../assets/champion-bg/ig.webp';
import genBg from '../assets/champion-bg/gen.webp';
import fncBg from '../assets/champion-bg/fnc.webp';
import fpx2019Bg from '../assets/champion-bg/fpx2019.webp';
// MVP T1 미스 포츈 월페이퍼(공식 공지 '영광스러운 3-PEAT의 순간을 간직하세요!')
import gumayusiBg from '../assets/champion-bg/gumayusi.webp';
// T1 스플래시 아트 월페이퍼(공식 공지 '불멸의 기사단을 영원히 간직하세요!', 2024 우승 스킨)
import zeusBg from '../assets/champion-bg/zeus.webp';

export const CHAMPION_BG = { T1: t1Bg, KRX: krxBg, EDG: edgBg, DK: dkBg, IG: igBg, GEN: genBg, FNC: fncBg,
  // 선수 페이지 전용(팀 약칭과 겹치지 않는 키 → 팀 페이지에는 적용되지 않음)
  FPX2019: fpx2019Bg, GUMAYUSI: gumayusiBg, ZEUS: zeusBg,
  UZI: `${import.meta.env.BASE_URL}champion-bg/uzi.mp4`, // 명예의 전당 2025 갤러리 영상(원본 4K → 1440p)
  // 영상 배경(.mp4) — public에 두어 번들에 넣지 않음
  CAPS: `${import.meta.env.BASE_URL}champion-bg/caps.mp4`,
  // 명예의 전당 사이트(halloflegends.leagueoflegends.com) 2024 갤러리 영상(불멸의 전설 아리, 원본 4K → 1440p)
  FAKER: `${import.meta.env.BASE_URL}champion-bg/faker.mp4` };
// 세로로 긴 이미지 — 그림 전체를 가운데에 표시하고 양옆은 같은 이미지를 흐리게 채운다.
export const CHAMPION_BG_CONTAIN = new Set(['IG']);

// 배경 이미지가 나타내는 우승 로스터의 선수(소문자 닉네임) → 배경 키. 이미지의 우승 연도 멤버만 적용.
//   T1 2025 / DRX(KRX) 2022 / EDG 2021 / DK(담원) 2020 / FPX 2019 / IG 2018 / 삼성(젠지) 2017 — 다른 연도 우승(예: 제우스 T1 2023·2024)은 해당 이미지 없음
export const PLAYER_WORLDS_TEAM = {
  faker: 'FAKER', oner: 'T1', gumayusi: 'GUMAYUSI', uzi: 'UZI', zeus: 'ZEUS', keria: 'T1', doran: 'T1',
  zeka: 'KRX', kingen: 'KRX', pyosik: 'KRX', deft: 'KRX', beryl: 'KRX',
  viper: 'EDG', scout: 'EDG', jiejie: 'EDG', meiko: 'EDG', flandre: 'EDG',
  showmaker: 'DK', canyon: 'DK', ghost: 'DK',
  rookie: 'IG', jackeylove: 'IG', theshy: 'IG', ning: 'IG', baolan: 'IG',
  tian: 'FPX2019', crisp: 'FPX2019', doinb: 'FPX2019', lwx: 'FPX2019', gimgoon: 'FPX2019', // FPX 2019
  caps: 'CAPS', // 우승 배경이 아닌 선수 전용 영상
  ruler: 'GEN', corejj: 'GEN', crown: 'GEN', cuvee: 'GEN', ambition: 'GEN',
};
