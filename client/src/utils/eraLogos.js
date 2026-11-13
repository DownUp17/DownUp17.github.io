// LCK 구단의 연도별(그 당시) 로고 — 선수 페이지 역대 팀 표시용. 승부예측 페이지의 과거 연도 오버라이드와 같은 자산.
//   [구단 키, [[마지막 사용 연도, 로고], ...]] — 오름차순. 활동 마지막 시즌(to)이 마지막 사용 연도 이하인 첫 로고를 쓴다.
import sktT1Logo from '../assets/skt-t1.svg';
import t1_2023Logo from '../assets/t1-2023.svg';
import geng2022Logo from '../assets/geng-2022.svg';
import gengSimpleLogo from '../assets/geng-simple.svg';
import kingzoneDragonxLogo from '../assets/kingzone-dragonx.webp';
import drx2020Logo from '../assets/drx-2020.webp';
import drx2022Logo from '../assets/drx-2022.svg';
import drxLogo from '../assets/drx.svg';
import damwonGamingLogo from '../assets/damwon-gaming.webp';
import dwgKiaLogo from '../assets/dwg-kia.svg';
import ktRolster2021Logo from '../assets/kt-rolster-2021.svg';
import afreecaFreecs2020Logo from '../assets/afreeca-freecs-2020.svg';
import afreecaFreecs2021Logo from '../assets/afreeca-freecs-2021.svg';
import kwangdongFreecsLogo from '../assets/kwangdong-freecs.svg';
import dnFreecsLogo from '../assets/dn-freecs.svg';
import freditBrionLogo from '../assets/fredit-brion.svg';
import brionOk2024SpringLogo from '../assets/brion-ok-2024-spring.svg';
import brionOkLogo from '../assets/brion-ok.svg';
import sandboxGamingLogo from '../assets/sandbox-gaming.svg';
import liivSandboxLogo from '../assets/liiv-sandbox.svg';
import bnkFearxLogo from '../assets/bnk-fearx-2024.svg';
import teamDynamicsLogo from '../assets/team-dynamics.webp';

export const ERA_LOGOS = {
  T1: [[2019, sktT1Logo], [2023, t1_2023Logo]],
  GEN: [[2022, geng2022Logo], [2025, gengSimpleLogo]],
  DRX: [[2019, kingzoneDragonxLogo], [2020, drx2020Logo], [2022, drx2022Logo], [2025, drxLogo]],
  DK: [[2020, damwonGamingLogo], [2022, dwgKiaLogo]],
  KT: [[2020, ktRolster2021Logo]],
  DNS: [[2020, afreecaFreecs2020Logo], [2021, afreecaFreecs2021Logo], [2024, kwangdongFreecsLogo], [2025, dnFreecsLogo]],
  BRO: [[2022, freditBrionLogo], [2023, brionOk2024SpringLogo], [2025, brionOkLogo]],
  BFX: [[2020, sandboxGamingLogo], [2023, liivSandboxLogo], [2024, bnkFearxLogo]],
  NS: [[2020, teamDynamicsLogo]],
};
export const eraLogo = (org, year) => (ERA_LOGOS[org] || []).find(([until]) => year <= until)?.[1] || null;
