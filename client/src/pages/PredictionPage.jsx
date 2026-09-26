// client/src/pages/PredictionPage.jsx
import React, { useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Target, Trophy, ExternalLink, Crown, Hourglass, ChevronDown } from 'lucide-react';
import sim from '../data/lolSim.json';
import gpr from '../data/lolGpr.json';
import gprTeams from '../data/gprTeams.json';
import officialStandings from '../data/lolStandings.json';
import pastEditionsData from '../data/lolPastEditions.json';
import GprTable, { TeamLogo } from '../components/GprTable';
import TeamPanel from '../components/TeamPanel';
import { textOn, lighten } from '../utils/colorContrast';
import demaciaLogo from '../assets/demacia.svg';
import asiangamesLogo from '../assets/asiangames.svg';
import asiangames2026Logo from '../assets/asiangames2026.svg';
import kespa2026Logo from '../assets/kespa2026.webp';
import kespa2025Logo from '../assets/kespa2025.webp';
import ewcLogo from '../assets/ewc.svg';
import ltaNorthLogo from '../assets/lta-north.svg';
import ltaSulLogo from '../assets/lta-sul.svg';
import ltaLogo from '../assets/lta.svg';
import asiLogo from '../assets/asi.svg';
import demaciaCupLogo from '../assets/demacia-cup.webp';
import drxLogo from '../assets/drx.svg';
import gengSimpleLogo from '../assets/geng-simple.svg';
import dnFreecsLogo from '../assets/dn-freecs.svg';
import brionLogo from '../assets/brion.svg';
import brionOkLogo from '../assets/brion-ok.svg';
import fpxLogo from '../assets/fpx.svg';
import rngLogo from '../assets/rng.svg';
import rogueLogo from '../assets/rogue.svg';
import teamLiquidLogo from '../assets/team-liquid.svg';
import losRatonesLogo from '../assets/los-ratones.svg';
import karmineCorpBlueLogo from '../assets/karmine-corp-blue.webp';
import teamBdsLogo from '../assets/team-bds.svg';
import hundredThievesLogo from '../assets/100-thieves.svg';
import fluxo2025Logo from '../assets/fluxo-2025.svg';
import isurusLogo from '../assets/isurus.webp';
import psgTalonLogo from '../assets/psg-talon.svg';
import talonEsportsLogo from '../assets/talon-esports.svg';
import mvkeLogo from '../assets/mvke.webp';
import chiefsLogo from '../assets/chiefs.svg';
import qtdIgLogo from '../assets/qtd-ig.svg';
import infernoEsportsLogo from '../assets/inferno-esports.webp';
import savingOceLogo from '../assets/saving-oce.webp';
import agalEwcLogo from '../assets/agal-ewc.webp';
import mibrLosEwcLogo from '../assets/mibr-los-ewc.webp';
import frkLogo from '../assets/frk.webp';
import zsmLogo from '../assets/zsm.webp';
import bnkFearxLogo from '../assets/bnk-fearx-2024.svg';
import fearxLogo from '../assets/fearx.svg';
import kwangdongFreecsLogo from '../assets/kwangdong-freecs.svg';
import madLionsKoiLogo from '../assets/mad-lions-koi.svg';
import vcsLogo from '../assets/vcs.svg';
import pcsLogo from '../assets/pcs.webp';
import c9_2024Logo from '../assets/c9-2024.svg';
import nrgLogo from '../assets/nrg-2024.svg';
import imtLogo from '../assets/imt-2024.svg';
import nrg2024SpringLogo from '../assets/nrg-2024-spring.svg';
import frankEsportsLogo from '../assets/frank-esports.webp';
import taipeiJTeamLogo from '../assets/taipei-j-team.webp';
import westPointEsportsLogo from '../assets/west-point-esports.webp';
import ljlLogo from '../assets/ljl.webp';
import chineseTaipeiFlag from '../assets/chinese-taipei-flag.svg';
import lcoLogo from '../assets/lco.webp';
import hellPigsLogo from '../assets/hell-pigs.webp';
import beyondGamingLogo from '../assets/beyond-gaming.webp';
import v3EsportsLogo from '../assets/v3-esports.webp';
import axizCrestLogo from '../assets/axiz-crest.webp';
import burningCoreToyomaLogo from '../assets/burning-core-toyoma.webp';
import sengokuGaming2024Logo from '../assets/sengoku-gaming-2024.svg';
import shg2024SpringLogo from '../assets/shg-2024-spring.svg';
import anticEsportsLogo from '../assets/antic-esports.webp';
import direWolvesLogo from '../assets/dire-wolves.png';
import teamBlissLogo from '../assets/team-bliss.webp';
import ionGlobalEsportsLogo from '../assets/ion-global-esports.webp';
import furyGlobalLogo from '../assets/fury-esports.webp';
import mammothLogo from '../assets/mammoth.webp';
import kangaEsportsLogo from '../assets/kanga-esports.webp';
import teamSecretLogo from '../assets/team-secret.svg';
import teamWhalesLogo from '../assets/team-whales.svg';
import cerberusEsportsLogo from '../assets/cerberus-esports.webp';
import mgnBlueEsportsLogo from '../assets/mgn-blue-esports.webp';
import teamFlashLogo from '../assets/team-flash.webp';
import rainbowWarriorsLogo from '../assets/rainbow-warriors.webp';
import kabumEsportsLogo from '../assets/kabum-esports.webp';
import libertyLogo from '../assets/liberty.svg';
import fluxo2024Logo from '../assets/fluxo-2024.svg';
import intzLogo from '../assets/intz.webp';
import llaLogo from '../assets/lla.webp';
import movistarR7Logo from '../assets/movistar-r7.svg';
import infinityLogo from '../assets/infinity.webp';
import isurus2Logo from '../assets/isurus-2.webp';
import estralEsportsLogo from '../assets/estral-esports.svg';
import sixKarmaLogo from '../assets/six-karma.webp';
import allKnightsLogo from '../assets/all-knights.webp';
import rareAtomLogo from '../assets/rare-atom.webp';

const statusMeta = {
  finished: { label: '종료', color: '#34D399', bg: 'rgba(52,211,153,0.15)' },
  ongoing: { label: '진행중', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)' },
  upcoming: { label: '예정', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
};

// 본문 추후 제공 대회 (정보 미준비)
const CONTENT_TBD = new Set([]);
const isContentTbd = (key, sub) =>
  CONTENT_TBD.has(key) || (sub ? CONTENT_TBD.has(`${key}|${sub}`) : false);
// 완료된 과거 스플릿(정규/그룹 순위 + 대진 + 최종순위를 PastSplitView로 표시)
const PAST_SPLIT_SUBS = new Set([
  'lpl|Split 1', 'lpl|Split 2',
  'lec|Versus', 'lec|Spring',
  'lcs|Lock-In', 'lcs|Spring',
  'cblol|Copa', 'cblol|Split 1',
  'lcp|Split 1', 'lcp|Split 2',
]);

// 팀 short → 실제 전적(GPR 기준). gw/gl = 세트(게임) 승-패
const recordByShort = Object.fromEntries(
  gprTeams.teams.map((t) => [t.short, { w: t.w ?? 0, l: t.l ?? 0, gw: t.gw, gl: t.gl }])
);
// LCK 그룹 심볼 (레전드/라이즈) — 플레이-인/플레이오프 순위표 등수 앞에 표기
const GroupSymbol = ({ group, size = 16 }) => (
  group === 'Legend' ? (
    <svg width={size} height={size} viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M0 0v30h30L20 20H10V10zm20 0 10 10V0Z" fill="#f38a5c" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M0 0v10L10 0Zm20 0L10 10h10v10l10-10V0Zm0 20H10l10 10h10V20Zm-10 0V10L0 20v10h10z" fill="#76b6fc" />
    </svg>
  )
);

// 팀 short → 로고 / 풀네임
// GPR에 없는 팀(과거 참가팀 등)의 로고 보강 — 표시용. 클릭(팀 페이지)은 knownTeam(GPR 기준)으로 별도 판단.
const EXTRA_LOGOS = { FPX: fpxLogo, RNG: rngLogo, RGE: rogueLogo, LR: losRatonesLogo, KCB: karmineCorpBlueLogo, '100T': hundredThievesLogo, ISG: isurusLogo, PSG: psgTalonLogo, CHF: chiefsLogo, QTD: qtdIgLogo, IE: infernoEsportsLogo, SVO: savingOceLogo, FRK: frkLogo, ZSM: zsmLogo, RA: rareAtomLogo, NRG: nrgLogo, IMT: imtLogo, FAK: frankEsportsLogo, JT: taipeiJTeamLogo, WP: westPointEsportsLogo, HPS: hellPigsLogo, BYG: beyondGamingLogo, V3: v3EsportsLogo, AXC: axizCrestLogo, BCT: burningCoreToyomaLogo, DW: direWolvesLogo, TB: teamBlissLogo, ION: ionGlobalEsportsLogo, FRY: furyGlobalLogo, MEC: mammothLogo, KNG: kangaEsportsLogo, TS: teamSecretLogo, TW: teamWhalesLogo, CES: cerberusEsportsLogo, MBE: mgnBlueEsportsLogo, TF: teamFlashLogo, RW: rainbowWarriorsLogo, KBM: kabumEsportsLogo, LBR: libertyLogo, INTZ: intzLogo, R7: movistarR7Logo, INF: infinityLogo, EST: estralEsportsLogo, '6K': sixKarmaLogo, AK: allKnightsLogo };
const baseLogoByShort = Object.fromEntries(gprTeams.teams.map((t) => [t.short, t.logo]));
const logoByShort = { ...EXTRA_LOGOS, ...baseLogoByShort };
const EXTRA_NAMES = { FPX: 'FunPlus Phoenix', RNG: 'Royal Never Give Up', RGE: 'Rogue', LR: 'Los Ratones', KCB: 'Karmine Corp Blue', '100T': '100 Thieves', ISG: 'Isurus', PSG: 'PSG Talon', CHF: 'The Chiefs Esports Club', QTD: 'QT DIG∞', IE: 'Inferno Esports', SVO: 'Saving OCE', RA: 'Rare Atom', NRG: 'NRG Kia', IMT: 'Immortals Progressive', FAK: 'Frank Esports', JT: 'Taipei J Team', WP: 'West Point Esports', HPS: 'Hell Pigs', BYG: 'Beyond Gaming', V3: 'V3 Esports', AXC: 'AXIZ CREST', BCT: 'Burning Core Toyoma', DW: 'Dire Wolves', TB: 'Team Bliss', ION: 'ION Global Esports', FRY: 'FURY Global', MEC: 'MAMMOTH', KNG: 'Kanga Esports', TS: 'Team Secret', TW: 'Team Whales', CES: 'CERBERUS Esports', MBE: 'MGN Blue Esports', TF: 'Team Flash', RW: 'Rainbow Warriors', KBM: 'KaBuM! Esports', LBR: 'Liberty', INTZ: 'INTZ', R7: 'Movistar R7', INF: 'INFINITY', EST: 'Estral Esports', '6K': 'Six Karma', AK: 'All Knights' };
const nameByShort = { ...EXTRA_NAMES, ...Object.fromEntries(gprTeams.teams.map((t) => [t.short, t.name])) };
// 팀 페이지가 있는(=GPR에 존재하는) 팀만 클릭 가능. 과거 대회의 강등/해체 팀(LR·KCB 등)은 클릭 차단.
// 과거 팀 코드 → 현재 팀 연결(클릭 시 현재 팀 페이지로). 예: VCS의 Team Secret(TS)·Team Whales(TW) → TSW, MGN Blue Esports(MBE) → MVK.
const TEAM_LINK = { TS: 'TSW', TW: 'TSW', MBE: 'MVK', R7: 'LYON' }; // R7(Movistar R7) → 현재 LYON
const linkTeam = (short) => TEAM_LINK[short] || short;
const knownTeam = (short) => short != null && baseLogoByShort[linkTeam(short)] != null;
// AG 참가국 → ISO 3166-1 alpha-2 (flagcdn 국기 이미지용)
const AG_FLAG = { KOR: 'kr', TPE: 'tw', VIE: 'vn', JPN: 'jp', HKG: 'hk', SAU: 'sa', IND: 'in', UAE: 'ae', MYS: 'my' };
// 국가 대표(국기 로고) 팀 — KeSPA CUP 등에서 국가로 출전. flagcdn 국기 이미지를 로고로 사용.
//   TPE(중화 타이베이)는 flagcdn 대신 지정된 로고를 항상 사용.
const nationFlag = (code) => (code === 'TPE' ? chineseTaipeiFlag : (AG_FLAG[code] ? `https://flagcdn.com/48x36/${AG_FLAG[code]}.png` : null));

// 특정 대회(에디션)에서만 다른 팀명·태그·로고를 쓰던 팀 오버라이드.
//   2026 LCK CUP까지 KRX는 팀명·태그 모두 DRX였고, GEN은 예전 로고를 사용.
// EWC에서 AL(Anyone's Legend)은 AG.AL(AGAL) 소속으로 참가.
const EWC_TEAM_OVERRIDE = {
  AL: { tag: 'AGAL', name: 'AG.AL', logo: agalEwcLogo },
  LOS: { tag: 'ML', name: 'MIBR.LOS', logo: mibrLosEwcLogo },
};
const LCKCUP_TEAM_OVERRIDE = {
  KRX: { tag: 'DRX', name: 'DRX', logo: drxLogo },
  GEN: { logo: gengSimpleLogo },
  BRO: { name: 'BRION', logo: brionLogo },
};
// 2025 팀 표기(2026과 다른 부분): KRX→DRX, GEN 옛 로고, DNS→DN FREECS(DNF).
const TEAM_OVERRIDE_2025 = {
  KRX: { tag: 'DRX', name: 'DRX', logo: drxLogo },
  GEN: { logo: gengSimpleLogo },
  DNS: { tag: 'DNF', name: 'DN FREECS', logo: dnFreecsLogo },
  WBG: { name: 'Weibo Gaming TapTap' },
  BRO: { name: 'OKSavingsBank BRION', logo: brionOkLogo },
  TLAW: { tag: 'TL', name: 'Team Liquid', logo: teamLiquidLogo }, // 2025 시즌까지 Team Liquid(TL)
  IG: { name: 'Invictus Gaming' }, // Meituan 스폰서 표기는 2026 LPL Split 3부터 — 그 이전 연도는 Invictus Gaming
  SHFT: { tag: 'BDS', name: 'Team BDS', logo: teamBdsLogo }, // 2025 시즌까지 Team BDS(BDS)
};
// 2026 LPL Split 3부터 IG는 'Invictus Gaming Meituan'(nameByShort 기본값). Split 3 이전(Split 1·2)만 옛 표기로 되돌린다.
const LPL_PRE_MEITUAN_OVERRIDE = { IG: { name: 'Invictus Gaming' } };
// 팀 short → GPR 점수 (대진 확정·미진행 경기의 승부예측에 사용)
const gprScoreByShort = Object.fromEntries(gprTeams.teams.map((t) => [t.short, t.score]));

// Elo식 단판 승률 + Bo5 시리즈 승률 (scripts/simulateLol.mjs 와 동일 공식) — 대진표 미진행 경기 예측용
const ELO_SCALE = 400;
const bracketGameProb = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / ELO_SCALE));
const bracketBo5Prob = (pa) => { const q = 1 - pa; return pa * pa * pa * (1 + 3 * q + 6 * q * q); };
// 매치의 양 팀이 모두 확정(short 보유)이고 아직 결과가 안 나왔으면(점수·승패 표기 없음) 승부예측 %를 반환
const matchPrediction = (a, b) => {
  if (!a?.short || !b?.short) return null;
  const played = a.score != null || b.score != null || a.win || a.elim || a.msi || b.win || b.elim || b.msi;
  if (played) return null;
  const ra = gprScoreByShort[a.short], rb = gprScoreByShort[b.short];
  if (ra == null || rb == null) return null;
  const pA = Math.round(bracketBo5Prob(bracketGameProb(ra, rb)) * 100);
  return { pA, pB: 100 - pA };
};

// Road to MSI(선발전) 사다리식 대진표 — 실제 점수·진출/MSI 결과 표기
const MsiSlot = ({ s, predPct, onTeamClick, teamOverride }) => {
  // MSI(토너먼트) 진출 = 금색, 하위 라운드 승자 = 파랑, 탈락 = 빨강 배경
  const accent = s?.msi ? '#E8C77E' : s?.win ? '#60A5FA' : null;
  const bg = s?.msi ? 'rgba(232,199,126,0.16)' : s?.win ? 'rgba(96,165,250,0.14)' : s?.elim ? 'rgba(248,113,113,0.18)' : 'transparent';
  const label = s?.seed || s?.label || '';
  const ov = (s?.short && teamOverride?.[s.short]) || {};
  const tag = ov.tag || s?.short;
  const clickable = !!(s?.short && onTeamClick && knownTeam(s.short));
  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-2 min-h-[36px]${clickable ? ' cursor-pointer hover:brightness-125 transition-all' : ''}`}
      style={{ backgroundColor: bg }}
      onClick={clickable ? () => onTeamClick(s.short) : undefined}
    >
      {s?.short ? (
        <>
          {label && <span className="text-[10px] text-white/40 shrink-0 max-w-[80px] truncate">{label}</span>}
          <TeamLogo src={ov.logo || logoByShort[s.short]} size={16} />
          <span className="text-xs font-bold truncate" style={{ color: accent || 'rgba(255,255,255,0.88)' }}>{tag}</span>
        </>
      ) : (
        <span className="text-xs text-white/35 truncate">{label || '미정'}</span>
      )}
      {s?.score != null ? (
        <span className="ml-auto text-sm font-black font-mono shrink-0" style={{ color: accent || 'rgba(255,255,255,0.45)' }}>
          {s.score}
        </span>
      ) : predPct != null && (
        <span className="ml-auto text-xs font-black font-mono shrink-0 text-white/55">
          {predPct}%
        </span>
      )}
    </div>
  );
};
const SLOT_H = 54;
const LABEL_H = 20;
const GAP_ROW = 2;
const COL_W = 200;
const COL_GAP = 16;
const ACTUAL_SLOT_H = 39; // 실제 슬롯(팀 한 줄) 렌더 높이 — connY 슬롯 중심 계산 기준

// 그리드 y좌표 — 모든 row에 균일 간격(예전엔 row>=2에 여백을 더해 straddle되는 매치가
//   두 상위 매치 사이 중앙에서 어긋났음). 균일 간격이라야 상위 라운드가 정확히 중앙에 위치.
const gridSlotTop = (r) => LABEL_H + r * SLOT_H;

// 공통 대진표 배경색 범례. 대회별로 goldLabel만 다름 (우승/MSI 진출/진출 등).
const BracketLegend = ({ goldLabel = '우승/진출' }) => (
  <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-white/50">
    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(232,199,126,0.7)' }} /> {goldLabel}</span>
    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }} /> 라운드 승리</span>
    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(248,113,113,0.6)' }} /> 탈락</span>
  </div>
);

// DEMACIA 브래킷 — 컬럼당 여러 브래킷 그룹을 세로로 배치. MsiSlot 재사용으로 다른 대진표와 일관.
//   msiSet(진출/우승) = 금색, 매치 승자 = 파랑, elimSet = 빨강.
//   connectors: [srcMatchId, destMatchId, destSlot('a'|'b')] — 매치 카드 간 SVG 연결선.
const DemaciaBracket = ({ columns, teams, msiSet, elimSet, connectors, onTeamClick, teamOverride }) => {
  const teamMap = Object.fromEntries((teams || []).map((t) => [t.slot, t]));
  const resolveShort = (v) => (v && teamMap[v]?.short) || (v && !teamMap[v] ? v : null);
  const wrapRef = useRef(null);
  const [connPaths, setConnPaths] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const matchDisplayName = (m) => m.id === 'GF' ? 'Grand Final' : m.id;
  // flag: 명시적 슬롯 색('msi'|'win'|'elim'|'' = 색 없음). undefined면 전역 set·승자 여부로 폴백.
  const toSlot = (v, isWinner, score, flag) => {
    const short = resolveShort(v);
    const slot = short ? { short } : { label: 'TBD' };
    if (short) {
      if (flag !== undefined) { if (flag) slot[flag] = true; }
      else if (msiSet?.has(short)) slot.msi = true;
      else if (isWinner) slot.win = true;
      else if (elimSet?.has(short)) slot.elim = true;
    }
    if (score != null) slot.score = score;
    return slot;
  };
  const renderMatch = (m, showDate) => {
    const aShort = resolveShort(m.a), bShort = resolveShort(m.b);
    const aWin = m.winner && (m.winner === m.a || m.winner === aShort);
    const bWin = m.winner && (m.winner === m.b || m.winner === bShort);
    const dispName = m.name != null ? m.name : matchDisplayName(m); // '' 이면 헤더 숨김(스위스)
    return (
      <div key={m.id} className="flex flex-col">
        {(dispName || (showDate && m.day)) && (
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-0.5 mb-1 flex items-baseline gap-1.5">
          <span>{dispName}</span>
          {showDate && m.day && <span className="text-white/30 normal-case font-normal ml-auto">{m.day.replace(/^(\d+)-(\d+)$/, '$1/$2')}</span>}
        </span>
        )}
        <div data-card-id={m.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
          <MsiSlot s={toSlot(m.a, aWin, m.scoreA, m.aFlag)} onTeamClick={onTeamClick} teamOverride={teamOverride} />
          <div className="h-px bg-white/10" />
          <MsiSlot s={toSlot(m.b, bWin, m.scoreB, m.bFlag)} onTeamClick={onTeamClick} teamOverride={teamOverride} />
        </div>
      </div>
    );
  };
  useLayoutEffect(() => {
    if (!connectors?.length || !wrapRef.current) { setConnPaths([]); return; }
    const wrap = wrapRef.current;
    const wRect = wrap.getBoundingClientRect();
    setSvgSize({ w: wrap.scrollWidth, h: wrap.scrollHeight });
    const cardPos = (id) => {
      const el = wrap.querySelector(`[data-card-id="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const slots = el.children;
      const slotA = slots[0]?.getBoundingClientRect();
      const slotB = slots[2]?.getBoundingClientRect();
      return {
        right: r.right - wRect.left,
        left: r.left - wRect.left,
        cy: (r.top + r.bottom) / 2 - wRect.top,
        aCy: slotA ? (slotA.top + slotA.bottom) / 2 - wRect.top : null,
        bCy: slotB ? (slotB.top + slotB.bottom) / 2 - wRect.top : null,
      };
    };
    const paths = [];
    for (const [srcId, destId, destSlot] of connectors) {
      const src = cardPos(srcId), dest = cardPos(destId);
      if (!src || !dest) continue;
      const y2 = destSlot === 'a' ? dest.aCy : destSlot === 'b' ? dest.bCy : dest.cy;
      const midX = (src.right + dest.left) / 2;
      paths.push(`M ${src.right} ${src.cy} H ${midX} V ${y2} H ${dest.left}`);
    }
    setConnPaths(paths);
  }, [connectors, columns, teams, msiSet, elimSet]);
  // 라운드로빈 순위표 — 3팀이 각 2경기씩. 1위(2승)만 진출, 2·3위 탈락.
  const renderRRStandings = (matches) => {
    const parts = new Set();
    for (const m of matches) {
      const a = resolveShort(m.a); if (a) parts.add(a);
      const b = resolveShort(m.b); if (b) parts.add(b);
    }
    const list = Array.from(parts);
    const wins = Object.fromEntries(list.map((p) => [p, 0]));
    const losses = Object.fromEntries(list.map((p) => [p, 0]));
    for (const m of matches) {
      if (!m.winner) continue;
      const a = resolveShort(m.a), b = resolveShort(m.b);
      const winShort = m.winner === m.a || m.winner === a ? a : b;
      const loseShort = winShort === a ? b : a;
      if (winShort && wins[winShort] != null) wins[winShort]++;
      if (loseShort && losses[loseShort] != null) losses[loseShort]++;
    }
    const sorted = list.slice().sort((x, y) => wins[y] - wins[x] || losses[x] - losses[y]);
    const rows = sorted.length > 0 ? sorted.map((short) => ({ short, w: wins[short], l: losses[short] })) : [null, null, null];
    return (
      <div className="mt-1 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
        <div className="px-2.5 py-1.5 bg-white/10 text-[10px] font-black text-white/70 uppercase tracking-wider">순위표</div>
        {rows.map((r, i) => {
          const rank = i + 1;
          const played = r ? r.w + r.l : 0;
          const completed = r && played === 2;
          const bg = r && msiSet?.has(r.short) ? 'rgba(232,199,126,0.16)'
                    : rank === 1 && completed ? 'rgba(96,165,250,0.14)'
                    : rank > 1 && completed ? 'rgba(248,113,113,0.18)'
                    : 'transparent';
          const accent = r && msiSet?.has(r.short) ? '#E8C77E'
                        : rank === 1 && completed ? '#60A5FA'
                        : rank > 1 && completed ? '#F87171'
                        : null;
          return (
            <div key={i}
                 className={`flex items-center gap-1.5 px-2.5 py-1.5 min-h-[30px]${r ? ' cursor-pointer hover:brightness-125 transition-all' : ''}`}
                 style={{ backgroundColor: bg }}
                 onClick={r ? () => onTeamClick?.(r.short) : undefined}>
              <span className="text-[10px] text-white/50 w-3 font-bold shrink-0">{rank}</span>
              {r ? (
                <>
                  <TeamLogo src={logoByShort[r.short]} size={14} />
                  <span className="text-xs font-bold truncate flex-1" style={{ color: accent || 'rgba(255,255,255,0.88)' }}>{r.short}</span>
                  <span className="font-mono tabular-nums text-xs shrink-0" style={{ color: accent || 'rgba(255,255,255,0.55)' }}>{r.w}-{r.l}</span>
                </>
              ) : (
                <>
                  <span className="text-xs text-white/35 flex-1">TBD</span>
                  <span className="font-mono tabular-nums text-xs text-white/40 shrink-0">0-0</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  // 싱글 엘리미네이션 그리드: 카드 2행 span, 라운드가 진행될수록 시작 위치가 중앙으로 오도록 계산
  //   Round k, match i → gridStart = 2^k + i * 2^(k+1). 총 rows = 2 * (첫 라운드 매치 수).
  const SLOT_H_D = 46, ROW_GAP_D = 8;
  return (
    <div className="pb-1 msi-scroll" style={{ overflowX: 'auto' }}>
    <div ref={wrapRef} className="relative flex gap-4 items-stretch w-fit pb-3">
      {columns.map((col, ci) => (
        <div key={ci} className={`flex flex-col shrink-0 ${col.gridRows ? 'gap-2' : 'gap-4 justify-center'}`} style={{ width: 200 }}>
          {col.groups.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-2">
              <div className="text-[11px] text-white/50 font-black tracking-wider px-1 flex items-baseline gap-1.5">
                {[!g.showMatchDate ? g.day : null, g.format, g.label].filter(Boolean).map((part, i, arr) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-white/40">·</span>}
                    <span className={part === g.label ? 'text-white/70' : undefined}>{part}</span>
                  </React.Fragment>
                ))}
              </div>
              {col.gridRows ? (
                <div className="grid" style={{ gridTemplateRows: `repeat(${col.gridRows}, ${SLOT_H_D}px)`, rowGap: `${ROW_GAP_D}px` }}>
                  {g.matches.map((m) => (
                    <div key={m.id} style={{ gridRow: `${m.gridStart} / span 2` }}>
                      {renderMatch(m, g.showMatchDate)}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {g.matches.map((m) => renderMatch(m, g.showMatchDate))}
                  {g.showRRStandings && renderRRStandings(g.matches)}
                </>
              )}
            </div>
          ))}
        </div>
      ))}
      {connPaths.length > 0 && (
        <svg
          className="pointer-events-none absolute top-0 left-0"
          width={svgSize.w} height={svgSize.h}
          style={{ overflow: 'visible' }}
        >
          {connPaths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />
          ))}
        </svg>
      )}
    </div>
    </div>
  );
};

// 스위스 스테이지를 DCGI 그룹 스테이지 모양(기록별 컬럼·카드)으로 렌더.
//   bracketFromColumns 라운드(=컬럼)를 recordKey로 그룹핑해 DemaciaBracket에 넘긴다.
const SwissBracket = ({ swiss, onTeamClick, bo, teamOverride }) => {
  const winnerOf = (m) => (m.a?.win || m.a?.msi) ? m.a?.short : ((m.b?.win || m.b?.msi) ? m.b?.short : null);
  const msiSet = new Set(), elimSet = new Set();
  for (const r of swiss?.rounds || []) for (const m of r.matches || []) for (const s of [m.a, m.b]) {
    if (s?.short) { if (s.msi) msiSet.add(s.short); if (s.elim) elimSet.add(s.short); }
  }
  // 16팀 스위스(2023~ Worlds): 2승 매치 승자=진출(금색), 2패 매치 패자=탈락(빨강), 그 외 매치 승자=라운드 승리(파랑).
  const distinct = new Set();
  for (const r of swiss?.rounds || []) for (const m of r.matches || []) for (const s of [m.a, m.b]) if (s?.short) distinct.add(s.short);
  const is16 = distinct.size === 16;
  const CLINCH = 3; // 3승 진출 / 3패 탈락 → 직전(2승·2패) 매치가 진출/탈락 결정전
  // recordKey가 없으면(라운드별로만 구분된 스위스: LCS Lock-In 등) 진행 결과로 각 매치의 기록(m-n)을 계산.
  const teamWL = {}, recOf = {};
  for (const round of swiss?.rounds || []) {
    for (const m of round.matches || []) {
      const a = m.a?.short, b = m.b?.short;
      const r = (a && teamWL[a]) || (b && teamWL[b]) || { w: 0, l: 0 };
      recOf[m.id] = `${r.w}-${r.l}`;
    }
    for (const m of round.matches || []) {
      const a = m.a?.short, b = m.b?.short, w = winnerOf(m), l = (w === a ? b : a);
      if (w) { teamWL[w] = teamWL[w] || { w: 0, l: 0 }; teamWL[w].w++; }
      if (l && (l === a || l === b)) { teamWL[l] = teamWL[l] || { w: 0, l: 0 }; teamWL[l].l++; }
    }
  }
  // Bo 표기. bo 설정이 있으면 기록으로 판별, 없으면 매치의 게임 수(scoreA+scoreB)로 도출(1→Bo1,2~3→Bo3,4~5→Bo5).
  const boFor = (recordKey, sample) => {
    if (bo) { const [w, l] = (recordKey || '').split('-').map(Number); return (w === bo.clinchAt || l === bo.clinchAt) ? bo.clinch : bo.base; }
    const g = (sample?.a?.score || 0) + (sample?.b?.score || 0);
    return g <= 0 ? null : g <= 1 ? 1 : g <= 3 ? 3 : 5;
  };
  const columns = (swiss?.rounds || []).map((round) => {
    const byRec = {};
    for (const m of round.matches || []) { const k = m.recordKey || recOf[m.id] || m.title || ''; (byRec[k] = byRec[k] || []).push(m); }
    return {
      groups: Object.entries(byRec).map(([rec, ms]) => {
        const boN = boFor(rec, ms[0]);
        return {
          label: boN ? `${rec} · Bo${boN}` : rec, // "m-n" (+ Bo)
          matches: ms.map((m) => {
            const a = m.a?.short, b = m.b?.short, w = winnerOf(m);
            let aFlag, bFlag;
            if (is16) {
              const [W, L] = (m.recordKey || recOf[m.id] || '0-0').split('-').map(Number);
              const loser = w ? (w === a ? b : a) : null;
              aFlag = ''; bFlag = '';
              if (w) {
                if (W === CLINCH - 1) { if (w === a) aFlag = 'msi'; else bFlag = 'msi'; }            // 2승 매치 승자 = 진출
                else if (W < CLINCH - 1 && L < CLINCH - 1) { if (w === a) aFlag = 'win'; else bFlag = 'win'; } // 그 외 매치 승자 = 라운드 승리
              }
              if (loser && L === CLINCH - 1) { if (loser === a) aFlag = 'elim'; else bFlag = 'elim'; }  // 2패 매치 패자 = 탈락
            }
            return { id: m.id, name: '', a, b, winner: w, scoreA: m.a?.score, scoreB: m.b?.score, aFlag, bFlag };
          }),
        };
      }),
    };
  });
  return <DemaciaBracket columns={columns} teams={[]} msiSet={msiSet} elimSet={elimSet} onTeamClick={onTeamClick} teamOverride={teamOverride} />;
};

// 그룹 스테이지 완전 탈락 집합 계산.
//   M19-M20 패자 + M16-M18 라운드로빈 2·3위 (승수 < 2인 팀).
const computeGroupEliminated = (matches, teamMap) => {
  const out = new Set();
  const shortOf = (v) => (v && teamMap[v]?.short) || (v && !teamMap[v] ? v : null);
  const loserOf = (m) => {
    if (!m?.winner) return null;
    const a = shortOf(m.a), b = shortOf(m.b);
    return m.winner === m.a || m.winner === a ? b : a;
  };
  // M19-M20 패자
  for (const id of ['M19', 'M20']) {
    const m = matches.find((x) => x.id === id);
    const l = loserOf(m); if (l) out.add(l);
  }
  // M16-M18 라운드로빈: 각 팀 승수 카운트
  const rr = matches.filter((m) => ['M16', 'M17', 'M18'].includes(m.id) && m.winner);
  if (rr.length === 3) {
    const wins = {};
    for (const m of rr) {
      const w = m.winner === m.a || m.winner === shortOf(m.a) ? shortOf(m.a) : shortOf(m.b);
      if (w) wins[w] = (wins[w] || 0) + 1;
    }
    Object.entries(wins).forEach(([short, w]) => { if (w < 2) out.add(short); });
    // 0승 팀도 wins 객체에 없으니 매치 참가자 중 wins에 없는 팀 추가
    const players = new Set();
    for (const m of rr) { const a = shortOf(m.a), b = shortOf(m.b); if (a) players.add(a); if (b) players.add(b); }
    for (const p of players) if (!wins[p]) out.add(p);
  }
  return out;
};

// 녹아웃 완전 탈락 집합 = GF 이외 매치의 패자.
const computeKnockoutEliminated = (matches, teamMap) => {
  const out = new Set();
  const shortOf = (v) => (v && teamMap[v]?.short) || (v && !teamMap[v] ? v : null);
  for (const m of matches) {
    if (m.id === 'GF' || !m.winner) continue;
    const a = shortOf(m.a), b = shortOf(m.b);
    const loser = m.winner === m.a || m.winner === a ? b : a;
    if (loser) out.add(loser);
  }
  return out;
};

const MsiBracket = ({ rounds, totalRows, connectors: connData, cardPrefix = '', wrapScroll = true, onTeamClick, groupGap = false, teamOverride }) => {
  const useGrid = !!totalRows;
  const colH = useGrid ? gridSlotTop(totalRows - 1) + 2 * ACTUAL_SLOT_H + 2 : undefined;
  const totalW = rounds.length * COL_W + (rounds.length - 1) * COL_GAP;
  const wrapRef = useRef(null);
  const [connPaths, setConnPaths] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (!connData?.length || !wrapRef.current) {
      setConnPaths([]);
      return;
    }
    const wrap = wrapRef.current;
    const wRect = wrap.getBoundingClientRect();
    // 슬롯 높이가 카드마다 달라(팀 39px·라벨 32px) 수식으로는 중심이 어긋나므로
    // 그리드 모드에서도 실제 DOM 위치를 측정해 연결선을 그린다.
    setSvgSize({ w: useGrid ? totalW : wrap.scrollWidth, h: useGrid ? colH : wrap.scrollHeight });

    const slotCenterY = (el, slot) => {
      const first = el.firstElementChild;
      const hasTitleEl = first?.hasAttribute('data-title');
      const slotAEl = hasTitleEl ? first.nextElementSibling : first;
      const slotBEl = slotAEl?.nextElementSibling?.nextElementSibling;
      if (!slotAEl || !slotBEl) {
        const r = el.getBoundingClientRect();
        return (r.top + r.bottom) / 2 - wRect.top;
      }
      const rA = slotAEl.getBoundingClientRect();
      const rB = slotBEl.getBoundingClientRect();
      const aCy = (rA.top + rA.bottom) / 2 - wRect.top;
      const bCy = (rB.top + rB.bottom) / 2 - wRect.top;
      if (slot === 'a') return aCy;
      if (slot === 'b') return bCy;
      return (aCy + bCy) / 2;
    };

    const allCards = Array.from(wrap.querySelectorAll('[data-card]'));
    // 카드 사각형(관통 판정용) — 그리드 모드에서는 카드 위 라벨(제목/시간)도 함께 체크한다
    const cardRects = [];
    for (const el of allCards) {
      const id = el.getAttribute('data-card');
      const r = el.getBoundingClientRect();
      cardRects.push({ id, x1: r.left - wRect.left, x2: r.right - wRect.left, y1: r.top - wRect.top, y2: r.bottom - wRect.top });
      const label = el.previousElementSibling;
      if (label && label.tagName === 'SPAN') {
        const lr = label.getBoundingClientRect();
        cardRects.push({ id, x1: lr.left - wRect.left, x2: lr.right - wRect.left, y1: lr.top - wRect.top, y2: lr.bottom - wRect.top });
      }
    }
    // 직선 세그먼트가 카드 내부를 관통하는지 (양 끝 카드는 제외)
    const hits = (pts, exclude) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [p1, p2] = [pts[i], pts[i + 1]];
        for (const r of cardRects) {
          if (exclude.includes(r.id)) continue;
          const pad = 3, rx1 = r.x1 + pad, rx2 = r.x2 - pad, ry1 = r.y1 + pad, ry2 = r.y2 - pad;
          if (Math.abs(p1[1] - p2[1]) < 0.5) { const y = p1[1], xa = Math.min(p1[0], p2[0]), xb = Math.max(p1[0], p2[0]); if (y > ry1 && y < ry2 && xa < rx2 && xb > rx1) return true; }
          else { const x = p1[0], ya = Math.min(p1[1], p2[1]), yb = Math.max(p1[1], p2[1]); if (x > rx1 && x < rx2 && ya < ry2 && yb > ry1) return true; }
        }
      }
      return false;
    };
    const paths = connData.map(([fR, fM, fS, tR, tM, tS]) => {
      if (fR === tR) return null; // 같은 컬럼(라운드) 간 연결선은 그리지 않음
      const fromEl = wrap.querySelector(`[data-card="${fR}-${fM}"]`);
      const toEl = wrap.querySelector(`[data-card="${tR}-${tM}"]`);
      if (!fromEl || !toEl) return null;
      const fRect = fromEl.getBoundingClientRect();
      const tRect = toEl.getBoundingClientRect();
      const fx = fRect.right - wRect.left;
      const tx = tRect.left - wRect.left;
      const fy = slotCenterY(fromEl, fS);
      const ty = slotCenterY(toEl, tS);
      const flat = Math.abs(fy - ty) <= 2;
      if (flat) return `M ${fx} ${fy} L ${tx} ${ty}`;

      // 기본 경로(중간에서 한 번 꺾기). 카드를 관통하지 않으면 그대로 사용.
      const mx = (fx + tx) / 2;
      const exclude = [`${fR}-${fM}`, `${tR}-${tM}`];
      const simple = [[fx, fy], [mx, fy], [mx, ty], [tx, ty]];
      if (!hits(simple, exclude)) return `M ${fx} ${fy} L ${mx} ${fy} L ${mx} ${ty} L ${tx} ${ty}`;

      // 관통 시: 사이 카드들을 피해 위/아래 빈 공간으로 우회(세로 꺾임은 칸 사이 gap에서만).
      const loR = Math.min(fR, tR), hiR = Math.max(fR, tR);
      const between = cardRects.filter((r) => { const m = r.id.match(/^(\d+)-/); return m && +m[1] > loR && +m[1] < hiR; });
      if (between.length) {
        const minTop = Math.min(...between.map((r) => r.y1)), maxBottom = Math.max(...between.map((r) => r.y2));
        const above = minTop - 10, below = maxBottom + 10;
        const detourY = Math.abs(fy - above) + Math.abs(ty - above) <= Math.abs(fy - below) + Math.abs(ty - below) ? above : below;
        const gx1 = fx + COL_GAP / 2, gx2 = tx - COL_GAP / 2;
        return `M ${fx} ${fy} L ${gx1} ${fy} L ${gx1} ${detourY} L ${gx2} ${detourY} L ${gx2} ${ty} L ${tx} ${ty}`;
      }
      return `M ${fx} ${fy} L ${mx} ${fy} L ${mx} ${ty} L ${tx} ${ty}`;
    }).filter(Boolean);

    setConnPaths(paths);
  }, [useGrid, rounds, connData]);

  return (
    <div className={`pb-1${useGrid && wrapScroll ? ' msi-scroll' : ''}`} style={useGrid && wrapScroll ? { overflowX: 'auto', overflowY: 'hidden' } : {}}>
      <div ref={wrapRef} style={{
        position: 'relative',
        display: 'flex',
        gap: COL_GAP,
        ...(useGrid ? { width: totalW, height: colH } : {}),
      }}>
        {/* 연결선 (그리드·비그리드 모두 DOM 실측 기반) */}
        {connPaths.length > 0 && (
          <svg style={{
            position: 'absolute', top: 0, left: 0,
            width: svgSize.w, height: svgSize.h,
            pointerEvents: 'none', overflow: 'visible',
          }}>
            {connPaths.map((d, i) => (
              <path key={i} d={d}
                stroke="rgba(255,255,255,0.2)" strokeWidth={1.5}
                fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
        )}

        {rounds.map((r, ri) => (
          <div key={ri}
            style={useGrid
              ? { position: 'relative', width: COL_W, flexShrink: 0, height: colH }
              : { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: groupGap ? 0 : 20, flex: 1, minWidth: 0 }}>
            {!useGrid && r.title && (
              <p className="text-[11px] font-black text-white/40 uppercase tracking-wider" style={groupGap ? { marginBottom: 4 } : undefined}>{r.title}</p>
            )}
            {r.matches.map((m, mi) => {
              const pred = matchPrediction(m.a, m.b);
              if (!useGrid) {
                // groupGap(스위스): 같은 기록(recordKey)은 헤더로 한 번만 표기, 그 안 경기는 작은 간격으로 구분
                const isGroupStart = groupGap && (mi === 0 || (m.recordKey || '') !== (r.matches[mi - 1].recordKey || ''));
                const card = (
                  <div data-card={`${ri}-${mi}`} {...(cardPrefix && { 'data-xcard': `${cardPrefix}${ri}-${mi}` })}
                    style={groupGap ? { marginTop: isGroupStart ? 0 : 8 } : undefined}
                    className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                    {!groupGap && (m.title || m.time) && (
                      <div data-title="" className="px-2.5 py-1.5 bg-white/10 text-[11px] font-black text-white/70 flex items-center gap-2">
                        <span>{m.title}</span>
                        {m.time && <span className="ml-auto text-white/40 font-semibold">{m.time}</span>}
                      </div>
                    )}
                    <MsiSlot s={m.a} predPct={pred?.pA} onTeamClick={onTeamClick} teamOverride={teamOverride} />
                    <div className="h-px bg-white/10" />
                    <MsiSlot s={m.b} predPct={pred?.pB} onTeamClick={onTeamClick} teamOverride={teamOverride} />
                  </div>
                );
                if (groupGap) {
                  return (
                    <React.Fragment key={mi}>
                      {isGroupStart && m.title && (
                        <p className="text-[11px] font-black text-white/70 uppercase tracking-wider" style={{ marginTop: mi > 0 ? 22 : 0, marginBottom: 5 }}>{m.title}</p>
                      )}
                      {card}
                    </React.Fragment>
                  );
                }
                return <React.Fragment key={mi}>{card}</React.Fragment>;
              }
              const sr = m.startRow ?? 0;
              const cardTop = gridSlotTop(sr);
              const labelTop = cardTop - LABEL_H;
              return (
                <React.Fragment key={mi}>
                  {(m.title || m.time) && (
                    <span style={{
                      position: 'absolute', top: labelTop, left: 0, right: 0, height: LABEL_H,
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {m.title}
                      {m.time && <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.32)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>{m.time}</span>}
                    </span>
                  )}
                  <div
                    data-card={`${ri}-${mi}`}
                    {...(cardPrefix && { 'data-xcard': `${cardPrefix}${ri}-${mi}` })}
                    className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
                    style={{ position: 'absolute', top: cardTop, left: 0, right: 0 }}>
                    <MsiSlot s={m.a} predPct={pred?.pA} onTeamClick={onTeamClick} teamOverride={teamOverride} />
                    <div className="h-px bg-white/10" />
                    <MsiSlot s={m.b} predPct={pred?.pB} onTeamClick={onTeamClick} teamOverride={teamOverride} />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// 섹션 간 연결선을 그리는 브래킷 그룹 컨테이너
const BracketGroup = ({ sections, crossConnectors, onTeamClick, teamOverride }) => {
  const wrapRef = useRef(null);
  const [crossPaths, setCrossPaths] = useState([]);

  const slotY = (el, slot, wRect) => {
    if (!el) return null;
    const first = el.firstElementChild;
    const hasTitleEl = first?.hasAttribute('data-title');
    const slotAEl = hasTitleEl ? first.nextElementSibling : first;
    const slotBEl = slotAEl?.nextElementSibling?.nextElementSibling;
    if (!slotAEl || !slotBEl) {
      const r = el.getBoundingClientRect();
      return (r.top + r.bottom) / 2 - wRect.top;
    }
    const rA = slotAEl.getBoundingClientRect();
    const rB = slotBEl.getBoundingClientRect();
    const aCy = (rA.top + rA.bottom) / 2 - wRect.top;
    const bCy = (rB.top + rB.bottom) / 2 - wRect.top;
    if (slot === 'a') return aCy;
    if (slot === 'b') return bCy;
    return (aCy + bCy) / 2;
  };

  useLayoutEffect(() => {
    if (!crossConnectors?.length || !wrapRef.current) { setCrossPaths([]); return; }
    const wrap = wrapRef.current;
    const wRect = wrap.getBoundingClientRect();
    const paths = crossConnectors.map(([fSec, fR, fM, fSlot, tSec, tR, tM, tSlot]) => {
      const fromEl = wrap.querySelector(`[data-xcard="s${fSec}-${fR}-${fM}"]`);
      const toEl = wrap.querySelector(`[data-xcard="s${tSec}-${tR}-${tM}"]`);
      if (!fromEl || !toEl) return null;
      const fRect = fromEl.getBoundingClientRect();
      const tRect = toEl.getBoundingClientRect();
      const fx = fRect.right - wRect.left;
      const tx = tRect.left - wRect.left;
      const fy = slotY(fromEl, fSlot, wRect);
      const ty = slotY(toEl, tSlot, wRect);
      if (fy == null || ty == null) return null;
      const flat = Math.abs(fy - ty) <= 2;
      if (flat) return `M ${fx} ${fy} L ${tx} ${ty}`;

      // 두 라운드 사이에 다른 라운드(매치)를 건너뛰는 연결선은 그 매치 카드를 관통하지 않도록
      // 칸 사이 빈 공간(gap)에서만 꺾이고, 가로 이동은 건너뛰는 매치들을 모두 피하는 y에서 한다
      const loRound = Math.min(fR, tR);
      const hiRound = Math.max(fR, tR);
      if (hiRound - loRound > 1) {
        const skipped = Array.from(wrap.querySelectorAll('[data-xcard]')).filter((el) => {
          const m = el.getAttribute('data-xcard').match(/^s\d+-(\d+)-/);
          return m && +m[1] > loRound && +m[1] < hiRound;
        });
        if (skipped.length) {
          // 매치 카드 바로 위에 떠 있는 라운드/매치 제목 라벨도 함께 피해야 글자를 가리지 않는다
          const rects = skipped.flatMap((el) => {
            const r = [el.getBoundingClientRect()];
            const label = el.previousElementSibling;
            if (label && label.tagName === 'SPAN') r.push(label.getBoundingClientRect());
            return r;
          });
          const minTop = Math.min(...rects.map((r) => r.top)) - wRect.top;
          const maxBottom = Math.max(...rects.map((r) => r.bottom)) - wRect.top;
          const above = minTop - 10;
          const below = maxBottom + 10;
          const detourY = Math.abs(fy - above) + Math.abs(ty - above) <= Math.abs(fy - below) + Math.abs(ty - below)
            ? above
            : below;
          const gx1 = fx + COL_GAP / 2;
          const gx2 = tx - COL_GAP / 2;
          return `M ${fx} ${fy} L ${gx1} ${fy} L ${gx1} ${detourY} L ${gx2} ${detourY} L ${gx2} ${ty} L ${tx} ${ty}`;
        }
      }

      const mx = (fx + tx) / 2;
      return `M ${fx} ${fy} L ${mx} ${fy} L ${mx} ${ty} L ${tx} ${ty}`;
    }).filter(Boolean);
    setCrossPaths(paths);
  }, [sections, crossConnectors]);

  return (
    <div className="pb-1 msi-scroll" style={{ overflowX: 'auto' }}>
      <div ref={wrapRef} className="flex flex-col gap-8" style={{ position: 'relative', width: 'max-content' }}>
        {crossPaths.length > 0 && (
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
            {crossPaths.map((d, i) => (
              <path key={i} d={d} stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
        )}
        {sections.map((sec, si) => (
          <div key={si}>
            {sec.name && <p className="text-xs font-black text-white/55 mb-3 pb-2 border-b border-white/10">{sec.name}</p>}
            <MsiBracket rounds={sec.rounds} totalRows={sec.totalRows} connectors={sec.connectors} cardPrefix={`s${si}-`} wrapScroll={false} onTeamClick={onTeamClick} teamOverride={teamOverride} />
          </div>
        ))}
      </div>
    </div>
  );
};

// 현재 순위 표 (그룹 단위로 재사용) — 승률 대신 예측 확률(PI+/PO/Worlds/우승)을 표기
// cols 가 주어지면 그 컬럼만 표시(단계별 뷰), 없으면 데이터 유무로 자동 판단
const StandingsTable = ({ rows, color, hasDiff, cols, onTeamClick, teamOverride, elimSet }) => {
  const minimal = !!cols?.minimal; // 최종 순위 등: 순위 + 팀 로고/이름만 (승-패·득실차·확률 숨김)
  const showDiff = minimal ? false : (cols ? !!cols.diff : hasDiff);
  const hasPiPlus = minimal ? false : (cols ? !!cols.piPlus : rows.some((r) => r.prob?.piPlus != null));
  const hasAdvance = minimal ? false : (cols ? !!cols.advance : rows.some((r) => r.prob));
  const hasChamp = minimal ? false : (cols ? !!cols.champ : rows.some((r) => r.prob));
  const hasWorlds = minimal ? false : (cols ? !!cols.worlds : rows.some((r) => r.prob?.worlds != null));
  // 확률 셀 (소수 2자리) — 값 + 막대 바
  const prob = (v, c, strong) => (
    <td className="py-2 px-2">
      <div className="flex items-center gap-2 justify-end">
        <div className="hidden sm:block w-14 h-1.5 rounded-full bg-white/5 overflow-hidden shrink-0">
          {v != null && (
            <div className="h-full rounded-full" style={{ width: `${Math.min(v, 100)}%`, backgroundColor: c }} />
          )}
        </div>
        <span className="font-mono tabular-nums w-16 text-right whitespace-nowrap"
          style={{ color: v != null ? c : '#6B7280', fontWeight: strong ? 800 : 500 }}>
          {v != null ? `${v.toFixed(2)}%` : '-'}
        </span>
      </div>
    </td>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-white/40 text-xs border-b border-white/10">
            <th className="text-center font-bold py-2 px-2 w-10">#</th>
            <th className="text-left font-bold py-2 pr-2">팀</th>
            {!minimal && <th className="text-center font-bold py-2 px-2">승-패</th>}
            {showDiff && <th className="text-center font-bold py-2 px-2">득실차</th>}
            {hasPiPlus && <th className="text-right font-bold py-2 px-2">{cols?.labels?.piPlus || 'PI+ 진출'}</th>}
            {hasAdvance && <th className="text-right font-bold py-2 px-2">{cols?.labels?.advance || 'PO 진출'}</th>}
            {hasWorlds && <th className="text-right font-bold py-2 px-2">Worlds 진출</th>}
            {hasChamp && <th className="text-right font-bold py-2 px-2">우승</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, ri) => {
            const pending = !t.short && t.pendingLabel; // 미확정 슬롯(예: 플레이-인 승자)
            const clickable = !pending && !!onTeamClick && knownTeam(t.short); // GPR에 없는 팀은 클릭 차단
            const elim = !!(t.short && elimSet?.has(t.short)); // 탈락 팀 회색 처리
            return (
              <tr
                key={t.short || `pending-${ri}`}
                className={`border-b border-white/5 transition-colors ${pending ? 'opacity-60' : clickable ? 'cursor-pointer hover:bg-white/5' : ''}`}
                onClick={() => clickable && onTeamClick(t.short)}
              >
                <td className="py-2 px-2 text-white/40 font-mono">
                  {t.seedGroup ? (
                    <span className="flex items-center justify-center gap-1">
                      <GroupSymbol group={t.seedGroup} />
                      {t.rank}
                    </span>
                  ) : (
                    <span className="block text-center">{t.rank}</span>
                  )}
                </td>
                <td className="py-2 pr-2">
                  {pending ? (
                    <span className="text-white/50 italic">{t.pendingLabel} (미정)</span>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <div style={elim ? { filter: 'grayscale(1)', opacity: 0.4 } : undefined} className="shrink-0">
                        <TeamLogo src={teamOverride?.[t.short]?.logo || logoByShort[t.short]} />
                      </div>
                      <span className={`font-bold truncate ${elim ? 'text-white/35' : 'text-white/90'}`}>{teamOverride?.[t.short]?.name || nameByShort[t.short] || t.short}</span>
                    </div>
                  )}
                </td>
                {!minimal && <td className={`py-2 px-2 text-center font-mono ${elim ? 'text-white/30' : 'text-white/70'}`}>{t.games ? `${t.w}-${t.l}` : '-'}</td>}
                {showDiff && (
                  <td className="py-2 px-2 text-center font-mono"
                    style={{ color: elim ? 'rgba(255,255,255,0.3)' : (t.gd > 0 ? '#34D399' : t.gd < 0 ? '#F87171' : '#9CA3AF') }}>
                    {t.gd != null ? `${t.gd > 0 ? '+' : ''}${t.gd}` : '-'}
                  </td>
                )}
                {hasPiPlus && prob(t.prob?.piPlus, '#9CA3AF')}
                {hasAdvance && prob(t.prob?.advance, lighten(color))}
                {hasWorlds && prob(t.prob?.worlds, '#60A5FA')}
                {hasChamp && prob(t.prob?.champ, '#E8C77E', true)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// 갱신 시각을 KST(시:분까지)로 표시. 날짜만 들어와도 그대로 출력
const fmtUpdated = (v) => {
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }) + ' KST';
};

// 단계별 뷰 설정 (LCK→LCK 에서 정규시즌/플레이-인/플레이오프 선택 시)
const STAGE_CFG = {
  '정규시즌': { cols: { diff: true, piPlus: true, advance: true, worlds: true, champ: true }, matches: false, heading: '정규시즌 순위', desc: '현재 순위 + 예상 진출·우승 확률.' },
  '플레이-인': { cols: { piPlus: true, advance: true }, matches: false, heading: '플레이-인 예측', desc: '레전드 5위 + 라이즈 1~3위 · 승자 2팀 플레이오프 진출 · 전 경기 Bo5' },
  '플레이오프': { cols: { advance: true, worlds: true, champ: true }, matches: false, heading: '플레이오프 예측', desc: '레전드 1~4위 + 플레이-인 통과 2팀 · 전 경기 Bo5' },
  '최종 순위': { cols: { diff: true }, matches: false, heading: '최종 순위', desc: '플레이오프 종료 후 확정' },
  '럼블 스테이지': { cols: { diff: true, piPlus: true, advance: true, worlds: true, champ: true, labels: { piPlus: '기사의 길+ 진출', advance: '플레이오프 진출' } }, matches: false, heading: '럼블 스테이지 순위', desc: '조별 Bo3 더블 라운드로빈 + 기사의 길+(기사의 길 또는 플레이오프 직행)/플레이오프/Worlds/우승 확률.' },
};

// LCP Split 3 단계별 설정 — 스위스 → 플레이-인 → 플레이오프
const LCP_STAGE_CFG = {
  '스위스 스테이지': {
    pred: true,
    cols: { advance: true, worlds: true, champ: true, labels: { advance: '플레이오프' } },
    heading: '스위스 스테이지 예측',
    desc: '3승 진출·3패 탈락. 플레이오프/Worlds/우승 확률(시뮬레이션).',
    bracketKey: 'swiss', bracketTitle: '스위스 대진 (라운드별)',
  },
  '플레이-인 스테이지': { bracketKey: 'playin', bracketTitle: '플레이-인 대진' },
  '플레이오프': { bracketKey: 'playoffs', bracketTitle: '플레이오프 대진' },
};

// LPL Split 3 단계별 대진 (API 자동 갱신) — 기사의 길(Knights Rivals) / 플레이오프
const LPL_STAGE_CFG = {
  '기사의 길': { bracketKey: 'knights', bracketTitle: '기사의 길 대진' },
  '플레이오프': { bracketKey: 'playoffs', bracketTitle: '플레이오프 대진' },
};

// 진행 중 지역 리그 스플릿(LEC 서머·LCS 서머·CBLOL 스플릿2) — 정규시즌 종료 + 플레이오프 라이브 갱신
const LIVE_SPLIT_SUBS = new Set(['lec|Summer', 'lcs|Summer', 'cblol|Split 2']);
// 단계별 설정 — 정규시즌(순위·우승 확률) / 플레이오프(6팀 더블 엘리 대진, 라이브 갱신)
const LEC_STAGE_CFG = {
  '정규시즌': {
    pred: true,
    cols: { advance: true, champ: true, labels: { advance: '플레이오프 진출' } },
    heading: '정규시즌 순위',
    desc: '싱글 라운드로빈 Bo3 · 상위 6팀 플레이오프 진출 · 우승 확률(시뮬레이션)',
  },
  '플레이오프': { bracketKey: 'playoffs', bracketTitle: '플레이오프 대진' },
};

// LCK 플레이-인 대진표: 정규시즌 순위 기반 예상 팀을 1·2라운드 시드 슬롯에 채우고,
//   1·2라운드 결과(승패)가 나오면 파이널 라운드(1라운드 패자 vs 2라운드 승자)를 자동으로 채운다.
//   (플레이오프는 그대로 반환)
const buildLckBracket = (raw, stage, current) => {
  if (!raw) return raw;
  const legend = current.filter((t) => /레전드|Legend/.test(t.group || ''));
  const rise = current.filter((t) => /라이즈|Rise/.test(t.group || ''));
  const seedTeam = {
    '레전드 1위': legend[0], '레전드 2위': legend[1], '레전드 3위': legend[2], '레전드 4위': legend[3], '레전드 5위': legend[4],
    '라이즈 1위': rise[0], '라이즈 2위': rise[1], '라이즈 3위': rise[2],
  };
  const fill = (s) => {
    if (!s) return s;
    const c = { ...s };
    if (!c.short && seedTeam[c.seed]) c.short = seedTeam[c.seed].short;
    return c;
  };
  const rounds = raw.rounds.map((r) => ({ ...r, matches: r.matches.map((m) => ({ ...m, a: fill(m.a), b: fill(m.b) })) }));
  const outcome = (m) => {
    if (!m) return {};
    const aWin = m.a?.win || m.a?.msi, bWin = m.b?.win || m.b?.msi;
    if (aWin || bWin) return { winner: aWin ? m.a : m.b, loser: aWin ? m.b : m.a };
    if (m.a?.score != null && m.b?.score != null && m.a.score !== m.b.score) {
      const aBig = m.a.score > m.b.score;
      return { winner: aBig ? m.a : m.b, loser: aBig ? m.b : m.a };
    }
    return {};
  };
  // 플레이-인 파이널 자동 채움 — 1·2라운드 결과가 있을 때만
  if (stage === '플레이-인') {
    const fin = rounds[2]?.matches?.[0];
    if (fin) {
      const loser = outcome(rounds[0]?.matches?.[0]).loser;
      const winner = outcome(rounds[1]?.matches?.[0]).winner;
      if (fin.a && !fin.a.short && loser?.short) fin.a = { ...fin.a, short: loser.short };
      if (fin.b && !fin.b.short && winner?.short) fin.b = { ...fin.b, short: winner.short };
    }
  }
  // 플레이오프 후처리: UB R2 두 패자 → 시드 기반 LB R2 slot a(하위 시드) / LB R3 slot a(상위 시드) 자동 채움.
  //   한 매치만 완료됐어도 그 패자의 시드가 상대 매치 참가자들과 명확히 순위 결정되면 확정.
  //   자동 배치된 팀의 elim 플래그는 제거(다음 라운드 진출).
  if (stage === '플레이오프') {
    // 시드 번호 매핑: legend 1-4 → 1-4, 플레이-인 5=P1, 6=P2. 여기선 상대 비교용 순서만 필요하니
    // 팀별 시드 번호를 slot의 seed 라벨에서 역산. UB R1/UB R2 slot a는 항상 레전드 시드.
    // 각 매치별 slot을 훑어서 팀별 시드 번호 유추. 플레이-인 통과 팀은 5·6로 폴백.
    const seedNumByShort = {};
    for (const r of rounds) for (const m of r.matches) for (const s of [m.a, m.b]) {
      if (!s?.short) continue;
      const mLeg = /^레전드\s(\d+)위$/.exec(s.seed || '');
      if (mLeg) seedNumByShort[s.short] = parseInt(mLeg[1], 10);
    }
    // 플레이-인 진출 2팀에 5·6 부여 (UB R1의 b슬롯 = 플레이-인 진출)
    const pins = [];
    for (const m of rounds[0]?.matches || []) {
      const t = m.b?.short; if (t && !(t in seedNumByShort)) pins.push(t);
    }
    pins.forEach((t, i) => { seedNumByShort[t] = 5 + i; });
    const ub2m1 = rounds[1]?.matches?.[0], ub2m2 = rounds[1]?.matches?.[1];
    const l1 = outcome(ub2m1).loser?.short, l2 = outcome(ub2m2).loser?.short;
    const lbR2 = rounds[1]?.matches?.[2]; // LB R2
    const lbR3 = rounds[2]?.matches?.[1]; // LB R3 (r2m0=UB R3, r2m1=LB R3, r3m0=Lower Finals)
    let lowerShort = null, higherShort = null;
    if (l1 && l2) {
      const s1 = seedNumByShort[l1] ?? 99, s2 = seedNumByShort[l2] ?? 99;
      lowerShort = s1 > s2 ? l1 : l2;
      higherShort = s1 > s2 ? l2 : l1;
    } else if (l1 || l2) {
      // 한쪽만 완료 — 상대 매치 참가자들의 시드와 비교해 하위/상위 확정 가능하면 배치
      const done = l1 || l2;
      const other = l1 ? ub2m2 : ub2m1;
      const others = [other?.a?.short, other?.b?.short].filter(Boolean).map((s) => seedNumByShort[s] ?? 99);
      const doneSeed = seedNumByShort[done] ?? 99;
      if (others.length > 0 && doneSeed > Math.max(...others)) lowerShort = done;
      else if (others.length > 0 && doneSeed < Math.min(...others)) higherShort = done;
    }
    // UB R2 매치의 elim만 제거 (bracketFromColumns 오탐).
    //   실제 LB 스테이지 패배 elim은 유지해야 함 (예: KT가 LB R2에서 지면 진짜 탈락).
    const clearUB2Elim = (short) => {
      if (!short) return;
      for (const m of [ub2m1, ub2m2]) {
        if (!m) continue;
        for (const s of [m.a, m.b]) if (s?.short === short) delete s.elim;
      }
    };
    if (lbR2?.a && !lbR2.a.short && lowerShort) { lbR2.a = { ...lbR2.a, short: lowerShort }; }
    if (lbR3?.a && !lbR3.a.short && higherShort) { lbR3.a = { ...lbR3.a, short: higherShort }; }
    // UB R2 패자는 LB로 진출하므로 UB R2 매치의 elim만 제거. LB 매치의 elim은 유지.
    if (l1) clearUB2Elim(l1);
    if (l2) clearUB2Elim(l2);
  }
  return { ...raw, rounds };
};

// 시뮬레이션 결과(예측) 렌더
const SimulationView = ({ comp, sub, stage, finished: finishedProp, onTeamClick }) => {
  const subFinished = finishedProp ?? (comp.status === 'finished');
  const lcpSplit3 = comp.key === 'lcp' && sub === 'Split 3';
  const lcpCfg = lcpSplit3 ? LCP_STAGE_CFG[stage] : null;
  const isLecSummer = LIVE_SPLIT_SUBS.has(`${comp.key}|${sub}`);
  const lecCfg = isLecSummer ? LEC_STAGE_CFG[stage] : null;
  const cfg = lcpSplit3 ? lcpCfg : isLecSummer ? lecCfg : (stage ? STAGE_CFG[stage] : null);
  // 현재 순위 — 해당 세부대회 공식 순위표가 있으면 우선, 없으면 GPR 전적으로 산출
  const leagueStd = officialStandings.standings[comp.key];
  // 서브탭이 있는 대회는 leagueStd[sub], 서브탭 없는 대회(예: DEMACIA)는 leagueStd 자체를 official로 사용
  // MSI는 서브탭 대신 스테이지 탭(플레이-인/브래킷)을 쓰므로 stage로 해당 스테이지 객체를 선택.
  const official = leagueStd
    ? (sub ? leagueStd[sub] : (comp.key === 'msi' && stage ? leagueStd[stage] : leagueStd))
    : null;
  const setDiff = (gw, gl) => (gw != null && gl != null ? gw - gl : null);
  const current = official?.rows?.length
    ? official.rows.map((r) => {
        const g = r.w + r.l;
        return { short: r.team, w: r.w, l: r.l, group: r.group, rank: r.rank, games: g, winRate: g ? r.w / g : 0, gd: setDiff(r.gw, r.gl) };
      })
    : (comp.teams || [])
        .map((t) => {
          const { w, l, gw, gl } = recordByShort[t.short] || { w: 0, l: 0 };
          const g = w + l;
          return { ...t, w, l, games: g, winRate: g ? w / g : 0, gd: setDiff(gw, gl) };
        })
        // LCP Split 3(미개막)는 전적 대신 시뮬 예측(플레이오프 확률) 순으로 정렬
        .sort((a, b) => {
          if (lcpSplit3) {
            const pa = comp.split3?.find((s) => s.team === a.short) || {};
            const pb = comp.split3?.find((s) => s.team === b.short) || {};
            return (pb.advance ?? -1) - (pa.advance ?? -1) || (pb.champ ?? 0) - (pa.champ ?? 0) || b.rating - a.rating;
          }
          return b.winRate - a.winRate || b.w - a.w || (b.gd ?? -99) - (a.gd ?? -99) || b.rating - a.rating;
        });
  const hasDiff = current.some((t) => t.gd != null);
  // Road to MSI(MSI 선발전): 정규 2R 기준 진출 6팀 명단만 표기, 시즌 예측 확률 컬럼은 생략
  const roadToMsi = comp.key === 'lck' && sub === 'Road to MSI';
  const lplSplit3 = comp.key === 'lpl' && sub === 'Split 3';
  const lplCfg = lplSplit3 && stage ? LPL_STAGE_CFG[stage] : null;
  const lplQualifier = comp.key === 'lpl' && sub === '대표 선발전';
  // 자체 대진표(토너먼트 포맷)가 있는 세부대회는 시즌 예측 확률 컬럼을 표기하지 않음 (LPL/LCP Split 3는 전용 확률을 표기하므로 예외)
  const noPredict = roadToMsi || (comp.key === 'lck' && sub === 'LCK CUP') || (comp.key === 'lck' && sub === 'LCK' && subFinished) || (!!official?.bracket && !lplSplit3);
  // 팀 약칭 → 시뮬 예측 확률 (현재 순위표에 합쳐 표기) — LPL·LCP Split 3는 전용 시뮬 결과(comp.split3) 사용
  const probByShort = (lplSplit3 || lcpSplit3)
    ? Object.fromEntries((comp.split3 || []).map((s) => [s.team, s]))
    : Object.fromEntries((comp.standings || []).map((s) => [s.team, s]));
  // 브래킷 스테이지 여부 + 대진표에서 탈락(elim) 확정된 팀 집합 (참가팀 목록 회색 처리용)
  const isBracketStage = sub === '브래킷 스테이지';
  const eliminatedSet = useMemo(() => {
    const set = new Set();
    const secs = official?.bracket?.sections;
    const collect = (rounds) => {
      for (const r of rounds || [])
        for (const m of r.matches || [])
          for (const slot of [m.a, m.b])
            if (slot?.elim && slot?.short) set.add(slot.short);
    };
    if (secs) secs.forEach((sec) => collect(sec.rounds));
    else collect(official?.bracket?.rounds);
    return set;
  }, [official]);
  // 그룹이 있으면 그룹별로 분리하고 각 그룹 내 1위부터 재번호
  const grouped = !!official && current.some((t) => t.group);
  const withProb = (t, rank) => ({ ...t, rank, prob: probByShort[t.short] });
  // 그룹명 → 표시 라벨·배지. 알려진 LCK 그룹은 고정색, 그 외(LPL 그룹 스테이지 등)는 기본 팔레트 순환.
  const GROUP_META = {
    Legend: { label: '레전드 그룹', badge: { color: '#E8C77E', bg: 'rgba(200,150,62,0.2)' } },
    '레전드 그룹': { label: '레전드 그룹', badge: { color: '#E8C77E', bg: 'rgba(200,150,62,0.2)' } },
    Rise: { label: '라이즈 그룹', badge: { color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' } },
    '라이즈 그룹': { label: '라이즈 그룹', badge: { color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' } },
  };
  // 그룹 표시 순서 — 레전드 그룹을 먼저 (라이즈보다 위)
  const GROUP_ORDER = ['Legend', '레전드 그룹', 'Rise', '라이즈 그룹'];
  const FALLBACK_BADGES = [
    { color: '#E8C77E', bg: 'rgba(200,150,62,0.2)' },
    { color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
    { color: '#7EC8E8', bg: 'rgba(62,150,200,0.2)' },
  ];
  // LCK 플레이-인/플레이오프: MSI/LCP처럼 API 대진표(연결선)로 표기하고,
  //   참가 팀은 정규시즌 순위표로 대진표 위에 표기한다.
  let groups;
  // LCK CUP(별도 토너먼트: 그룹+플레이-인+플레이오프) — 정규 LCK 전용 로직과 분리
  const isLckCup = comp.key === 'lck' && sub === 'LCK CUP';
  const lckCupBracket = isLckCup && (stage === '플레이-인' || stage === '플레이오프');
  // 대진 기반 최종순위(LCK CUP·LEC/LCS/CBLOL 서머·LPL/LCP Split 3 등) — official.finalStandings 사용.
  const finalDataStage = stage === '최종 순위' && official?.finalStandings?.length > 0;
  const lckCupFinalStage = finalDataStage; // 하위 호환
  // 라이브 스플릿(LEC/LCS/CBLOL) 플레이오프 — 정규시즌 순위표를 참가 팀으로(미진출 팀 제외) 표기
  const liveBracketStage = isLecSummer && stage === '플레이오프';
  const liveBracketTeams = liveBracketStage ? (() => {
    const s = new Set();
    for (const r of official?.playoffs?.rounds || []) for (const m of r.matches || []) for (const slot of [m.a, m.b]) if (slot?.short) s.add(slot.short);
    return s;
  })() : null;
  // LCK 최종 순위: 전체 팀을 우승 → Worlds → PO 진출 순으로 정렬한 단일 표
  const lckFinalStage = comp.key === 'lck' && !isLckCup && grouped && stage === '최종 순위';
  const lckBracketStage = comp.key === 'lck' && !isLckCup && grouped && (stage === '플레이-인' || stage === '플레이오프');
  const lckBracket = lckBracketStage ? buildLckBracket(official?.[stage === '플레이-인' ? 'playin' : 'playoffs'], stage, current) : null;
  if (lckFinalStage) {
    // 실제 대진 결과가 확정되면 그 순위를 표기 (미확정이면 groups=[] → 안내만 표시).
    //   PO 6팀(더블 엘리미네이션): 1위=결승 승자, 2위=결승 패자, 3위=Lower Finals 패자,
    //     4위=LB R3 패자, 5위=LB R2 패자, 6위=LB R1 패자
    //   7·8위 = 플레이-인 탈락 2팀(2R 패자·파이널 패자)
    //   9·10위 = 정규시즌 라이즈 4·5위 (플레이-인 미진출)
    const winnerLoser = (m) => {
      if (!m) return {};
      const aWin = m.a?.win || m.a?.msi, bWin = m.b?.win || m.b?.msi;
      if (aWin) return { w: m.a.short, l: m.b?.short };
      if (bWin) return { w: m.b.short, l: m.a?.short };
      if (m.a?.score != null && m.b?.score != null && m.a.score !== m.b.score) {
        const aBig = m.a.score > m.b.score;
        return { w: aBig ? m.a.short : m.b.short, l: aBig ? m.b.short : m.a.short };
      }
      return {};
    };
    const playin = official?.playin, playoffs = official?.playoffs;
    const gf = winnerLoser(playoffs?.rounds?.[4]?.matches?.[0]);        // Grand Finals
    const lf = winnerLoser(playoffs?.rounds?.[3]?.matches?.[0]);        // Lower Finals
    const lbR3 = winnerLoser(playoffs?.rounds?.[2]?.matches?.[1]);      // col2 m1 = LB R3
    const lbR2 = winnerLoser(playoffs?.rounds?.[1]?.matches?.[2]);      // col1 m2 = LB R2
    const lbR1 = winnerLoser(playoffs?.rounds?.[0]?.matches?.[2]);      // col0 m2 = LB R1
    const piFinal = winnerLoser(playin?.rounds?.[2]?.matches?.[0]);
    const piR2 = winnerLoser(playin?.rounds?.[1]?.matches?.[0]);
    const rise = current.filter((t) => /라이즈|Rise/.test(t.group || '')).sort((a, b) => a.rank - b.rank);
    // 각 순위별 확정 팀 (미확정이면 undefined) — 확정된 것만 순위 순으로 표기
    const rankSlots = [
      { rank: 1, short: gf.w },
      { rank: 2, short: gf.l },
      { rank: 3, short: lf.l },
      { rank: 4, short: lbR3.l },
      { rank: 5, short: lbR2.l },
      { rank: 6, short: lbR1.l },
      { rank: 7, short: piFinal.l },
      { rank: 8, short: piR2.l },
      { rank: 9, short: rise[3]?.short },
      { rank: 10, short: rise[4]?.short },
    ];
    const teamOf = (short) => current.find((t) => t.short === short);
    const rows = rankSlots
      .filter((s) => s.short && teamOf(s.short))
      .map((s) => ({ ...teamOf(s.short), rank: s.rank }));  // 그룹 심볼 사용 안 함
    groups = rows.length ? [{ name: null, rows }] : [];
  } else if (lckBracketStage) {
    // 그룹 구분 없이 해당 단계 참가 팀만 한 표에 표기.
    //   등수 칸에는 그룹 심볼 + 그룹 내 시드(레전드 5위 / 라이즈 1~3위 등)를 표기.
    const legend = current.filter((t) => /레전드|Legend/.test(t.group || ''));
    const rise = current.filter((t) => /라이즈|Rise/.test(t.group || ''));
    const seeds = stage === '플레이-인'
      ? [{ t: legend[4], g: 'Legend', r: 5 }, { t: rise[0], g: 'Rise', r: 1 }, { t: rise[1], g: 'Rise', r: 2 }, { t: rise[2], g: 'Rise', r: 3 }]
      : [{ t: legend[0], g: 'Legend', r: 1 }, { t: legend[1], g: 'Legend', r: 2 }, { t: legend[2], g: 'Legend', r: 3 }, { t: legend[3], g: 'Legend', r: 4 }];
    // 플레이오프: 플레이-인 1라운드 승자(=5시드)와 파이널 라운드 승자(=6시드) 추가.
    //   플레이-인 대진에서 승자가 확정되면 그 팀의 정규시즌 순위 데이터를 가져와 표시.
    if (stage === '플레이오프') {
      const winnerOf = (m) => {
        if (!m) return null;
        if (m.a?.win || m.a?.msi) return m.a.short;
        if (m.b?.win || m.b?.msi) return m.b.short;
        if (m.a?.score != null && m.b?.score != null && m.a.score !== m.b.score) return m.a.score > m.b.score ? m.a.short : m.b.short;
        return null;
      };
      const playin = official?.playin;
      const r1Winner = winnerOf(playin?.rounds?.[0]?.matches?.[0]);       // 플레이-인 1라운드 승자 = PO 5시드
      const finalWinner = winnerOf(playin?.rounds?.[2]?.matches?.[0]);    // 파이널 라운드 승자 = PO 6시드
      const teamOf = (short) => short ? current.find((t) => t.short === short) : null;
      // 확정 시 그 팀의 정규시즌 그룹 심볼과 그룹 내 순위(예: 레전드 5위, 라이즈 1위)로 표기
      const gOf = (t) => /레전드|Legend/.test(t?.group || '') ? 'Legend' : /라이즈|Rise/.test(t?.group || '') ? 'Rise' : null;
      const r1Team = teamOf(r1Winner), finalTeam = teamOf(finalWinner);
      seeds.push({ t: r1Team, g: gOf(r1Team), r: r1Team?.rank ?? 5, pendingLabel: '플레이-인 1라운드 승자' });
      seeds.push({ t: finalTeam, g: gOf(finalTeam), r: finalTeam?.rank ?? 6, pendingLabel: '파이널 라운드 승자' });
    }
    groups = [{ name: null, rows: seeds.map((s) => s.t
      ? { ...withProb(s.t, s.r), seedGroup: s.g }
      : { rank: s.r, pendingLabel: s.pendingLabel, seedGroup: s.g }) }];
  } else {
    // 라이브 스플릿 플레이오프 참가 팀 = 플레이오프 대진에 등장하는 팀만(미진출 제외)
    const partCurrent = liveBracketStage ? current.filter((t) => liveBracketTeams.has(t.short)) : current;
    groups = grouped
      ? [...new Set(partCurrent.map((t) => t.group))]
          .sort((a, b) => {
            const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
          })
          .map((name, gi) => ({
          name: GROUP_META[name]?.label ?? name,
          badge: GROUP_META[name]?.badge ?? FALLBACK_BADGES[gi % FALLBACK_BADGES.length],
          rows: partCurrent.filter((t) => t.group === name).map((t, i) => (noPredict ? { ...t, rank: i + 1 } : withProb(t, i + 1))),
        }))
      : [{ name: null, rows: partCurrent.map((t, i) => (noPredict ? { ...t, rank: t.rank ?? i + 1 } : withProb(t, t.rank ?? i + 1))) }];
  }

  // LPL Split 3 단계별 표시: 럼블=조 순위만, 기사의 길/녹아웃=해당 대진표만
  // MSI는 별개 토너먼트라 지역 리그 전적(현재순위) 표는 숨긴다 (참가팀·대진표만 표기)
  // LCP Split 3 종료 → 스위스 순위표의 진출/우승 확률 컬럼 제거
  const lcpFinished = lcpSplit3 && subFinished;
  const lplFinished = lplSplit3 && subFinished; // LPL Split 3 종료 → 럼블 스테이지 순위표의 진출/우승 확률 컬럼 제거
  const hideStandings = (lplSplit3 && stage && stage !== '럼블 스테이지') || (lcpSplit3 && !lcpCfg?.pred) || comp.key === 'msi' || comp.key === 'ewc' || lplQualifier
    || (isLckCup && stage !== '그룹 스테이지') // CUP: 그룹 스테이지에서만 조 순위표, 나머지는 대진/최종순위
    || (isLecSummer && !lecCfg?.pred && stage !== '플레이오프') // LEC/LCS/CBLOL: 정규시즌·플레이오프(참가팀)에서 순위표 표기
    || (comp.key === 'lck' && sub === 'KeSPA CUP') // KeSPA는 전용 예선 순위표·대진표만 표기
    || finalDataStage; // 최종 순위 단계는 대진 기반 최종순위만 표기
  // LCK(종료) — 진출 확률 제거 + 스테이지별 탈락 팀 회색 처리
  const lckStages = comp.key === 'lck' && !isLckCup;
  const lckFinished = lckStages && subFinished;
  const collectElim = (rounds) => { const s = new Set(); for (const r of rounds || []) for (const m of r.matches || []) for (const slot of [m.a, m.b]) if (slot?.elim && slot?.short) s.add(slot.short); return s; };
  const stageElimSet = (() => {
    if (lckStages) {
      if (stage === '플레이-인') return collectElim(official?.playin?.rounds);
      if (stage === '플레이오프') return collectElim(official?.playoffs?.rounds);
      if (stage === '정규시즌') {
        const inBr = new Set();
        for (const rounds of [official?.playin?.rounds, official?.playoffs?.rounds]) for (const r of rounds || []) for (const m of r.matches || []) for (const slot of [m.a, m.b]) if (slot?.short) inBr.add(slot.short);
        return new Set(current.filter((t) => !inBr.has(t.short)).map((t) => t.short));
      }
    }
    if (liveBracketStage) return collectElim(official?.playoffs?.rounds); // 플레이오프 참가팀 중 탈락 팀만 회색
    return null;
  })();
  // 참가 팀 카드(MSI 전용). LCK 플레이-인/플레이오프는 정규시즌 순위표를 참가 팀으로 표기.
  const qualifiers = official?.qualifiers?.length ? official.qualifiers : null;
  // LPL Split 3는 이제 API 자동 대진(knights/playoffs)을 쓰므로 섹션형 bracket을 사용하지 않는다.
  const bracketSections = lplSplit3 ? undefined : official?.bracket?.sections;

  return (
    <div className="flex flex-col gap-8">
      {/* 메타 */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {comp.key === 'lck' && sub === 'KeSPA CUP' && official?.format && (
          <span className="text-white/50">형식: <strong className="text-white/80">{official.format}</strong></span>
        )}
        {(lplSplit3 || isLckCup || comp.stage || comp.format) && !lcpSplit3 && sub !== 'KeSPA CUP' && (
          <span className="text-white/50">형식: <strong className="text-white/80">{lplSplit3
            ? '그룹별 더블 라운드로빈 (Bo3) → 기사의 길 (Bo5) → 플레이오프 (Bo5)'
            : isLckCup
            ? (official?.format || '10팀 · 2개조 그룹 스테이지 → 플레이-인 → 플레이오프')
            : [comp.stage, comp.format].filter(Boolean).join(' · ')}</strong></span>
        )}
        {!isLckCup && sub !== 'KeSPA CUP' && comp.iterations > 0 && <span className="text-white/50">반복: <strong className="text-white/80">{comp.iterations.toLocaleString()}회</strong></span>}
        {comp.generatedAt && <span className="text-white/50">생성: <strong className="text-white/80">{fmtUpdated(comp.generatedAt)}</strong></span>}
      </div>

      {/* LCP Split 3 진행 방식 안내 */}
      {lcpSplit3 && lcpCfg?.pred && (
        <section className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5 flex flex-col gap-3 text-sm">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">진행 방식</h3>
            <span className="text-xs text-white/40">8팀 · 스위스 스테이지 → 4팀 플레이오프</span>
          </div>
          <div className="flex flex-col gap-2 text-white/70 leading-relaxed">
            <p><strong className="text-white/90">① 스위스 스테이지</strong> (7/25~8/30) — Bo3·Bo5 혼합. <strong className="text-white/85">3승 시 플레이오프 진출, 3패 시 탈락.</strong> 1R은 Split 2 상위 4팀 vs 하위 4팀 무작위, 이후 같은 승패기록끼리 대진. 3승·3패가 걸린 경기는 Bo5.</p>
            <p><strong className="text-white/90">② 플레이오프</strong> (8/29~30, 타이베이) — 4팀 더블 엘리미네이션 Bo5. 우승팀이 LCP 챔피언.</p>
            <p><strong className="text-white/90">③ Worlds 진출 (3팀)</strong> — 플레이오프 결승 2팀 + 나머지 중 챔피언십 포인트 최다 1팀.</p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40 pt-1 border-t border-white/10">
            <span>챔피언십 포인트</span>
            <span>3-0 <b className="text-white/60">50</b></span>
            <span>3-1 <b className="text-white/60">40</b></span>
            <span>3-2 <b className="text-white/60">30</b></span>
            <span>2-3 <b className="text-white/60">15</b></span>
            <span>1-3 <b className="text-white/60">3</b></span>
            <span>0-3 <b className="text-white/60">0</b></span>
          </div>
        </section>
      )}

      {/* 현재 순위 / 단계별 예측 */}
      {current.length > 0 && !hideStandings && (
        <section className="flex flex-col gap-5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{lckBracketStage || liveBracketStage ? '참가 팀' : (cfg?.heading || (roadToMsi ? '진출 팀' : '현재 순위'))}</h3>
            <span className="text-xs text-white/40">{lckBracketStage || liveBracketStage ? '정규시즌 순위표 (플레이오프 진출 시드)' : (cfg?.desc || official?.stage)}</span>
          </div>
          {lckFinalStage && groups.length === 0 && (
            <p className="text-sm text-white/50 py-6 px-4 rounded-xl bg-white/5 border border-white/10">
              최종 순위는 플레이오프 결승 종료 후 확정됩니다.
            </p>
          )}
          <div className={(isPeerGroupNames(groups.map((g) => g.name)) || isLckCup) && groups.length > 1 ? parallelGrid(groups.length) : 'contents'}>
          {groups.map((grp) => (
            <div key={grp.name || 'all'}>
              {grp.name && (
                <span className="inline-block text-xs font-black px-2 py-0.5 rounded mb-2"
                  style={{ color: grp.badge.color, backgroundColor: grp.badge.bg }}>
                  {grp.name}
                </span>
              )}
              <StandingsTable rows={grp.rows} color={comp.color} hasDiff={hasDiff} cols={lckFinalStage || finalDataStage ? { minimal: true } : lckFinished ? { diff: true } : lckBracketStage ? (stage === '플레이-인' ? { diff: true, advance: true, worlds: true, champ: true } : { diff: true, worlds: true, champ: true }) : liveBracketStage ? { diff: true, champ: true } : (lcpFinished || lplFinished) ? { diff: true } : cfg?.cols} onTeamClick={onTeamClick} teamOverride={isLckCup ? LCKCUP_TEAM_OVERRIDE : undefined} elimSet={stageElimSet} />
            </div>
          ))}
          </div>
        </section>
      )}

      {/* 참가 팀 — 항상 대진표 위에 배치. DEMACIA는 별도 렌더링(스테이지별 필터).
          Worlds도 스테이지별 필터 적용. */}
      {qualifiers?.length > 0 && comp.key !== 'demacia' && (() => {
        const isWorlds = comp.key === 'worlds' && qualifiers.some((q) => q.stage);
        let groups;
        if (!isWorlds) {
          groups = [{ title: null, items: qualifiers }];
        } else if (stage === '플레이-인') {
          groups = [{ title: null, items: qualifiers.filter((q) => q.stage === 'playin') }];
        } else if (stage === '스위스 스테이지') {
          // POOL 배정 (2026 Worlds 규정): POOL 1 = LCK/LPL/LCS/LEC #1, POOL 2 = LCP/CBLOL #1 + LCK/LPL #2,
          //   POOL 3 = LCS/LEC #2 + LCK/LPL #3, POOL 4 = LCP #2 + LCK/LPL #4 + PI 생존.
          const POOLS = {
            'LCK #1': 1, 'LPL #1': 1, 'LCS #1': 1, 'LEC #1': 1,
            'LCP #1': 2, 'CBLOL #1': 2, 'LCK #2': 2, 'LPL #2': 2,
            'LCS #2': 3, 'LEC #2': 3, 'LCK #3': 3, 'LPL #3': 3,
            'LCP #2': 4, 'LCK #4': 4, 'LPL #4': 4, // '플레이-인 통과' = 4
          };
          const playin = official?.playin;
          const gf = playin?.rounds?.[playin.rounds.length - 1]?.matches?.[0];
          const winShort = gf?.a?.win || gf?.a?.msi ? gf?.a?.short : (gf?.b?.win || gf?.b?.msi ? gf?.b?.short : null);
          const items = [
            ...qualifiers.filter((q) => q.stage === 'swiss'),
            winShort ? { seed: '플레이-인 통과', short: winShort } : { seed: '플레이-인 통과', label: 'TBD' },
          ];
          // POOL 순으로 정렬 (POOL 1 위, POOL 4 아래). 같은 POOL 안에서는 기존 순서 유지.
          items.sort((a, b) => {
            const pa = POOLS[a.seed] ?? (a.seed === '플레이-인 통과' ? 4 : 99);
            const pb = POOLS[b.seed] ?? (b.seed === '플레이-인 통과' ? 4 : 99);
            return pa - pb;
          });
          groups = [{ title: null, items }];
        } else if (stage === '녹아웃 스테이지') {
          // 각 팀의 승패 카운트 → 3승 진출자를 3-0/3-1/3-2로 분류 (각각 최대 2/3/3팀).
          const swissB = official?.swiss;
          const wins = {}, losses = {};
          swissB?.rounds?.forEach((r) => r.matches.forEach((m) => {
            if (!m.a?.short || !m.b?.short) return;
            if (m.a.score != null && m.b.score != null && m.a.score !== m.b.score) {
              const aWin = m.a.score > m.b.score;
              const w = aWin ? m.a.short : m.b.short;
              const l = aWin ? m.b.short : m.a.short;
              wins[w] = (wins[w] || 0) + 1;
              losses[l] = (losses[l] || 0) + 1;
            }
          }));
          const advancers = Object.keys(wins).filter((t) => wins[t] >= 3);
          const byRec = { '3-0': [], '3-1': [], '3-2': [] };
          for (const t of advancers) { const l = losses[t] || 0; const k = `3-${l}`; if (byRec[k]) byRec[k].push(t); }
          const slots = [
            ...['3-0','3-0'].map((rec, i) => ({ rec, short: byRec['3-0'][i] || null })),
            ...['3-1','3-1','3-1'].map((rec, i) => ({ rec, short: byRec['3-1'][i] || null })),
            ...['3-2','3-2','3-2'].map((rec, i) => ({ rec, short: byRec['3-2'][i] || null })),
          ];
          const items = slots.map((s) => s.short ? { seed: s.rec, short: s.short } : { seed: s.rec, label: 'TBD' });
          groups = [{ title: null, items }];
        } else {
          groups = [{ title: null, items: qualifiers }];
        }
        const renderCard = (q, i) => {
          const p = q.short ? probByShort[q.short] : null;
          const probRow = (label, v, color, strong) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 w-8 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(v, 100)}%`, backgroundColor: color }} />
              </div>
              <span className="font-mono tabular-nums text-[11px] w-12 text-right shrink-0" style={{ color, fontWeight: strong ? 800 : 600 }}>{v}%</span>
            </div>
          );
          const eliminated = q.short && eliminatedSet.has(q.short);
          // 종료된 대회는 확률(진출·우승) 표기를 숨긴다.
          const finished = comp.status === 'finished';
          const showAdvance = !finished && !isBracketStage && p?.advance != null;
          return (
            <div key={i} className="flex flex-col gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">
              {q.short ? (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <div style={eliminated ? { filter: 'grayscale(1)', opacity: 0.4 } : undefined} className="shrink-0">
                      <TeamLogo src={logoByShort[q.short]} size={20} />
                    </div>
                    <span className={`font-bold truncate ${eliminated ? 'text-white/35' : 'text-white/90'}`}>{nameByShort[q.short] || q.short}</span>
                    {q.seed && <span className="text-[10px] text-white/40 shrink-0 ml-auto">{q.seed}</span>}
                  </div>
                  {(showAdvance || (!finished && p?.champ != null)) && (
                    <div className="flex flex-col gap-1">
                      {showAdvance && probRow('진출', p.advance, comp.color)}
                      {!finished && p?.champ != null && probRow('우승', p.champ, '#E8C77E', true)}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`truncate ${isWorlds ? 'text-white/35 font-bold' : 'text-white/55'}`}>{isWorlds ? 'TBD' : q.label}</span>
                  {isWorlds && q.seed && <span className="text-[10px] text-white/40 shrink-0 ml-auto">{q.seed}</span>}
                </div>
              )}
            </div>
          );
        };
        return (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">참가 팀</h3>
            {groups.map((g, gi) => (
              <div key={gi} className="flex flex-col gap-2">
                {g.title && <h4 className="text-xs font-bold text-white/60">{g.title}</h4>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {g.items.map((q, i) => renderCard(q, i))}
                </div>
              </div>
            ))}
          </section>
        );
      })()}

      {/* LCP Split 3 단계별 대진표 (스위스/플레이-인/플레이오프) */}
      {lcpSplit3 && lcpCfg?.bracketKey && official?.[lcpCfg.bracketKey]?.rounds?.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{lcpCfg.bracketTitle}</h3>
            <span className="text-xs text-white/40">경기 결과가 나오면 자동 갱신됩니다.</span>
          </div>
          {lcpCfg.bracketKey === 'swiss' ? (
            <SwissBracket swiss={official.swiss} bo={{ base: 3, clinch: 5, clinchAt: 2 }} onTeamClick={onTeamClick} />
          ) : (
            <MsiBracket
              rounds={official[lcpCfg.bracketKey].rounds}
              totalRows={official[lcpCfg.bracketKey].totalRows}
              connectors={official[lcpCfg.bracketKey].connectors}
              onTeamClick={onTeamClick}
            />
          )}
          <BracketLegend />
        </section>
      )}

      {/* Worlds 단계별 대진표 (플레이-인 / 스위스 / 녹아웃) — lolesports API 자동 갱신 */}
      {(() => {
        if (comp.key !== 'worlds') return null;
        const bracketKey = stage === '플레이-인' ? 'playin' : stage === '스위스 스테이지' ? 'swiss' : stage === '녹아웃 스테이지' ? 'knockout' : null;
        if (!bracketKey) return null;
        const br = official?.[bracketKey];
        if (!br?.rounds?.length) {
          return (
            <section className="rounded-xl bg-white/5 border border-white/10 p-4 text-center text-sm text-white/50">
              대진 정보가 아직 확정되지 않았습니다. 대회 진행 시 자동 갱신됩니다.
            </section>
          );
        }
        const titles = { playin: '플레이-인 대진', swiss: '스위스 스테이지 (16팀 · 3승 진출 · 3패 탈락)', knockout: '녹아웃 스테이지 (8팀 싱글 엘리미네이션 Bo5)' };
        return (
          <section>
            <div className="flex items-baseline gap-2 flex-wrap mb-4">
              <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{titles[bracketKey]}</h3>
              <span className="text-xs text-white/40">경기 결과가 나오면 자동 갱신됩니다.</span>
            </div>
            {bracketKey === 'swiss' ? (
              <SwissBracket swiss={br} bo={{ base: 1, clinch: 3, clinchAt: 2 }} onTeamClick={onTeamClick} />
            ) : (
              <MsiBracket rounds={br.rounds} totalRows={br.totalRows} connectors={br.connectors} onTeamClick={onTeamClick} />
            )}
            <BracketLegend goldLabel={bracketKey === 'knockout' ? '우승' : '진출'} />
          </section>
        );
      })()}

      {/* LEC 서머 플레이오프 대진표 (6팀 더블 엘리) — API 자동 갱신 */}
      {isLecSummer && lecCfg?.bracketKey && official?.[lecCfg.bracketKey]?.rounds?.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{lecCfg.bracketTitle}</h3>
            <span className="text-xs text-white/40">경기 결과가 나오면 자동 갱신됩니다.</span>
          </div>
          <MsiBracket rounds={official[lecCfg.bracketKey].rounds} totalRows={official[lecCfg.bracketKey].totalRows} connectors={official[lecCfg.bracketKey].connectors} onTeamClick={onTeamClick} />
          <BracketLegend />
        </section>
      )}

      {/* LPL Split 3 단계별 대진표 (기사의 길 / 플레이오프) — API 자동 갱신 */}
      {lplSplit3 && lplCfg?.bracketKey && official?.[lplCfg.bracketKey]?.rounds?.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{lplCfg.bracketTitle}</h3>
            <span className="text-xs text-white/40">경기 결과가 나오면 자동 갱신됩니다.</span>
          </div>
          <MsiBracket rounds={official[lplCfg.bracketKey].rounds} totalRows={official[lplCfg.bracketKey].totalRows} connectors={official[lplCfg.bracketKey].connectors} onTeamClick={onTeamClick} />
          <BracketLegend />
        </section>
      )}

      {/* DEMACIA 참가 팀 — 대진표 위에 배치. 녹아웃 스테이지에서는 진출 8팀만 표시. */}
      {(() => {
        if (comp.key !== 'demacia' || !qualifiers?.length) return null;
        const gm = official?.group?.matches || [];
        const teamMap = Object.fromEntries((official?.teams || []).map((t) => [t.slot, t]));
        const shortOf = (v) => (v && teamMap[v]?.short) || (v && !teamMap[v] ? v : null);
        const winnerShortOf = (m) => {
          if (!m?.winner) return null;
          const a = shortOf(m.a), b = shortOf(m.b);
          return m.winner === m.a || m.winner === a ? a : b;
        };
        // 녹아웃 진출 8팀: M7-M9 승자(1-0, 3팀) + M13-M15 승자(1-1, 3팀) + M19-M20 승자(1-2, 2팀).
        //   각 슬롯은 매치 확정 시 자동 채움, 미정은 TBD.
        const advSlots = [
          ...['M7','M8','M9'].map((id) => ({ rec: '1-0', short: winnerShortOf(gm.find((x) => x.id === id)) })),
          ...['M13','M14','M15'].map((id) => ({ rec: '1-1', short: winnerShortOf(gm.find((x) => x.id === id)) })),
          ...['M19','M20'].map((id) => ({ rec: '1-2', short: winnerShortOf(gm.find((x) => x.id === id)) })),
        ];
        let list;
        if (stage === '녹아웃 스테이지') {
          list = advSlots.map((s) => s.short ? { seed: s.rec, short: s.short } : { seed: s.rec, label: 'TBD' });
        } else {
          list = qualifiers;
        }
        if (!list.length) return null;
        return (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">참가 팀</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {list.map((q, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">
                  {q.short ? (
                    <>
                      <TeamLogo src={logoByShort[q.short]} size={20} />
                      <span className="font-bold truncate text-white/90">{nameByShort[q.short] || q.short}</span>
                      {q.seed && <span className="text-[10px] text-white/40 shrink-0 ml-auto">{q.seed}</span>}
                    </>
                  ) : (
                    <>
                      <span className="text-white/35 font-bold truncate">{q.label || 'TBD'}</span>
                      {q.seed && <span className="text-[10px] text-white/40 shrink-0 ml-auto">{q.seed}</span>}
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* DEMACIA 그룹/녹아웃 스테이지 — 다른 대진표와 일관된 카드/색상 규칙 사용 */}
      {(() => {
        if (comp.key !== 'demacia') return null;
        const groupMatches = official?.group?.matches || [];
        const knockoutMatches = official?.knockout?.matches || [];
        const teamMap = Object.fromEntries((official?.teams || []).map((t) => [t.slot, t]));
        const shortOf = (v) => (v && teamMap[v]?.short) || (v && !teamMap[v] ? v : null);
        const winnerShortOf = (m) => {
          if (!m?.winner) return null;
          const a = shortOf(m.a), b = shortOf(m.b);
          return m.winner === m.a || m.winner === a ? a : b;
        };
        const gfMatch = knockoutMatches.find((m) => m.id === 'GF');
        const championShort = winnerShortOf(gfMatch);
        const makeLegend = (goldLabel) => (
          <div className="mt-3 flex items-center gap-4 text-xs text-white/60 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(232,199,126,0.7)' }} /> {goldLabel}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }} /> 라운드 승리</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(248,113,113,0.6)' }} /> 탈락</span>
          </div>
        );
        if (stage === '그룹 스테이지' && groupMatches.length > 0) {
          const elimSet = computeGroupEliminated(groupMatches, teamMap);
          // 녹아웃 진출자(msi) = M7-M9, M13-M15, M19-M20 승자 + M16-M18 라운드로빈 1위(2승)
          const msiSet = new Set();
          ['M7','M8','M9','M13','M14','M15','M19','M20'].forEach((id) => {
            const w = winnerShortOf(groupMatches.find((x) => x.id === id));
            if (w) msiSet.add(w);
          });
          const rrWins = {};
          for (const id of ['M16','M17','M18']) {
            const w = winnerShortOf(groupMatches.find((x) => x.id === id));
            if (w) rrWins[w] = (rrWins[w] || 0) + 1;
          }
          Object.entries(rrWins).forEach(([s, w]) => { if (w >= 2) msiSet.add(s); });
          return (
            <section>
              <div className="flex items-baseline gap-2 flex-wrap mb-4">
                <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">온라인 그룹 스테이지</h3>
                <span className="text-xs text-white/40">스위스 시스템(0-2: 싱글 라운드 로빈) · 8팀 진출</span>
              </div>
              <DemaciaBracket
                columns={[
                  { groups: [{ day: '10/3', format: 'Bo1', label: '0-0', matches: groupMatches.filter((m) => m.bracket === '0-0') }] },
                  { groups: [
                    { day: '10/4', format: 'Bo3', label: '1-0', matches: groupMatches.filter((m) => m.bracket === '1-0') },
                    { day: '10/5', format: 'Bo3', label: '0-1', matches: groupMatches.filter((m) => m.bracket === '0-1') },
                  ] },
                  { groups: [
                    { day: '10/6', format: 'Bo3', label: '1-1', matches: groupMatches.filter((m) => m.bracket === '1-1') },
                    { day: '10/7', format: 'Bo3', label: '0-2 RR', matches: groupMatches.filter((m) => m.bracket === '0-2 RR'), showRRStandings: true },
                  ] },
                  { groups: [{ day: '10/8', format: 'Bo3', label: '1-2 & 0-2 1st', matches: groupMatches.filter((m) => m.bracket === '1-2 & 0-2 1st') }] },
                ]}
                teams={official.teams}
                msiSet={msiSet}
                elimSet={elimSet}
                onTeamClick={onTeamClick}
              />
              {makeLegend('진출')}
            </section>
          );
        }
        if (stage === '녹아웃 스테이지' && knockoutMatches.length > 0) {
          const elimSet = computeKnockoutEliminated(knockoutMatches, teamMap);
          const msiSet = new Set(); if (championShort) msiSet.add(championShort);
          // 싱글 엘리미네이션 라운드 정의 (라운드 순 → 매치 리스트). 각 라운드 매치는
          //   gridStart = 2^roundIdx + i * 2^(roundIdx+1) 규칙으로 상위 라운드가 중앙에 정렬.
          const rounds = [
            { label: '8강',   matches: knockoutMatches.filter((m) => m.round === '8강') },
            { label: '4강',   matches: knockoutMatches.filter((m) => m.round === '4강') },
            { label: '결승',  matches: knockoutMatches.filter((m) => m.round === '결승') },
          ];
          const firstCount = rounds[0].matches.length;
          const gridRows = firstCount * 2;
          const columns = rounds.map((r, ri) => ({
            gridRows,
            groups: [{
              format: 'Bo5',
              label: r.label,
              matches: r.matches.map((m, i) => ({ ...m, gridStart: Math.pow(2, ri) + i * Math.pow(2, ri + 1) })),
              showMatchDate: true,
            }],
          }));
          return (
            <section>
              <div className="flex items-baseline gap-2 flex-wrap mb-4">
                <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">오프라인 녹아웃 스테이지</h3>
                <span className="text-xs text-white/40">싱글 엘리미네이션 · Bo5</span>
              </div>
              <DemaciaBracket
                columns={columns}
                teams={official.teams}
                msiSet={msiSet}
                elimSet={elimSet}
                connectors={[
                  ['M21', 'M25', 'a'], ['M22', 'M25', 'b'],
                  ['M23', 'M26', 'a'], ['M24', 'M26', 'b'],
                  ['M25', 'GF', 'a'], ['M26', 'GF', 'b'],
                ]}
                onTeamClick={onTeamClick}
              />
              {makeLegend('우승')}
            </section>
          );
        }
        return null;
      })()}

      {/* Asian Games — 국가 대항전. A조/B조 순위표+대진, 녹아웃 브래킷. */}
      {(() => {
        if (comp.key !== 'asiangames') return null;
        const teams = official?.teams || [];
        const nameOf = (code) => (teams.find((t) => t.code === code)?.name || code);
        const eloOf = (code) => teams.find((t) => t.code === code)?.elo;
        const legend = (
          <div className="mt-3 flex items-center gap-4 text-xs text-white/60 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(232,199,126,0.7)' }} /> 우승</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }} /> 라운드 승리</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(248,113,113,0.6)' }} /> 탈락</span>
          </div>
        );
        // 국가 레이팅(소속팀 GPR 평균) — 로스터가 있는 국가만. 없으면 예측 생략.
        const ratingOf = (code) => teams.find((t) => t.code === code)?.rating;
        // 시리즈(BoN) 승률: 게임 승률 p로 먼저 ceil(N/2)승 확률.
        const seriesWin = (p, need) => {
          const other = need; let prob = 0;
          const C = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
          for (let l = 0; l < other; l++) prob += C(need - 1 + l, l) * Math.pow(p, need) * Math.pow(1 - p, l);
          return prob;
        };
        const matchCard = (m) => {
          const done = m.scoreA != null && m.scoreB != null && m.scoreA !== m.scoreB;
          const aWin = done && m.scoreA > m.scoreB;
          const bWin = done && m.scoreB > m.scoreA;
          // 예측: 양 팀 모두 레이팅 보유(=KOR/TPE/VIE) & 미종료일 때만.
          const ra = ratingOf(m.a), rb = ratingOf(m.b);
          const predict = !done && m.a && m.b && ra != null && rb != null;
          let pA = null, pB = null;
          if (predict) {
            const need = m.format === 'Bo5' ? 3 : 2;
            const g = 1 / (1 + Math.pow(10, (rb - ra) / 400));
            pA = Math.round(seriesWin(g, need) * 100); pB = 100 - pA;
          }
          const slot = (code, score, win, pct) => (
            <div className={`flex items-center gap-2 px-2.5 py-2 ${win ? 'bg-[rgba(96,165,250,0.14)]' : ''}`}>
              <span className={`text-xs truncate flex-1 ${win ? 'font-bold text-white' : 'text-white/70'}`}>{code ? nameOf(code) : 'TBD'}</span>
              {score != null ? <span className={`font-mono tabular-nums text-sm shrink-0 ${win ? 'text-[#60A5FA] font-black' : 'text-white/45'}`}>{score}</span>
                : pct != null ? <span className="font-mono tabular-nums text-xs shrink-0 text-white/55 font-black">{pct}%</span> : null}
            </div>
          );
          return (
            <div key={m.id} className="flex flex-col">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-0.5 mb-1 flex items-baseline gap-1.5">
                <span>{m.id}</span><span className="ml-auto text-white/30 normal-case font-normal">{m.format}</span>
              </span>
              <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                {slot(m.a, m.scoreA, aWin, pA)}
                <div className="h-px bg-white/10" />
                {slot(m.b, m.scoreB, bWin, pB)}
              </div>
            </div>
          );
        };
        // 참가 팀 — 8개국. 조 배정이 있으면 A조/B조로 나눠, 없으면 한 목록으로 Elo와 함께 표기.
        const hasGroups = teams.some((t) => t.group === 'A' || t.group === 'B');
        const teamCard = (t) => (
          <div key={t.code} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">
            {(t.code === 'TPE' || AG_FLAG[t.code]) && (
              <img src={t.code === 'TPE' ? chineseTaipeiFlag : `https://flagcdn.com/32x24/${AG_FLAG[t.code]}.png`} alt="" width={24} height={18}
                className="shrink-0 rounded-[3px] object-cover" style={{ width: 24, height: 18 }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            )}
            <span className="font-bold truncate text-white/90">{t.name}</span>
            {t.elo != null && <span className="text-[11px] text-white/40 shrink-0 ml-auto font-mono">Elo {t.elo}</span>}
          </div>
        );
        const participants = teams.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">참가 팀</h3>
              <span className="text-xs text-white/40">{teams.length}개국{hasGroups ? '' : official?.placeholder ? ' · 조 편성 미정' : ' · 조 배정·Elo 추후 반영'}</span>
            </div>
            {hasGroups ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['A', 'B'].map((gk) => (
                  <div key={gk} className="flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-white/60">{gk}조</h4>
                    <div className="flex flex-col gap-2">{teams.filter((t) => t.group === gk).map(teamCard)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{teams.map(teamCard)}</div>
            )}
          </section>
        );
        const wrap = (body) => <>{participants}{body}</>;
        if (stage === '그룹 스테이지') {
          const groupBlock = (gk) => {
            const grp = official?.groups?.[gk];
            const rows = grp?.standings?.length ? grp.standings : teams.filter((t) => t.group === gk).map((t) => ({ code: t.code, w: 0, l: 0, sw: 0, sl: 0 }));
            return (
              <div key={gk} className="flex flex-col gap-4">
                <div>
                  <div className="flex items-baseline gap-2 flex-wrap mb-3">
                    <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{gk}조 순위</h3>
                    <span className="text-xs text-white/40">싱글 라운드로빈 · Bo3 · 상위 2팀 4강 진출</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead><tr className="text-white/40 text-xs border-b border-white/10">
                        <th className="text-center font-bold py-2 px-2 w-10">#</th>
                        <th className="text-left font-bold py-2 pr-2">국가</th>
                        <th className="text-center font-bold py-2 px-2">승-패</th>
                        <th className="text-center font-bold py-2 px-2">세트</th>
                      </tr></thead>
                      <tbody>
                        {rows.length ? rows.map((r, i) => (
                          <tr key={r.code} className="border-b border-white/5">
                            <td className="py-2 px-2 text-center text-white/50 font-mono">{i + 1}</td>
                            <td className="py-2 pr-2 font-bold text-white/90">{nameOf(r.code)}</td>
                            <td className="py-2 px-2 text-center font-mono">{r.w}-{r.l}</td>
                            <td className="py-2 px-2 text-center font-mono text-white/50">{r.sw}-{r.sl}</td>
                          </tr>
                        )) : (
                          <tr><td colSpan={4} className="py-4 text-center text-white/30 text-xs">조 편성 미정</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          };
          if (!official?.groups) return wrap(<section className="rounded-xl bg-white/5 border border-white/10 p-4 text-center text-sm text-white/50">조별 정보가 아직 확정되지 않았습니다.</section>);
          return wrap(
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {groupBlock('A')}
              {groupBlock('B')}
            </section>
          );
        }
        if (stage === '녹아웃 스테이지') {
          const ko = official?.knockout?.matches || [];
          if (!ko.length) return wrap(<section className="rounded-xl bg-white/5 border border-white/10 p-4 text-center text-sm text-white/50">녹아웃 대진이 아직 확정되지 않았습니다.</section>);
          const byId = Object.fromEntries(ko.map((m) => [m.id, m]));
          const col = (title, ids) => (
            <div className="flex flex-col gap-4 shrink-0 justify-center" style={{ width: 220 }}>
              <div className="text-[11px] text-white/50 font-black tracking-wider px-1">{title}</div>
              {ids.map((id) => byId[id] && matchCard(byId[id]))}
            </div>
          );
          return wrap(
            <section>
              <div className="flex items-baseline gap-2 flex-wrap mb-4">
                <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">녹아웃 스테이지</h3>
                <span className="text-xs text-white/40">4강 Bo3 · 3·4위전·결승 Bo5</span>
              </div>
              <div className="flex gap-6 overflow-x-auto pb-3 items-stretch w-fit">
                {col('4강', ['SF1', 'SF2'])}
                <div className="flex flex-col gap-6 shrink-0 justify-center" style={{ width: 220 }}>
                  <div>
                    <div className="text-[11px] text-white/50 font-black tracking-wider px-1 mb-4">결승</div>
                    {byId['FINAL'] && matchCard(byId['FINAL'])}
                  </div>
                  <div>
                    <div className="text-[11px] text-white/50 font-black tracking-wider px-1 mb-4">3·4위전</div>
                    {byId['BRONZE'] && matchCard(byId['BRONZE'])}
                  </div>
                </div>
              </div>
              {legend}
            </section>
          );
        }
        return null;
      })()}

      {/* EWC — 4개조 그룹 스테이지(더블 엘리) + 8강 플레이오프(+3위전) */}
      {(() => {
        if (comp.key !== 'ewc') return null;
        const ewc = official;
        if (!ewc?.groups) return null;
        if (stage === '그룹 스테이지') {
          return (
            <section className="flex flex-col gap-5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">그룹 스테이지</h3>
                <span className="text-xs text-white/40">4개조 · 4팀 더블 엘리미네이션 · 조별 2팀 플레이오프 진출</span>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-6">
                {['A', 'B', 'C', 'D'].map((g) => ewc.groups[g] && (
                  <div key={g}>
                    <span className="inline-block text-xs font-black px-2 py-0.5 rounded mb-2" style={{ color: '#E8C77E', backgroundColor: 'rgba(200,150,62,0.2)' }}>{g}조</span>
                    <MsiBracket rounds={ewc.groups[g].rounds} totalRows={ewc.groups[g].totalRows} connectors={ewc.groups[g].connectors} onTeamClick={onTeamClick} teamOverride={EWC_TEAM_OVERRIDE} />
                  </div>
                ))}
              </div>
              <BracketLegend goldLabel="플레이오프 진출" />
            </section>
          );
        }
        return (
          <section className="flex flex-col gap-8">
            <div>
              <div className="flex items-baseline gap-2 flex-wrap mb-4">
                <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">플레이오프</h3>
                <span className="text-xs text-white/40">8팀 싱글 엘리미네이션{ewc.champion ? ` · 우승 ${ewc.champion}` : ''}</span>
              </div>
              {(() => {
                // 결승과 3위 결정전을 같은 마지막 x컬럼에 배치(결승 상단·3위전 하단)
                const b = ewc.playoff.bracket;
                const thirdMatch = ewc.playoff.third?.rounds?.[0]?.matches?.[0];
                const rounds = thirdMatch
                  ? b.rounds.map((r, i) => (i === b.rounds.length - 1
                    ? { ...r, matches: [...r.matches, { ...thirdMatch, startRow: 6 }] }
                    : r))
                  : b.rounds;
                return <MsiBracket rounds={rounds} totalRows={b.totalRows} connectors={b.connectors} onTeamClick={onTeamClick} teamOverride={EWC_TEAM_OVERRIDE} />;
              })()}
            </div>
            <BracketLegend goldLabel="우승" />
          </section>
        );
      })()}

      {/* LPL 대표 선발전 — 대진 탭 */}
      {lplQualifier && stage === '대진' && official?.qualifier?.rounds?.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">대표 선발전 대진</h3>
            <span className="text-xs text-white/40">경기 결과가 나오면 자동 갱신됩니다.</span>
          </div>
          <MsiBracket rounds={official.qualifier.rounds} totalRows={official.qualifier.totalRows} connectors={official.qualifier.connectors} onTeamClick={onTeamClick} />
          <BracketLegend />
        </section>
      )}

      {/* LPL 대표 선발전 — 챔피언십 포인트 탭 */}
      {lplQualifier && stage === '챔피언십 포인트' && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">챔피언십 포인트</h3>
            <span className="text-xs text-white/40">2026 시즌 Split 1·2·3 성적 누적</span>
          </div>
          {official?.points?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-white/40 text-xs border-b border-white/10">
                    <th className="text-center font-bold py-2 px-2 w-10">#</th>
                    <th className="text-left font-bold py-2 pr-2">팀</th>
                    {official.points[0]?.split1 != null && <th className="text-center font-bold py-2 px-2">Split 1</th>}
                    {official.points[0]?.split2 != null && <th className="text-center font-bold py-2 px-2">Split 2</th>}
                    {official.points[0]?.split3 != null && <th className="text-center font-bold py-2 px-2">Split 3</th>}
                    <th className="text-right font-bold py-2 px-2">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {official.points.map((p, i) => (
                    <tr key={p.team} className="border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => onTeamClick?.(p.team)}>
                      <td className="py-2 px-2 text-center text-white/40 font-mono">{i + 1}</td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <TeamLogo src={logoByShort[p.team]} />
                          <span className="font-bold text-white/90 truncate">{nameByShort[p.team] || p.team}</span>
                        </div>
                      </td>
                      {p.split1 != null && <td className="py-2 px-2 text-center text-white/60 font-mono">{p.split1}</td>}
                      {p.split2 != null && <td className="py-2 px-2 text-center text-white/60 font-mono">{p.split2}</td>}
                      {p.split3 != null && <td className="py-2 px-2 text-center text-white/60 font-mono">{p.split3}</td>}
                      <td className="py-2 px-2 text-right font-mono font-black text-white">{p.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-white/50 py-6 px-4 rounded-xl bg-white/5 border border-white/10">
              챔피언십 포인트 데이터는 곧 게재됩니다.
            </p>
          )}
        </section>
      )}

      {/* 대진표 (LCK 플레이-인/플레이오프) — API 대진 + 연결선 (MSI/LCP와 동일 형식) */}
      {lckBracket?.rounds?.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">대진표</h3>
            <span className="text-xs text-white/40">{cfg?.desc || '경기 결과가 나오면 자동 갱신됩니다.'}</span>
          </div>
          <MsiBracket rounds={lckBracket.rounds} totalRows={lckBracket.totalRows} connectors={lckBracket.connectors} onTeamClick={onTeamClick} />
          <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-white/50">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(232,199,126,0.7)' }} /> 우승/진출</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }} /> 라운드 승리</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(248,113,113,0.6)' }} /> 탈락</span>
          </div>
        </section>
      )}

      {/* LCK CUP 플레이-인/플레이오프 대진표 — API 실제 결과 (연결선) */}
      {lckCupBracket && official?.[stage === '플레이-인' ? 'playin' : 'playoffs']?.rounds?.length > 0 && (() => {
        const br = official[stage === '플레이-인' ? 'playin' : 'playoffs'];
        return (
          <section>
            <div className="flex items-baseline gap-2 flex-wrap mb-4">
              <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{stage} 대진</h3>
              <span className="text-xs text-white/40">2026 LCK CUP · 실제 경기 결과</span>
            </div>
            <MsiBracket rounds={br.rounds} totalRows={br.totalRows} connectors={br.connectors} onTeamClick={onTeamClick} teamOverride={LCKCUP_TEAM_OVERRIDE} />
            <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-white/50">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(232,199,126,0.7)' }} /> 우승/진출</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }} /> 라운드 승리</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(248,113,113,0.6)' }} /> 탈락</span>
            </div>
          </section>
        );
      })()}

      {/* 최종 순위 (대진 기반) — LCK CUP·라이브 스플릿 등 */}
      {finalDataStage && (
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">최종 순위</h3>
            <span className="text-xs text-white/40">
              {subFinished ? `우승 ${official.finalStandings[0]?.team}` : '대진 결과로 순위가 확정된 팀만 표시'}
            </span>
          </div>
          <StandingsTable
            rows={official.finalStandings.map((f) => ({ short: f.team, rank: f.rank }))}
            color={comp.color}
            cols={{ minimal: true }}
            onTeamClick={onTeamClick}
            teamOverride={isLckCup ? LCKCUP_TEAM_OVERRIDE : undefined}
          />
          {!subFinished && <p className="text-[11px] text-white/40">진행 중 — 상위 순위는 대진이 진행됨에 따라 자동 확정됩니다.</p>}
        </section>
      )}

      {/* Road to MSI(선발전) 대진표 — 실제 결과 */}
      {roadToMsi && official?.bracket && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">대진표</h3>
            {official.bracket.desc && <span className="text-xs text-white/40">{official.bracket.desc}</span>}
          </div>
          <MsiBracket rounds={official.bracket.rounds} totalRows={official.bracket.totalRows} connectors={official.bracket.connectors} />
          <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-white/50">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(232,199,126,0.7)' }} /> MSI 진출</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }} /> 라운드 승리</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(248,113,113,0.6)' }} /> 탈락</span>
          </div>
        </section>
      )}

      {/* LCK KeSPA CUP — 예선 2개조 순위표 + 결선 스테이지 1(사다리)·2 대진표 (수기 데이터) */}
      {comp.key === 'lck' && sub === 'KeSPA CUP' && (() => {
        const legend = (gold) => (
          <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-white/50">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(232,199,126,0.7)' }} /> {gold}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }} /> 라운드 승리</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(248,113,113,0.6)' }} /> 탈락</span>
          </div>
        );
        if (stage === '예선') {
          const groupTable = (gk, rows) => (
            <div key={gk} className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{gk}조</h3>
                <span className="text-xs text-white/40">싱글 라운드로빈 · 상위 4팀 결선 진출</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="text-white/40 text-xs border-b border-white/10">
                    <th className="text-center font-bold py-2 px-2 w-10">#</th>
                    <th className="text-left font-bold py-2 pr-2">팀</th>
                    <th className="text-center font-bold py-2 px-2">승-패</th>
                    <th className="text-center font-bold py-2 px-2">세트 평균 시간</th>
                  </tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.code} className="border-b border-white/5"
                          style={{ cursor: knownTeam(r.code) ? 'pointer' : undefined }}
                          onClick={knownTeam(r.code) ? () => onTeamClick(r.code) : undefined}>
                        <td className="py-2 px-2 text-center text-white/50 font-mono">{i + 1}</td>
                        <td className="py-2 pr-2"><span className="inline-flex items-center gap-2 font-bold text-white/90"><TeamLogo src={logoByShort[r.code]} size={16} />{r.code}</span></td>
                        <td className="py-2 px-2 text-center font-mono">{r.w}-{r.l}</td>
                        <td className="py-2 px-2 text-center font-mono text-white/40 text-xs">{r.time || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
          return (
            <section className="flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {groupTable('A', official?.qual?.A || [])}
                {groupTable('B', official?.qual?.B || [])}
              </div>
              <p className="text-[11px] text-white/40">각 조 5위는 탈락, 상위 4팀씩(총 8팀)이 결선 스테이지 1에 진출합니다. 세트 평균 시간은 동률 시 순위 비교 기준입니다.</p>
            </section>
          );
        }
        if (stage === '결선 스테이지 1' && official?.fs1) {
          return (
            <section>
              <div className="flex items-baseline gap-2 flex-wrap mb-4">
                <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">결선 스테이지 1</h3>
                <span className="text-xs text-white/40">사다리 방식 · 각 라운드 최상위 매치 승자 결선 스테이지 2 진출</span>
              </div>
              <MsiBracket rounds={official.fs1.rounds} totalRows={official.fs1.totalRows} connectors={official.fs1.connectors} onTeamClick={onTeamClick} />
              {legend('결선 스테이지 2 진출')}
            </section>
          );
        }
        if (stage === '결선 스테이지 2' && official?.fs2) {
          return (
            <section>
              <div className="flex items-baseline gap-2 flex-wrap mb-4">
                <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">결선 스테이지 2</h3>
                <span className="text-xs text-white/40">결선 스테이지 1 진출 4팀{official.champion ? ` · 우승 ${official.champion}` : ''}</span>
              </div>
              <MsiBracket rounds={official.fs2.rounds} connectors={official.fs2.connectors} onTeamClick={onTeamClick} />
              {legend('우승')}
            </section>
          );
        }
        return null;
      })()}

      {/* MSI/LPL 스테이지 대진표 — 섹션 구조 (단계 선택 시 해당 섹션만) */}
      {bracketSections?.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">대진표</h3>
            {official.bracket.desc && <span className="text-xs text-white/40">{official.bracket.desc}</span>}
          </div>
          <BracketGroup sections={bracketSections} crossConnectors={official.bracket.crossConnectors} onTeamClick={onTeamClick} />
          {official.bracket.legend?.length > 0 ? (
            <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-white/50">
              {official.bracket.legend.map((lg, i) => (
                <span key={i} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: lg.color }} /> {lg.label}</span>
              ))}
            </div>
          ) : (
            <BracketLegend />
          )}
        </section>
      )}

      {/* 대진별 예측 — 진행중인 리그에서만 (단계별 대진표가 있으면 생략) */}
    {comp.status === 'ongoing' && (!cfg || cfg.matches) && stage !== '최종 순위' && !finalDataStage && !lckBracketStage && !roadToMsi && comp.matches?.length > 0 && !(comp.key === 'lpl' && sub === 'Split 3') && !lplQualifier && !(comp.key === 'lck' && sub === 'KeSPA CUP') && (
      <section>
        <h3 className="text-sm font-black text-[#E8C77E] mb-4 uppercase tracking-wider">대진별 예측</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {comp.matches.map((m, i) => (
            <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-sm">
              <span className={`flex-1 flex items-center justify-end gap-1.5 font-bold truncate ${m.winner === m.a ? 'text-[#E8C77E]' : 'text-white/60'}`}>
                {m.winner === m.a && <Trophy size={12} className="shrink-0" />}
                <span className="truncate">{nameByShort[m.a] || m.a}</span>
                <TeamLogo src={logoByShort[m.a]} size={18} />
              </span>
              <span className="px-2 py-0.5 rounded bg-white/10 text-[11px] font-black text-white/70 shrink-0">{m.pA}%</span>
              <span className={`flex-1 flex items-center justify-start gap-1.5 font-bold truncate ${m.winner === m.b ? 'text-[#E8C77E]' : 'text-white/60'}`}>
                <TeamLogo src={logoByShort[m.b]} size={18} />
                <span className="truncate">{nameByShort[m.b] || m.b}</span>
                {m.winner === m.b && <Trophy size={12} className="shrink-0" />}
              </span>
            </div>
          ))}
        </div>
      </section>
      )}
    </div>
  );
};

// 종료된 대회의 실제 결과 렌더
const ResultView = ({ comp }) => {
  const fr = comp.finalResult;
  return (
    <div className="flex flex-col gap-8">
      {fr?.champion && (
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#C8963E]/20 to-transparent border border-[#C8963E]/30">
          <Crown size={32} className="text-[#E8C77E] shrink-0" />
          <div>
            <p className="text-xs text-white/50 font-bold uppercase tracking-wider">우승</p>
            <p className="text-2xl font-black text-[#E8C77E]">{fr.champion}</p>
            {fr.runnerUp && <p className="text-sm text-white/50 mt-0.5">준우승 {fr.runnerUp}</p>}
          </div>
        </div>
      )}

      {fr?.standings?.length > 0 && (
        <section>
          <h3 className="text-sm font-black text-[#E8C77E] mb-4 uppercase tracking-wider">최종 순위</h3>
          <div className="flex flex-col gap-2">
            {fr.standings.map((row, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="w-7 text-center font-black text-white/40 font-mono shrink-0">{row.rank ?? i + 1}</span>
                <span className="font-bold text-white/90">{row.team}</span>
                {row.note && <span className="ml-auto text-xs text-white/40">{row.note}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const NotReady = ({ comp }) => (
  <div className="py-16 text-center border-2 border-dashed border-white/10 rounded-3xl">
    <Hourglass size={28} className="mx-auto text-white/30 mb-3" />
    <p className="text-white/50 font-bold mb-1">
      {comp.status === 'finished' ? '결과 정리 중' : '시뮬레이션 준비 중'}
    </p>
    <p className="text-white/30 text-sm">
      {comp.status === 'finished'
        ? '종료된 대회의 실제 결과를 곧 게재합니다.'
        : 'GPR 팀별 점수를 반영한 몬테카를로 예측을 곧 게재합니다.'}
    </p>
  </div>
);

// 완료된 과거 스플릿 표시 — LCK CUP처럼 스테이지 탭(정규/그룹 순위 · 각 대진 · 최종 순위)으로 분리.
const PAST_GROUP_BADGES = [
  { color: '#E8C77E', bg: 'rgba(200,150,62,0.2)' },
  { color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
  { color: '#7EC8E8', bg: 'rgba(62,150,200,0.2)' },
];
// 조별 우열이 없는(=A조/B조/C조·1조/2조식) 이름이면 순위표를 병렬 배치. (레전드/라이즈 등 우열 조는 세로 유지)
const isPeerGroupNames = (names) => { const g = (names || []).filter(Boolean); return g.length > 1 && g.every((n) => /^[A-Za-z0-9]+조$/.test(n)); };
// 병렬 그리드 클래스 — 조가 2개면 가로를 2열로 꽉 채우고(빈 3열 자리 없음), 3개 이상이면 3열.
const parallelGrid = (n) => (n <= 2
  ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
  : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6');
// 종료 대회별 팀 로고/표기 오버라이드 (당시 로고 사용). FST 당시 GEN은 예전 로고.
const PAST_TEAM_OVERRIDE = {
  fst: { GEN: { logo: gengSimpleLogo } },
};
// 대진 슬러그/이름 → 짧은 탭 라벨
const bracketLabel = (b) => {
  if (b.label) return b.label; // 커스텀 라벨(예: FST 녹아웃 스테이지)
  const s = (b.slug || '') + ' ' + (b.name || '');
  if (/knights|기사/i.test(s)) return '기사의 길';
  if (/swiss|스위스/i.test(s)) return '스위스';
  if (/play_?in|플레이[\s-]?인/i.test(s)) return /group|그룹/i.test(s) ? '플레이-인 그룹' : '플레이-인';
  if (/playoff|플레이오프/i.test(s)) return '플레이오프';
  return b.name || '대진';
};
// 과거 스플릿 대진 스테이지 목록(라벨·bracket). 라벨이 겹치면 뒤에 번호를 붙여 유일화 → 탭 중복/오매칭 방지.
const pastBracketStages = (d) => {
  const out = [];
  const used = {};
  for (const b of d?.brackets || []) {
    if (!(b.bracket?.rounds?.length || b.bracket?.sections?.length)) continue;
    let lb = bracketLabel(b);
    if (used[lb]) { used[lb] += 1; lb = `${lb} ${used[lb]}`; } else used[lb] = 1;
    out.push({ label: lb, bracket: b });
  }
  return out;
};
// 과거 스플릿의 스테이지 탭 목록(정규/그룹 → 각 대진 → 최종 순위)
// 완료된 스플릿의 단계 목록 — 데이터 객체({rows,brackets,finalStandings})에서 산출.
const pastSplitStagesFromData = (d) => {
  if (!d) return null;
  if (d.roadToMsi) return null; // Road to MSI: 세부 스테이지 탭 없이 참가팀 성적 + 대진 한 화면에 표기
  if (d.kespa) return ['예선', '본선', '결선']; // KeSPA CUP: 예선(3조)·본선(LCQ)·결선(더블엘리)
  if (d.kespa24) return ['조별리그', '퀄리피케이션 스테이지', '녹아웃 스테이지', '최종 순위']; // 2024 KeSPA CUP
  const stages = [];
  if (d.rows?.length) stages.push(d.regLabel || (d.rows.some((r) => r.group) ? '그룹 순위' : '정규시즌'));
  // 추가 순위 스테이지(예: 그룹 페이즈·럼블 스테이지). after 지정 시 해당 대진 스테이지 뒤에 삽입, 없으면 순위 바로 뒤.
  const afterMap = {};
  for (const ph of d.phaseStages || []) if (ph.rows?.length) { if (ph.after) (afterMap[ph.after] = afterMap[ph.after] || []).push(ph.label); else stages.push(ph.label); }
  for (const s of pastBracketStages(d)) { stages.push(s.label); for (const l of (afterMap[s.label] || [])) stages.push(l); }
  if (d.finalStandings?.length) stages.push('최종 순위');
  return stages.length ? stages : null;
};
const PastSplitView = ({ comp, data, stage, onTeamClick, teamOverride: teamOverrideProp }) => {
  if (!data) return <NotReady comp={comp} />;
  const rows = data.rows || [];
  const grouped = rows.some((r) => r.group);
  const regLabel = data.regLabel || (grouped ? '그룹 순위' : '정규시즌');
  const groupNames = grouped ? [...new Set(rows.map((r) => r.group))] : [null];
  const bracketForStage = pastBracketStages(data).find((s) => s.label === stage)?.bracket;
  const teamOverride = teamOverrideProp || PAST_TEAM_OVERRIDE[comp.key];

  // Road to MSI 커스텀 렌더 — 2026처럼 세부 스테이지 탭 없이 참가팀 성적(정규시즌 순위) + 사다리 대진을 함께 표기.
  if (data.roadToMsi) {
    const rtm = (data.brackets || []).find((b) => b.slug === 'road_to_msi' || /road/i.test(b.slug || ''));
    // 참가 팀 = 대진에 등장하는 팀만 (정규시즌 전체가 아니라 Road to MSI 진출 팀).
    const partSet = new Set();
    for (const r of (rtm?.bracket?.rounds || [])) for (const m of (r.matches || [])) for (const s of [m.a, m.b]) if (s?.short) partSet.add(s.short);
    const stdRows = rows.filter((r) => partSet.size === 0 || partSet.has(r.team)).map((r) => ({ short: r.team, rank: r.rank, w: r.w, l: r.l, games: (r.w || 0) + (r.l || 0) }));
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm"><span className="text-white/50">형식: <strong className="text-white/80">{data.name} · 정규시즌 → MSI로 가는 길 · 종료</strong></span></div>
        {stdRows.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline gap-2 flex-wrap"><h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">참가 팀</h3><span className="text-xs text-white/40">정규시즌 순위</span></div>
            <StandingsTable rows={stdRows} color={comp.color} onTeamClick={onTeamClick} teamOverride={teamOverride} />
          </section>
        )}
        {rtm && (
          <section>
            <div className="flex items-baseline gap-2 flex-wrap mb-4"><h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">MSI로 가는 길</h3><span className="text-xs text-white/40">실제 경기 결과</span></div>
            <MsiBracket rounds={rtm.bracket.rounds} totalRows={rtm.bracket.totalRows} connectors={rtm.bracket.connectors} onTeamClick={onTeamClick} teamOverride={teamOverride} />
            <BracketLegend goldLabel="MSI 진출" />
          </section>
        )}
      </div>
    );
  }

  // EWC 커스텀 렌더 — 그룹 스테이지(2개조 더블 엘리) / 플레이오프(8팀 싱글 엘리 + 3위전). 2026 라이브 렌더와 동일 형식.
  if (data.playoff) {
    const groupKeys = Object.keys(data.groups || {});
    if (stage === '그룹 스테이지' && groupKeys.length) {
      return (
        <section className="flex flex-col gap-5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">그룹 스테이지</h3>
            <span className="text-xs text-white/40">{groupKeys.length}개조 · 4팀 더블 엘리미네이션 · 조별 2팀 플레이오프 진출</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-6">
            {groupKeys.map((g) => data.groups[g] && (
              <div key={g}>
                <span className="inline-block text-xs font-black px-2 py-0.5 rounded mb-2" style={{ color: '#E8C77E', backgroundColor: 'rgba(200,150,62,0.2)' }}>{g}조</span>
                <MsiBracket rounds={data.groups[g].rounds} onTeamClick={onTeamClick} teamOverride={teamOverride} />
              </div>
            ))}
          </div>
          <BracketLegend goldLabel="플레이오프 진출" />
        </section>
      );
    }
    return (
      <section className="flex flex-col gap-8">
        <div>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">플레이오프</h3>
            <span className="text-xs text-white/40">8팀 싱글 엘리미네이션{data.champion ? ` · 우승 ${data.champion}` : ''}</span>
          </div>
          {(() => {
            const b = data.playoff.bracket;
            const thirdMatch = data.playoff.third?.rounds?.[0]?.matches?.[0];
            const rounds = thirdMatch
              ? b.rounds.map((r, i) => (i === b.rounds.length - 1
                ? { ...r, matches: [...r.matches, { ...thirdMatch, startRow: 6 }] }
                : r))
              : b.rounds;
            return <MsiBracket rounds={rounds} totalRows={b.totalRows} connectors={b.connectors} onTeamClick={onTeamClick} teamOverride={teamOverride} />;
          })()}
        </div>
        <BracketLegend goldLabel="우승" />
      </section>
    );
  }

  // 2024 KeSPA CUP 커스텀 렌더 — 조별리그(2개조·세트 평균 시간) / 퀄리피케이션(사다리) / 녹아웃(4팀 싱글 엘리) / 최종 순위
  if (data.kespa24) {
    // 국가 대표팀(TPE·VIE)은 국기 로고 — 대진 슬롯에도 적용
    const ov = { ...(teamOverride || {}), TPE: { name: '중화 타이베이', logo: nationFlag('TPE') }, VIE: { name: '베트남', logo: nationFlag('VIE') } };
    const disp = (c) => ov[c]?.tag || c;
    const logoOf = (c) => ov[c]?.logo || logoByShort[c];
    const legend = (gold) => (
      <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-white/50">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(232,199,126,0.7)' }} /> {gold}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.6)' }} /> 라운드 승리</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(248,113,113,0.6)' }} /> 탈락</span>
      </div>
    );
    if (stage === '조별리그') {
      const groupTable = (gk, rows) => (
        <div key={gk} className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{gk}조</h3>
            <span className="text-xs text-white/40">싱글 라운드로빈 · 상위 4팀 퀄리피케이션 진출</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="text-white/40 text-xs border-b border-white/10">
                <th className="text-center font-bold py-2 px-2 w-10">#</th>
                <th className="text-left font-bold py-2 pr-2">팀</th>
                <th className="text-center font-bold py-2 px-2">승-패</th>
                <th className="text-center font-bold py-2 px-2">세트 평균 시간</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.code} className="border-b border-white/5"
                    style={{ cursor: knownTeam(r.code) ? 'pointer' : undefined, backgroundColor: i < 4 ? 'rgba(96,165,250,0.08)' : undefined }}
                    onClick={(knownTeam(r.code) && onTeamClick) ? () => onTeamClick(r.code) : undefined}>
                    <td className="py-2 px-2 text-center text-white/50 font-mono">{i + 1}</td>
                    <td className="py-2 pr-2"><span className="inline-flex items-center gap-2 font-bold text-white/90"><TeamLogo src={logoOf(r.code)} size={16} />{disp(r.code)}</span></td>
                    <td className="py-2 px-2 text-center font-mono">{r.w}-{r.l}</td>
                    <td className="py-2 px-2 text-center font-mono text-white/40 text-xs">{r.time || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
      return (
        <section className="flex flex-col gap-6">
          <div className={parallelGrid(2)}>
            {groupTable('A', data.qual.A)}
            {groupTable('B', data.qual.B)}
          </div>
          <p className="text-[11px] text-white/40">각 조 상위 4팀(총 8팀)이 퀄리피케이션 스테이지에 진출합니다. 세트 평균 시간은 동률 시 순위 비교 기준입니다.</p>
        </section>
      );
    }
    if (stage === '퀄리피케이션 스테이지') {
      return (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">퀄리피케이션 스테이지</h3>
            <span className="text-xs text-white/40">사다리 방식 · 각 라운드 최상위 매치 승자 녹아웃 진출</span>
          </div>
          <MsiBracket rounds={data.fs1.rounds} totalRows={data.fs1.totalRows} connectors={data.fs1.connectors} onTeamClick={onTeamClick} teamOverride={ov} />
          {legend('녹아웃 스테이지 진출')}
        </section>
      );
    }
    if (stage === '녹아웃 스테이지') {
      return (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">녹아웃 스테이지</h3>
            <span className="text-xs text-white/40">4팀 싱글 엘리미네이션{data.champion ? ` · 우승 ${disp(data.champion)}` : ''}</span>
          </div>
          <MsiBracket rounds={data.fs2.rounds} connectors={data.fs2.connectors} onTeamClick={onTeamClick} teamOverride={ov} />
          {legend('우승')}
        </section>
      );
    }
    return (
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">최종 순위</h3>
          <span className="text-xs text-white/40">우승 {disp(data.champion)}</span>
        </div>
        <StandingsTable rows={data.finalStandings.map((f) => ({ short: f.team, rank: f.rank }))} color={comp.color} cols={{ minimal: true }} onTeamClick={onTeamClick} teamOverride={ov} />
      </section>
    );
  }

  // KeSPA CUP 커스텀 렌더 — 예선(3조·H2H) / 본선(LCQ·세트득실) / 결선(4팀 더블엘리)
  if (data.kespa) {
    const disp = (code) => teamOverride?.[code]?.tag || code;
    const logoOf = (code) => nationFlag(code) || teamOverride?.[code]?.logo || logoByShort[code];
    const click = (code) => ((knownTeam(code) && onTeamClick) ? () => onTeamClick(code) : undefined);
    const TeamCell = ({ code }) => (
      <span className="inline-flex items-center gap-2 font-bold text-white/90"><TeamLogo src={logoOf(code)} size={18} />{disp(code)}</span>
    );
    const fmt = <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm"><span className="text-white/50">형식: <strong className="text-white/80">{data.name} · 예선(3개조) → 본선(LCQ) → 결선(더블 엘리) · 종료</strong></span></div>;
    if (stage === '예선') {
      const groupTable = (gk, list) => (
        <div key={gk} className="flex flex-col gap-2">
          <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{gk}조</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="text-white/40 text-xs border-b border-white/10">
                <th className="text-center font-bold py-2 px-2 w-9">#</th>
                <th className="text-left font-bold py-2 pr-2">팀</th>
                <th className="text-center font-bold py-2 px-2 w-9">승</th>
                <th className="text-center font-bold py-2 px-2 w-9">패</th>
                <th className="text-center font-bold py-2 px-2">H2H</th>
              </tr></thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={r.code} className="border-b border-white/5"
                    style={{ cursor: knownTeam(r.code) ? 'pointer' : undefined, backgroundColor: i === 0 ? 'rgba(96,165,250,0.12)' : i === 1 ? 'rgba(74,222,128,0.10)' : undefined }}
                    onClick={click(r.code)}>
                    <td className="py-2 px-2 text-center text-white/50 font-mono">{i + 1}</td>
                    <td className="py-2 pr-2"><TeamCell code={r.code} /></td>
                    <td className="py-2 px-2 text-center font-mono">{r.w}</td>
                    <td className="py-2 px-2 text-center font-mono">{r.l}</td>
                    <td className="py-2 px-2 text-center font-mono text-white/50 text-xs">{r.h2h || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
      return (
        <div className="flex flex-col gap-8">
          {fmt}
          <section className="flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupTable('A', data.qual.A)}{groupTable('B', data.qual.B)}{groupTable('C', data.qual.C)}
            </div>
            <div className="flex flex-wrap gap-4 text-[11px] text-white/50">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.5)' }} /> 결선 진출(조 1위)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(74,222,128,0.4)' }} /> 본선 진출(조 2위)</span>
            </div>
          </section>
        </div>
      );
    }
    if (stage === '본선') {
      return (
        <div className="flex flex-col gap-8">
          {fmt}
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">본선 (LCQ)</h3>
              <span className="text-xs text-white/40">각 조 2위 3팀 싱글 라운드로빈 · 1위 결선 진출</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead><tr className="text-white/40 text-xs border-b border-white/10">
                  <th className="text-center font-bold py-2 px-2 w-9">#</th>
                  <th className="text-left font-bold py-2 pr-2">팀</th>
                  <th className="text-center font-bold py-2 px-2 w-9">승</th>
                  <th className="text-center font-bold py-2 px-2 w-9">패</th>
                  <th className="text-center font-bold py-2 px-2">세트 득실</th>
                  <th className="text-center font-bold py-2 px-2">득실차</th>
                </tr></thead>
                <tbody>
                  {data.lcq.map((r, i) => {
                    const gd = (r.gw || 0) - (r.gl || 0);
                    return (
                      <tr key={r.code} className="border-b border-white/5"
                        style={{ cursor: knownTeam(r.code) ? 'pointer' : undefined, backgroundColor: i === 0 ? 'rgba(96,165,250,0.12)' : undefined }}
                        onClick={click(r.code)}>
                        <td className="py-2 px-2 text-center text-white/50 font-mono">{i + 1}</td>
                        <td className="py-2 pr-2"><TeamCell code={r.code} /></td>
                        <td className="py-2 px-2 text-center font-mono">{r.w}</td>
                        <td className="py-2 px-2 text-center font-mono">{r.l}</td>
                        <td className="py-2 px-2 text-center font-mono text-white/60">{r.gw}-{r.gl}</td>
                        <td className="py-2 px-2 text-center font-mono text-white/60">{gd > 0 ? `+${gd}` : gd}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-white/50"><span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(96,165,250,0.5)' }} /> 결선 진출</span></div>
          </section>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-8">
        {fmt}
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">결선</h3>
            <span className="text-xs text-white/40">4팀 더블 엘리미네이션{data.champion ? ` · 우승 ${disp(data.champion)}` : ''}</span>
          </div>
          <MsiBracket rounds={data.knockout.rounds} totalRows={data.knockout.totalRows} connectors={data.knockout.connectors} onTeamClick={onTeamClick} teamOverride={teamOverride} />
          <BracketLegend />
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-white/50">형식: <strong className="text-white/80">{data.name} · 종료</strong></span>
      </div>

      {stage === '최종 순위' && data.finalStandings?.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">최종 순위</h3>
            <span className="text-xs text-white/40">우승 {data.finalStandings[0]?.team}</span>
          </div>
          <StandingsTable rows={data.finalStandings.map((f) => ({ short: f.team, rank: f.rank }))} color={comp.color} cols={{ minimal: true }} onTeamClick={onTeamClick} teamOverride={teamOverride} />
        </section>
      )}

      {stage === regLabel && rows.length > 0 && (
        <section className="flex flex-col gap-5">
          <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{grouped ? (data.regLabel || '그룹 순위') : '정규시즌 순위'}</h3>
          <div className={(isPeerGroupNames(groupNames) || data.parallelGroups) ? parallelGrid(groupNames.length) : 'flex flex-col gap-5'}>
          {groupNames.map((g, gi) => {
            const grpRows = rows.filter((r) => g == null || r.group === g).map((r) => ({
              short: r.team, rank: r.rank, w: r.w, l: r.l, games: (r.w || 0) + (r.l || 0),
              gd: r.gw != null && r.gl != null ? r.gw - r.gl : null,
            }));
            const badge = PAST_GROUP_BADGES[gi % PAST_GROUP_BADGES.length];
            return (
              <div key={g || 'all'}>
                {g && <span className="inline-block text-xs font-black px-2 py-0.5 rounded mb-2" style={{ color: badge.color, backgroundColor: badge.bg }}>{g}</span>}
                <StandingsTable rows={grpRows} color={comp.color} hasDiff={grpRows.some((r) => r.gd != null)} onTeamClick={onTeamClick} teamOverride={teamOverride} />
              </div>
            );
          })}
          </div>
        </section>
      )}

      {(data.phaseStages || []).map((ph) => stage === ph.label && ph.rows?.length > 0 && (() => {
        // 상대 로고 표시형 순위표(예: LTA 픽 앤 플레이 페이즈) — 승-패·세트 득실차·만난 상대 로고.
        if (ph.showOpponents) {
          const disp = (c) => teamOverride?.[c]?.tag || c;
          const logoOf = (c) => teamOverride?.[c]?.logo || logoByShort[c];
          return (
            <section key={ph.label} className="flex flex-col gap-4">
              <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{ph.label}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="text-white/40 text-xs border-b border-white/10">
                    <th className="text-center font-bold py-2 px-2 w-9">#</th>
                    <th className="text-left font-bold py-2 pr-2">팀</th>
                    <th className="text-center font-bold py-2 px-2">승-패</th>
                    <th className="text-center font-bold py-2 px-2">득실차</th>
                    <th className="text-right font-bold py-2 px-2">상대</th>
                  </tr></thead>
                  <tbody>
                    {ph.rows.map((r) => {
                      const gd = (r.gw || 0) - (r.gl || 0);
                      return (
                        <tr key={r.team} className="border-b border-white/5"
                          style={{ cursor: knownTeam(r.team) ? 'pointer' : undefined }}
                          onClick={(knownTeam(r.team) && onTeamClick) ? () => onTeamClick(r.team) : undefined}>
                          <td className="py-2 px-2 text-center text-white/50 font-mono">{r.rank}</td>
                          <td className="py-2 pr-2"><span className="inline-flex items-center gap-2 font-bold text-white/90"><TeamLogo src={logoOf(r.team)} size={18} />{disp(r.team)}</span></td>
                          <td className="py-2 px-2 text-center font-mono">{r.w}-{r.l}</td>
                          <td className="py-2 px-2 text-center font-mono text-white/60">{gd > 0 ? `+${gd}` : gd}</td>
                          <td className="py-2 px-2"><span className="flex items-center gap-1.5 justify-end">{(r.opps || []).map((o, i) => <TeamLogo key={i} src={logoOf(o)} size={16} />)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        }
        const names = [...new Set(ph.rows.map((r) => r.group))];
        const parallel = isPeerGroupNames(names);
        return (
          <section key={ph.label} className="flex flex-col gap-5">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{ph.label}</h3>
            <div className={parallel ? parallelGrid(names.length) : 'flex flex-col gap-5'}>
              {names.map((g, gi) => {
                const grpRows = ph.rows.filter((r) => r.group === g).map((r) => ({
                  short: r.team, rank: r.rank, w: r.w, l: r.l, games: (r.w || 0) + (r.l || 0),
                }));
                const badge = PAST_GROUP_BADGES[gi % PAST_GROUP_BADGES.length];
                return (
                  <div key={g}>
                    {g && <span className="inline-block text-xs font-black px-2 py-0.5 rounded mb-2" style={{ color: badge.color, backgroundColor: badge.bg }}>{g}</span>}
                    <StandingsTable rows={grpRows} color={comp.color} onTeamClick={onTeamClick} teamOverride={teamOverride} />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })())}

      {bracketForStage && (
        <section>
          <div className="flex items-baseline gap-2 flex-wrap mb-4">
            <h3 className="text-sm font-black text-[#E8C77E] uppercase tracking-wider">{bracketForStage.label || bracketForStage.name}</h3>
            <span className="text-xs text-white/40">실제 경기 결과</span>
          </div>
          {/swiss|스위스/i.test(bracketForStage.slug || bracketForStage.name) ? (
            <SwissBracket swiss={bracketForStage.bracket} onTeamClick={onTeamClick} teamOverride={teamOverride} />
          ) : bracketForStage.bracket.sections ? (
            <BracketGroup sections={bracketForStage.bracket.sections} crossConnectors={bracketForStage.bracket.crossConnectors} onTeamClick={onTeamClick} teamOverride={teamOverride} />
          ) : (
            <MsiBracket rounds={bracketForStage.bracket.rounds} totalRows={bracketForStage.bracket.totalRows} connectors={bracketForStage.bracket.connectors} onTeamClick={onTeamClick} teamOverride={teamOverride} />
          )}
          <BracketLegend />
        </section>
      )}
    </div>
  );
};

const GPR_TAB = { key: 'gpr', name: 'GPR 순위', scope: 'data', color: '#E8C77E' };

// 탭 로고 (LoL Esports / 각 대회). 출처: static.lolesports.com
const LOLESPORTS_LOGO = 'https://static.lolesports.com/leagues/1693555886600_lolesports_icon_ice-01.png';
const COMP_LOGO = {
  lck: 'https://static.lolesports.com/leagues/lck-color-on-black.png',
  lpl: 'https://static.lolesports.com/leagues/1592516115322_LPL-01-FullonDark.png',
  lec: 'https://static.lolesports.com/leagues/1592516184297_LEC-01-FullonDark.png',
  lcp: 'https://static.lolesports.com/leagues/1733468139601_lcp-color-golden.png',
  lcs: 'https://static.lolesports.com/leagues/1706356907418_LCSNew-01-FullonDark.png',
  cblol: 'https://static.lolesports.com/leagues/cblol-logo-symbol-offwhite.png',
  fst: 'https://static.lolesports.com/leagues/1740042025201_RG_LOL_FIRST_STAND_LOGO_VOLT_ALPHA.png',
  msi: 'https://static.lolesports.com/leagues/1592594634248_MSIDarkBG.png',
  demacia: demaciaLogo,
  worlds: 'https://static.lolesports.com/leagues/1592594612171_WorldsDarkBG.png',
  asiangames: asiangamesLogo,
  ewc: ewcLogo,
};
// 대회 상세(헤더)에서 탭 기본 로고 대신 쓸 에디션별 로고. 없으면 COMP_LOGO 사용.
//   AG는 탭에는 기본 아시안게임 로고, 상세에는 해당 에디션(2026 Aichi-Nagoya) 로고를 표기.
const COMP_DETAIL_LOGO = {
  asiangames: asiangames2026Logo,
};
// 서브탭별 상세 헤더 오버라이드(로고·상징색) — 리그 안의 별도 대회(예: KeSPA CUP)에 사용.
const SUBTAB_DETAIL = {
  'lck|KeSPA CUP': { color: '#072148', logo: kespa2026Logo },
  'lck|LCK CUP': { color: '#2a45b3' },
};
// 과거 연도 대회의 상세 헤더 로고·상징색 오버라이드 (`key|year`). 예: 2025 LCS = LTA North.
// 과거 연도 상세 헤더 로고·상징색. bySub로 스플릿별 오버라이드(통합 스플릿=LTA).
const PAST_DETAIL = {
  'lcs|2025': { color: '#3483F0', logo: ltaNorthLogo, bySub: { 'Split 1': { color: '#b2a27e', logo: ltaLogo }, 'Playoffs': { color: '#b2a27e', logo: ltaLogo } } },
  'cblol|2025': { color: '#D94F30', logo: ltaSulLogo, bySub: { 'Etapa 1': { color: '#b2a27e', logo: ltaLogo }, 'Playoffs': { color: '#b2a27e', logo: ltaLogo } } },
  'lck|2025': { bySub: { 'LCK CUP': { color: '#7f6b00' }, 'KeSPA CUP': { color: '#072148', logo: kespa2025Logo } } },
  'lck|2024': { bySub: { 'KeSPA CUP': { color: '#072148' } } },
  'demacia|2024': { color: '#446aca', gradient: 'linear-gradient(180deg, #446aca, #61a1ea)', logo: demaciaCupLogo, invert: true }, // 2025 Demacia Cup과 동일
  'fst|2025': { color: '#45002c' },
  'ewc|2025': { color: '#eaeaea', logo: ewcLogo },
  'ewc|2024': { color: '#eaeaea', logo: ewcLogo },
  'msi|2025': { color: '#fe0000' }, // MSI 기본색은 #191919로 변경, 2025 상징색은 유지
  'msi|2024': { color: '#000000' },
  'worlds|2025': { color: '#0e2bf4' },
  'worlds|2024': { color: '#010a42' },
};
// 연도 내 세부 대회(event)별 상세 헤더 로고·상징색 (`key|year|event`).
const EVENT_DETAIL = {
  'demacia|2025|ASI': { color: '#7927ff', logo: asiLogo },
  'demacia|2025|Demacia Cup': { color: '#446aca', gradient: 'linear-gradient(180deg, #446aca, #61a1ea)', logo: demaciaCupLogo, invert: true }, // 검은 로고 → 흰색 반전, 상하 그라데이션(위 #446aca → 아래 #61a1ea)
  'lcp|2024|VCS': { color: '#f0fea6', logo: vcsLogo }, // 검은 로고 그대로 표시
  'lcp|2024|PCS': { color: '#101725', logo: pcsLogo },
  'lcp|2024|LJL': { color: '#ed1b30', logo: ljlLogo, invert: true },
  'lcp|2024|LCO': { color: '#0f3341', logo: lcoLogo },
  'cblol|2020|LLA': { color: '#ff6528', logo: llaLogo, invert: true },
  'cblol|2021|LLA': { color: '#ff6528', logo: llaLogo, invert: true },
  'cblol|2022|LLA': { color: '#ff6528', logo: llaLogo, invert: true },
  'cblol|2023|LLA': { color: '#ff6528', logo: llaLogo, invert: true },
  'cblol|2024|LLA': { color: '#ff6528', logo: llaLogo, invert: true },
};
const tabLogo = (key) => (key === 'gpr' ? LOLESPORTS_LOGO : COMP_LOGO[key]);
// 탭 상징색 오버라이드 — 에디션 상세 색(comp.color)과 별개로 탭에만 적용. AG 일반 색은 #ffb732(2026 상세는 유지).
// 탭 상징색 오버라이드 — 비우면 각 대회 comp.color(가장 최근 에디션 색)를 그대로 탭에 사용.
const TAB_COLOR = {};
// 대회 상징색 그라데이션 (탭·헤더 로고 박스) — 좌→우. 지정 시 단색 대신 그라데이션 사용.
const COMP_GRADIENT = { ewc: 'linear-gradient(90deg, #f74e16, #d1b36f)' };

// 지역 리그별 세부 대회 (2026 기준)
const SUBTABS = {
  lck: ['LCK CUP', 'LCK', 'Road to MSI', 'KeSPA CUP'],
  lpl: ['Split 1', 'Split 2', 'Split 3', '대표 선발전'],
  lec: ['Versus', 'Spring', 'Summer'],
  lcp: ['Split 1', 'Split 2', 'Split 3'],
  lcs: ['Lock-In', 'Spring', 'Summer'],
  cblol: ['Copa', 'Split 1', 'Split 2'],
};
// 세부 대회 기본 선택(현재 진행/직전 완료된 대회)
const SUBTAB_DEFAULT = { lck: 'LCK', lpl: '대표 선발전', lec: 'Summer', lcp: 'Split 3', lcs: 'Summer', cblol: 'Split 2' };
// 아직 시작하지 않은 세부 대회 → "예정" 표시
const SUB_UPCOMING = {};
// 세부 대회별 상태 배지 오버라이드 — 리그 전체 상태(comp.status)와 무관하게 표시할 값
const SUB_STATUS = {
  'lpl|Split 1': 'finished',
  'lpl|Split 2': 'finished',
  'lpl|Split 3': 'finished',
  'lpl|대표 선발전': 'upcoming',
  'lec|Versus': 'finished',
  'lec|Spring': 'finished',
  'lec|Summer': 'ongoing',
  'lcp|Split 1': 'finished',
  'lcp|Split 2': 'finished',
  'lcp|Split 3': 'finished',
  'lcs|Lock-In': 'finished',
  'lcs|Spring': 'finished',
  'lcs|Summer': 'ongoing',
  'cblol|Copa': 'finished',
  'cblol|Split 1': 'finished',
  'cblol|Split 2': 'ongoing',
  'lck|Road to MSI': 'finished',
  'lck|LCK CUP': 'finished',
  'lck|KeSPA CUP': 'finished',
};
// 세부대회 안에서 단계(스테이지) 선택 — `${comp.key}|${sub}` → 단계 목록
const STAGE_TABS = {
  'lck|LCK CUP': ['그룹 스테이지', '플레이-인', '플레이오프', '최종 순위'],
  'lck|LCK': ['정규시즌', '플레이-인', '플레이오프', '최종 순위'],
  'lck|KeSPA CUP': ['예선', '결선 스테이지 1', '결선 스테이지 2'],
  'lpl|Split 3': ['럼블 스테이지', '기사의 길', '플레이오프', '최종 순위'],
  'lec|Summer': ['정규시즌', '플레이오프', '최종 순위'],
  'lcs|Summer': ['정규시즌', '플레이오프', '최종 순위'],
  'cblol|Split 2': ['정규시즌', '플레이오프', '최종 순위'],
  'lpl|대표 선발전': ['대진', '챔피언십 포인트'],
  demacia: ['그룹 스테이지', '녹아웃 스테이지'],
  'lcp|Split 3': ['스위스 스테이지', '플레이-인 스테이지', '플레이오프', '최종 순위'],
  worlds: ['플레이-인', '스위스 스테이지', '녹아웃 스테이지'],
  asiangames: ['그룹 스테이지', '녹아웃 스테이지'],
  ewc: ['그룹 스테이지', '플레이오프'],
  msi: ['플레이-인 스테이지', '브래킷 스테이지'],
};
// 기본 선택 단계(탭 순서와 별개로 진입 시 표시할 단계) — 없으면 첫 단계
const STAGE_DEFAULT = {
  'lck|LCK CUP': '최종 순위',
  'lck|LCK': '최종 순위',
  'lck|KeSPA CUP': '결선 스테이지 2',
  'lpl|Split 3': '플레이오프',
  'lec|Summer': '플레이오프',
  'lcs|Summer': '플레이오프',
  'cblol|Split 2': '플레이오프',
  ewc: '플레이오프',
  msi: '브래킷 스테이지',
};

// ── 대회 연도(에디션) 선택 ─────────────────────────────────────────────
// 현재 시즌 연도. lolSim.json 의 대회명에 이 연도가 들어있다(예: "2026 LCK").
const CURRENT_YEAR = 2026;
// 대회별 선택 가능한 연도(내림차순, 첫 항목 = 현재 시즌).
// 현재 연도 외에는 아직 결과 데이터가 없어 '준비 중'으로 표시된다.
// 과거 결과는 PAST_EDITIONS 에 등록하면 자동으로 최종 순위가 노출된다.
// AG는 에디션별 명칭/로고가 달라 단일 연도만 두어 드롭다운을 숨긴다.
const COMP_EDITIONS = {
  lck: [2026, 2025],
  lpl: [2026, 2025],
  lec: [2026, 2025],
  lcs: [2026, 2025],
  lcp: [2026, 2025, 2024],
  cblol: [2026, 2025],
  fst: [2026, 2025],
  msi: [2026, 2025],
  demacia: [2026, 2025, 2024],
  worlds: [2026, 2025],
  ewc: [2026, 2025, 2024],
};
// 선택 가능한 연도 = 수기 기준(COMP_EDITIONS: demacia/fst 등 특수 2025) + 생성된 과거 데이터의 모든 연도.
const editionYears = (key) => {
  const years = new Set(COMP_EDITIONS[key] || [CURRENT_YEAR]);
  for (const y of Object.keys(PAST_STANDINGS)) if (PAST_STANDINGS[y]?.[key]) years.add(Number(y));
  return [...years].sort((a, b) => b - a);
};
// 과거 연도 결과: `${key}|${year}` → { finalResult: { champion, runnerUp, standings:[{rank,team,note}] } }
// 여기에 항목을 추가하면 해당 연도 선택 시 ResultView 로 최종 순위가 자동 표시된다.
// 예) 'worlds|2025': { finalResult: { champion: 'T1', runnerUp: 'BLG', standings: [{ rank: 1, team: 'T1' }] } },
// 과거 연도 전체 데이터(순위표·대진·최종순위) — lolPastEditions.json(API로 생성).
// 연도 → 리그 → (서브탭 있으면) 서브탭별 데이터 / (없으면) 단일 데이터.
const PAST_STANDINGS = pastEditionsData.standings || {};
const PAST_SUBTABS = pastEditionsData.subtabs || {};
// 과거 연도의 리그 서브탭 목록(없으면 단일 대회).
// 대회 선택형(예: 2024 LCP=PCS/VCS)은 이벤트별 서브탭 목록({ev:[...]}) → 선택된 이벤트 기준.
const pastSubTabs = (key, year, ev) => {
  const v = PAST_SUBTABS[String(year)]?.[key];
  if (v && !Array.isArray(v)) return (ev && v[ev]) || null;
  return v || null;
};
// 과거 연도의 리그 데이터 해석. 서브탭이 있으면 sub별, 없으면 단일.
const resolvePastData = (key, sub, year, ev) => {
  const lg = PAST_STANDINGS[String(year)]?.[key];
  if (!lg) return null;
  const base = (ev && lg[ev]) ? lg[ev] : lg; // 대회 선택(이벤트) → 해당 이벤트 데이터
  return sub ? base[sub] : base;
};
// 연도 옆 '대회 선택'(통합/분리 시 사용) — DCGI 2025는 통합 전 ASI / Demacia Cup 두 대회.
const YEAR_SUBEVENTS = { 'demacia|2025': ['Demacia Cup', 'ASI'], 'lcp|2024': ['PCS', 'LJL', 'LCO', 'VCS'] };
// 세부 대회 선택 시 헤더에 표기할 대회 정식 명칭
const SUBEVENT_NAMES = { ASI: 'Asia Invitational', 'Demacia Cup': 'Demacia Cup' };

// 연도 선택 드롭다운 — 네이티브 select는 항목이 많으면 브라우저가 위로 펼쳐서, 항상 아래로 펼치는 커스텀 구현.
// 연도·세부 대회 선택에 공용 사용(ariaLabel로 구분).
const YearDropdown = ({ years, value, onChange, ariaLabel = '대회 연도 선택' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div className="relative ml-1" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-black bg-white/10 border border-white/20 text-white hover:border-white/40 focus:outline-none focus:border-[#C8963E] cursor-pointer"
      >
        {value}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 mt-1 z-50 max-h-64 overflow-y-auto rounded-lg border border-white/20 bg-[#1e2328] shadow-xl msi-scroll"
        >
          {years.map((y) => (
            <button
              key={y}
              type="button"
              role="option"
              aria-selected={y === value}
              onClick={() => { onChange(y); setOpen(false); }}
              className={`block w-full text-left px-4 py-1.5 text-sm font-black whitespace-nowrap ${
                y === value ? 'bg-[#C8963E] text-[#1e2328]' : 'text-white hover:bg-white/10'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const PredictionPage = () => {
  const comps = sim.competitions;
  const tabs = [GPR_TAB, ...comps];
  const validKeys = useMemo(() => [GPR_TAB.key, ...comps.map((c) => c.key)], [comps]);

  // 탭 = URL 경로(/lol/prediction/:tab), 세부 대회 = 쿼리(?sub=) → 새로고침해도 유지
  const { tab } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTeam, setSelectedTeam] = useState(null);
  const handleTeamClick = (rawShort) => {
    const short = linkTeam(rawShort); // 과거 코드(TS·TW 등) → 현재 팀
    if (selectedTeam === short) {
      navigate(`/lol/prediction/team/${short}`);
    } else {
      setSelectedTeam(short);
    }
  };

  const activeKey = tab && validKeys.includes(tab) ? tab : 'gpr';
  // 알 수 없는 탭 경로는 기본 탭으로 정리
  useEffect(() => {
    if (tab && !validKeys.includes(tab)) navigate('/lol/prediction/gpr', { replace: true });
  }, [tab, validKeys, navigate]);

  const setActiveKey = (key) => navigate(`/lol/prediction/${key}`);

  const isGpr = activeKey === 'gpr';
  const comp = useMemo(() => comps.find((c) => c.key === activeKey), [comps, activeKey]);
  // 대회 연도(에디션) 선택 — 서브탭/데이터 해석보다 먼저 필요. `?year=` 로 유지(현재 연도는 생략)
  const years = comp ? editionYears(comp.key) : [CURRENT_YEAR];
  const yearParam = Number(searchParams.get('year'));
  const activeYear = years.includes(yearParam) ? yearParam : CURRENT_YEAR;
  const isCurrentYear = activeYear === CURRENT_YEAR;
  const setActiveYear = (y) =>
    setSearchParams((p) => {
      const n = new URLSearchParams(p);
      if (y === CURRENT_YEAR) n.delete('year'); else n.set('year', String(y));
      n.delete('sub'); n.delete('stage'); // 연도마다 서브탭 구성이 달라 초기화
      return n;
    }, { replace: true });
  // 연도 옆 '대회 선택'(통합/분리 시 사용) — DCGI 2025 = ASI/Demacia Cup. 지정 케이스에만 노출.
  // 대회 선택 목록 — 수기 지정(YEAR_SUBEVENTS) 또는 이벤트형 서브탭 데이터({CBLOL:[…], LLA:[…]})의 키.
  const subEvents = comp && !isCurrentYear
    ? (YEAR_SUBEVENTS[`${comp.key}|${activeYear}`] || (() => {
      const v = PAST_SUBTABS[String(activeYear)]?.[comp.key];
      return v && !Array.isArray(v) ? Object.keys(v) : null;
    })())
    : null;
  const eventParam = searchParams.get('event');
  const activeEvent = subEvents ? (subEvents.includes(eventParam) ? eventParam : subEvents[0]) : null;
  const setActiveEvent = (e) => setSearchParams((p) => { const n = new URLSearchParams(p); n.set('event', e); return n; }, { replace: true });

  // 서브탭 — 연도별. 현재 연도는 SUBTABS, 과거 연도는 생성된 목록(없으면 단일 대회).
  const subTabs = comp ? (isCurrentYear ? SUBTABS[comp.key] : pastSubTabs(comp.key, activeYear, activeEvent)) : null;
  const subParam = searchParams.get('sub');
  const defaultSub = comp && subTabs ? (isCurrentYear ? (SUBTAB_DEFAULT[comp.key] || subTabs[0]) : subTabs[0]) : null;
  const activeSub = subTabs ? (subParam && subTabs.includes(subParam) ? subParam : defaultSub) : null;
  const setActiveSub = (s) => setSearchParams((p) => { const n = new URLSearchParams(p); n.set('sub', s); n.delete('stage'); return n; }, { replace: true });
  const subUpcoming = !!(comp && activeSub && isCurrentYear && SUB_UPCOMING[comp.key]?.includes(activeSub));
  // 세부 대회별 상태 오버라이드(현재 연도만). 과거 연도는 '종료'.
  // 상태 자동 판정 — 해당 세부대회의 최종 대진(플레이오프 등)에서 우승이 확정되면 '종료'로 자동 전환.
  //   (SUB_STATUS 수기 값보다 우선. 우승 미확정이면 수기 값 사용.)
  const curSubDataForStatus = comp && activeSub && isCurrentYear ? officialStandings.standings[comp.key]?.[activeSub] : null;
  // 선발전(대표 선발전)처럼 finalStandings 없이 qualifier 대진만 있는 경우: 대진 완료 여부로 상태 자동 판정.
  const qMatches = (curSubDataForStatus?.qualifier?.rounds || []).flatMap((r) => r.matches || []);
  const isDecided = (m) => !!(m.a?.win || m.b?.win || m.a?.msi || m.b?.msi || (m.a?.score != null && m.b?.score != null && m.a.score !== m.b.score));
  const qDone = qMatches.length > 0 && qMatches.every(isDecided);
  const qStarted = qMatches.some(isDecided);
  const subAutoFinished = curSubDataForStatus?.finalStandings?.[0]?.note === '우승' || qDone;
  const subAutoStatus = subAutoFinished ? 'finished' : (qStarted ? 'ongoing' : null);
  const subStatus = comp && activeSub && isCurrentYear ? (subAutoStatus || SUB_STATUS[`${comp.key}|${activeSub}`]) : null;
  const st = comp ? (statusMeta[subStatus || comp.status] || statusMeta.upcoming) : null;
  // 서브탭별 상세 헤더 오버라이드(로고·상징색) — 현재 연도만
  const subDetail = comp && activeSub && isCurrentYear ? SUBTAB_DETAIL[`${comp.key}|${activeSub}`] : null;
  // 상세 헤더 로고·상징색: 현재 연도는 서브탭 오버라이드, 과거 연도는 연도별 오버라이드(예: 2025 LTA)
  const pastDetailRaw = comp && !isCurrentYear ? PAST_DETAIL[`${comp.key}|${activeYear}`] : null;
  const pastDetail = pastDetailRaw ? { ...pastDetailRaw, ...(pastDetailRaw.bySub?.[activeSub] || {}) } : null;
  // LJL·LCO의 'PCS PO' 스테이지 선택 시 헤더는 PCS(로고·상징색·대회명)로 표기.
  const pcsPoView = !!(comp?.key === 'lcp' && !isCurrentYear && (activeEvent === 'LJL' || activeEvent === 'LCO') && /^PCS PO/.test(searchParams.get('stage') || ''));
  const eventDetail = comp && !isCurrentYear && activeEvent ? EVENT_DETAIL[`${comp.key}|${activeYear}|${pcsPoView ? 'PCS' : activeEvent}`] : null;
  const headerDetail = subDetail || eventDetail || pastDetail;

  // 과거 연도 전체 데이터(순위표·대진·최종순위). 단일 대회는 sub=null.
  const pastData = comp && !isCurrentYear ? resolvePastData(comp.key, activeSub, activeYear, activeEvent) : null;
  const pastFull = !isCurrentYear && !!pastData;
  // 팀 표기 오버라이드: KRX→DRX(명칭·로고), GEN→옛 로고, DNS→DN FREECS 등. + LPL Split 1·2는 BLG→풀네임.
  //   2026(현재)에서 바뀐 최신 브랜딩이 2024 이하 과거 대회로 새어나가지 않도록, 가장 예전 브랜딩(2025 오버라이드)을
  //   2025 이하 모든 과거 연도에 적용한다.
  const pastTeamOverride = (() => {
    if (activeYear > 2025) return undefined;
    const ov = { ...TEAM_OVERRIDE_2025 };
    if (comp?.key === 'lpl') {
      // BLG: 2024 Summer부터 2025 Split 2까지 'Bilibili Gaming Dreamsmart'.
      if ((activeYear === 2024 && activeSub === 'Summer') || (activeYear === 2025 && (activeSub === 'Split 1' || activeSub === 'Split 2')))
        ov.BLG = { name: 'Bilibili Gaming Dreamsmart' };
      if (activeYear === 2025 && activeSub === 'Split 1') ov.JDG = { name: 'Beijing JDG Intel Esports' };
    }
    // JDG: 2024 LPL Spring까지 'JDG Intel Esports Club', 2024 LPL Summer·선발전은 'JDG Intel Esports'
    //   (2025 Split 1의 'Beijing JDG Intel Esports'와 다름).
    if (activeYear < 2024 || (activeYear === 2024 && comp?.key === 'lpl' && activeSub === 'Spring')) ov.JDG = { name: 'JDG Intel Esports Club' };
    else if (activeYear === 2024) ov.JDG = { name: 'JDG Intel Esports' };
    // EDG: 2024 이하는 'Edward Gaming Hycan'.
    if (activeYear <= 2024) ov.EDG = { name: 'Edward Gaming Hycan' };
    // WBG: 2024 LPL Spring까지 'Weibo Gaming Faw Audi'(2025는 'Weibo Gaming TapTap', TEAM_OVERRIDE_2025).
    if (activeYear < 2024 || (activeYear === 2024 && comp?.key === 'lpl' && activeSub === 'Spring')) ov.WBG = { name: 'Weibo Gaming Faw Audi' };
    // LNG: 2025 LPL Split 1까지 'LNG Ninebot Esports'.
    if (activeYear < 2025 || (activeYear === 2025 && comp?.key === 'lpl' && activeSub === 'Split 1')) ov.LNG = { name: 'LNG Ninebot Esports' };
    // Fluxo: 이름은 2025 시즌부터 Fluxo W7M(2024 이하만 'Fluxo'), 로고는 2025 시즌까지 옛 로고.
    //   2024 이하는 이름 'Fluxo' + 2024 로고, 2025는 2025 로고.
    if (activeYear <= 2024) ov.FX = { name: 'Fluxo', logo: fluxo2024Logo };
    else if (activeYear === 2025) ov.FX = { logo: fluxo2025Logo };
    // TL(TLAW): 2025 Split 1까지 'Team Liquid Honda', 그 이후는 'Team Liquid'(TEAM_OVERRIDE_2025 기본값).
    if (ov.TLAW && (activeYear < 2025 || (activeYear === 2025 && comp?.key === 'lcs' && activeSub === 'Split 1')))
      ov.TLAW = { ...ov.TLAW, name: 'Team Liquid Honda' };
    // PSG: 평소 'PSG Talon'이지만 2025 LCP Kickoff 당시엔 'Talon Esports'(TLN).
    if (comp?.key === 'lcp' && activeYear === 2025 && activeSub === 'Kickoff')
      ov.PSG = { tag: 'TLN', name: 'Talon Esports', logo: talonEsportsLogo };
    // MVK: 2024 이하는 VKE(Vikings Esports), 2025는 MVKE(MGN Vikings Esports). 2026부터 기본 'MVK Esports'.
    if (activeYear <= 2024) ov.MVK = { tag: 'VKE', name: 'Vikings Esports', logo: mvkeLogo };
    else if (activeYear === 2025) ov.MVK = { tag: 'MVKE', name: 'MGN Vikings Esports', logo: mvkeLogo };
    // VCS 2024 이하: Team Secret(TS)·Team Whales(TW) — 2025에 합병해 TSW(클릭 시 TSW로 연결, TEAM_LINK).
    // 2024 Demacia Cup 참가 2군·기타 팀 명칭
    if (comp?.key === 'demacia' && activeYear === 2024) Object.assign(ov, { BLGJ: { name: 'Bilibili Gaming Junior' }, SG: { name: 'Super Gaming' }, BLD: { name: 'Blood' }, LGDYT: { name: 'LGD Gaming Young Team' }, FPX: { name: 'FunPlus Phoenix' }, RNG: { name: 'Royal Never Give Up' } });
    if (activeYear <= 2024) { ov.TS = { ...(ov.TS || {}), name: 'Team Secret' }; ov.TW = { ...(ov.TW || {}), name: 'Team Whales' }; ov.MBE = { ...(ov.MBE || {}), name: 'MGN Blue Esports' }; }
    // EWC의 AL: 2025 이하는 이름 'AL'(로고는 AG.AL 로고 유지), 2026부터 AGAL(AG.AL) — EWC_TEAM_OVERRIDE.
    if (comp?.key === 'ewc' && activeYear <= 2025) ov.AL = { name: 'AL', logo: agalEwcLogo };
    // BFX: 2024 Spring까지 FearX(FOX), 2024 Summer는 BNK FearX(FOX), 2025부터 기본 BNK FEARX.
    if (activeYear < 2024 || (activeYear === 2024 && activeSub === 'Spring')) ov.BFX = { tag: 'FOX', name: 'FearX', logo: fearxLogo };
    // 2024 KeSPA CUP(12월, Worlds 이후)도 Summer 당시 팀명(BNK FearX)으로 표기.
    else if (activeYear === 2024 && (activeSub === 'Summer' || activeSub === '선발전' || activeSub === 'KeSPA CUP')) ov.BFX = { tag: 'FOX', name: 'BNK FearX', logo: bnkFearxLogo };
    // DNS: 2024 이하는 KWANGDONG FREECS(KDF). 2025는 DN FREECS(DNF, TEAM_OVERRIDE_2025), 2026부터 DN SOOPers.
    if (activeYear <= 2024) ov.DNS = { tag: 'KDF', name: 'KWANGDONG FREECS', logo: kwangdongFreecsLogo };
    // MKOI: 2024까지 MAD Lions KOI(MDK). 2025부터 기본 Movistar KOI.
    if (activeYear <= 2024) ov.MKOI = { tag: 'MDK', name: 'MAD Lions KOI', logo: madLionsKoiLogo };
    // C9: 2024까지 이름 'Cloud9', 옛 로고. 2025부터 기본 Cloud9 Kia.
    if (activeYear <= 2024) ov.C9 = { name: 'Cloud9', logo: c9_2024Logo };
    // NRG: 2024 Spring까지 옛 워드마크 로고(그 외는 EXTRA_LOGOS 기본 크레스트 로고).
    if (activeYear === 2024 && comp?.key === 'lcs' && activeSub === 'Spring') ov.NRG = { logo: nrg2024SpringLogo };
    // QTD: 2024까지 Sengoku Gaming(SG). 2025부터 QT DIG∞(EXTRA_LOGOS/NAMES 기본값).
    if (activeYear <= 2024) ov.QTD = { tag: 'SG', name: 'Sengoku Gaming', logo: sengokuGaming2024Logo };
    // SHG: 2024 LCP LJL Spring까지 옛 로고.
    if (comp?.key === 'lcp' && activeYear === 2024 && activeEvent === 'LJL' && activeSub === 'Spring') ov.SHG = { logo: shg2024SpringLogo };
    // ISGG(Isurus): 약칭 ISG로 표기.
    ov.ISGG = { tag: 'ISG', name: 'Isurus', logo: isurus2Logo };
    // LOUD: 2024 이하는 약칭 LLL.
    if (activeYear <= 2024) ov.LOUD = { tag: 'LLL' };
    // ANCX: 2024 LCP(PCS)에서 약칭 ANC로 표기.
    if (comp?.key === 'lcp' && activeYear === 2024) ov.ANCX = { tag: 'ANC', name: 'Antic Esports', logo: anticEsportsLogo };
    return ov;
  })();

  // 제목 접미사: 리그명이 sub에 중복되면 제거 (예: LPL+'Split 2' → "Split 2")
  const subSuffix = (() => {
    if (!subTabs || !activeSub) return '';
    const lg = comp.name.replace('2026 ', '');
    if (activeSub === lg) return '';
    const t = activeSub.startsWith(lg + ' ') ? activeSub.slice(lg.length + 1) : activeSub;
    return ` ${t}`;
  })();
  const title = (() => {
    if (comp?.key === 'lck' && activeSub === 'KeSPA CUP') return '2026 LoL KeSPA CUP';
    if (comp?.key === 'cblol') {
      const base = 'CBLOL 2026';
      if (activeSub === 'Copa') return `Copa ${base}`;
      if (activeSub && activeSub !== 'CBLOL') return `${base} ${activeSub}`;
      return base;
    }
    return `${comp?.name ?? ''}${subSuffix}`;
  })();

  // 단계(스테이지) 목록 — 과거 연도는 pastData 기반, 현재 연도는 기존 로직.
  const isPastComp = comp && comp.key === 'fst' && isCurrentYear; // 현재연도 FST(서브탭 없는 종료 대회)
  const isPastSplit = comp && isCurrentYear && (PAST_SPLIT_SUBS.has(`${comp.key}|${activeSub}`) || isPastComp);
  const curSplitData = isPastSplit ? (isPastComp ? officialStandings.standings[comp.key] : officialStandings.standings[comp.key]?.[activeSub]) : null;
  const stageListRaw = comp
    ? (pastFull ? (comp.key === 'ewc' ? (Object.keys(pastData?.groups || {}).length ? STAGE_TABS.ewc : ['플레이오프']) : pastSplitStagesFromData(pastData))
      : isPastSplit ? pastSplitStagesFromData(curSplitData)
        : (STAGE_TABS[`${comp.key}|${activeSub}`] || (!subTabs && STAGE_TABS[comp.key])))
    : null;
  // Road to MSI·선발전(대표 선발전)은 최종 순위 단계를 표기하지 않는다.
  const noFinalStageSub = activeSub === 'Road to MSI' || /선발전/.test(activeSub || '');
  const stageList = (stageListRaw && noFinalStageSub) ? stageListRaw.filter((s) => s !== '최종 순위') : stageListRaw;
  const showStages = !!stageList;
  const effFinished = !!(comp && (subStatus || comp.status) === 'finished');
  const rawDefaultStage = comp && (
    (pastFull || isPastSplit) ? (comp.key === 'ewc' ? (STAGE_DEFAULT.ewc || '플레이오프') : '최종 순위')
      : (effFinished && Array.isArray(stageList) && stageList.includes('최종 순위')) ? '최종 순위'
        : (STAGE_DEFAULT[`${comp.key}|${activeSub}`] || (!subTabs && STAGE_DEFAULT[comp.key]))
  );
  // 기본 스테이지가 실제 목록에 없으면 첫 스테이지로 (예: 최종순위 없는 대표 선발전)
  const defaultStage = (rawDefaultStage && stageList?.includes(rawDefaultStage)) ? rawDefaultStage : (stageList ? stageList[0] : null);
  const activeStage = showStages
    ? (stageList.includes(searchParams.get('stage')) ? searchParams.get('stage') : defaultStage)
    : null;
  const setActiveStage = (s) =>
    setSearchParams((p) => { const n = new URLSearchParams(p); n.set('stage', s); return n; }, { replace: true });

  // 과거 연도의 대회 명칭 오버라이드 — 2025 LCS/CBLOL은 LTA North/LTA Sul(단, Split 1은 통합 'LTA').
  const PAST_COMP_NAME = {
    'demacia|2024': { default: 'Demacia Cup' }, // 2024는 Demacia Cup 단독(통합 DCGI 이전)
    'lcs|2025': { default: 'LTA North', 'Split 1': 'LTA', 'Playoffs': 'LTA' },
    'cblol|2025': { default: 'LTA Sul', 'Etapa 1': 'LTA', 'Playoffs': 'LTA' },
  };
  // 서브탭 버튼은 짧게(Kickoff/Mid/Finals), 제목은 정식 명칭으로 표기.
  const SUB_TITLE_NAME = {
    'lcp|2025': { Kickoff: 'Season Kickoff', Mid: 'Mid Season', Finals: 'Season Finals' },
  };
  const displayTitle = (() => {
    if (isCurrentYear) return title;
    if (pcsPoView) return `${activeYear} PCS ${({ 'Split 1': 'Spring', 'Split 2': 'Summer' })[activeSub] || activeSub} Playoffs`;
    if (activeEvent) return `${activeYear} ${SUBEVENT_NAMES[activeEvent] || activeEvent}${activeSub ? ` ${activeSub}` : ''}`;
    const subMap = SUB_TITLE_NAME[`${comp?.key}|${activeYear}`];
    if (subMap && subMap[activeSub]) return `${activeYear} ${comp.name.replace('2026 ', '')} ${subMap[activeSub]}`;
    const ov = PAST_COMP_NAME[`${comp?.key}|${activeYear}`];
    if (ov) {
      const lg = ov[activeSub] || ov.default;
      return `${activeYear} ${lg}${activeSub && activeSub !== lg ? ` ${activeSub}` : ''}`;
    }
    return title.replace(String(CURRENT_YEAR), String(activeYear));
  })();
  // 과거 연도는 이미 종료된 대회이므로 상태 배지를 '종료'로 표기
  const stDisplay = !isCurrentYear ? statusMeta.finished : st;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#1e2328] to-[#0a1428] p-6 md:p-12 text-white">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 bg-[#C8963E] rounded-xl flex items-center justify-center shrink-0">
            <Target color="white" size={22} />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white">LoL 승부예측</h1>
        </div>

        {/* 탭 선택 (GPR 순위 + 9개 대회) */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((c) => {
            const active = c.key === activeKey;
            // 탭(일반 대회) 상징색 — 에디션별 색과 별개로 탭에 쓸 색. (예: AG 탭은 #ffb732, 2026 상세는 유지)
            const tabColor = TAB_COLOR[c.key] || c.color;
            return (
              <React.Fragment key={c.key}>
              {/* 데스크탑에서 FST부터 아랫줄로 — 국제 대회(FST~Worlds)를 두 번째 줄에 배치 */}
              {c.key === 'fst' && <div className="hidden md:block basis-full h-0" aria-hidden />}
              <button
                onClick={() => setActiveKey(c.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-black border transition-all ${
                  active ? '' : 'text-white/60 border-white/15 hover:border-white/40 bg-transparent'
                }`}
                style={active ? (COMP_GRADIENT[c.key] ? { backgroundImage: COMP_GRADIENT[c.key], backgroundOrigin: 'border-box', backgroundClip: 'border-box', borderColor: 'transparent', color: '#fff' } : { backgroundColor: tabColor, borderColor: tabColor, color: textOn(tabColor) }) : {}}
              >
                <img src={tabLogo(c.key)} alt="" width={18} height={18}
                  className="object-contain shrink-0"
                  style={{ width: 18, height: 18, filter: c.key === 'ewc' ? 'brightness(0) invert(1)' : (active ? (textOn(tabColor) === '#1e2328' ? 'brightness(0)' : 'brightness(0) invert(1)') : 'none'), opacity: active ? 0.9 : 1 }}
                  onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                {c.tabName || c.name.replace('2026 ', '')}
              </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* 선택된 탭 카드 */}
        <div className="rounded-3xl bg-white/5 border border-white/10 p-6 md:p-8">
          {isGpr ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#C8963E]">
                  <img src={LOLESPORTS_LOGO} alt="GPR" width={24} height={24} className="object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">GPR 팀 랭킹</h2>
                  <p className="text-xs text-white/40">Global Power Rankings · {gprTeams.teams.length}팀 · 갱신 {gprTeams.updatedAt}</p>
                </div>
              </div>
              <GprTable selectedTeam={selectedTeam} onTeamClick={handleTeamClick} />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  {(() => {
                    const hd = headerDetail;
                    // LTA 등 tint 로고: 상징색을 로고 색으로 사용(어두워 안 보이면 흰색), 배경은 상징색을 옅게.
                    if (hd?.tint && hd.logo) {
                      const c = (hd.color || '#888').replace('#', '');
                      const lum = (parseInt(c.slice(0, 2), 16) * 0.299 + parseInt(c.slice(2, 4), 16) * 0.587 + parseInt(c.slice(4, 6), 16) * 0.114) / 255;
                      const logoColor = lum > 0.22 ? hd.color : '#fff';
                      return (
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${hd.color}2e` }}>
                          <span aria-hidden style={{ width: 24, height: 24, display: 'block', backgroundColor: logoColor, WebkitMaskImage: `url("${hd.logo}")`, maskImage: `url("${hd.logo}")`, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center', WebkitMaskSize: 'contain', maskSize: 'contain' }} />
                        </div>
                      );
                    }
                    return (
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={hd?.gradient ? { backgroundImage: hd.gradient } : (!hd && COMP_GRADIENT[comp.key]) ? { backgroundImage: COMP_GRADIENT[comp.key] } : { backgroundColor: hd?.color || comp.color }}>
                    <img src={hd?.logo || COMP_DETAIL_LOGO[comp.key] || COMP_LOGO[comp.key]} alt={comp.name} width={24} height={24} className="object-contain"
                      style={{ filter: hd?.logo ? (hd.invert ? 'brightness(0) invert(1)' : 'none') : (textOn(hd?.color || comp.color) === '#1e2328' ? 'brightness(0)' : 'brightness(0) invert(1)') }}
                      onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                  </div>
                    );
                  })()}
                  <div>
                    <h2 className="text-xl font-black text-white">{displayTitle}</h2>
                    <p className="text-xs text-white/40">{comp.scope === 'intl' ? '국제 대회' : '지역 리그'}</p>
                  </div>
                  {years.length > 1 && (
                    <YearDropdown years={years} value={activeYear} onChange={setActiveYear} />
                  )}
                  {subEvents && (
                    <YearDropdown years={subEvents} value={activeEvent} onChange={setActiveEvent} ariaLabel="세부 대회 선택" />
                  )}
                </div>
                <span className="px-3 py-1 rounded-lg text-xs font-black" style={{ color: stDisplay.color, backgroundColor: stDisplay.bg }}>
                  {stDisplay.label}
                </span>
              </div>

              {/* 세부 대회(서브탭) 선택 — 현재·과거 연도 모두 */}
              {subTabs && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {subTabs.map((s) => {
                    const on = s === activeSub;
                    return (
                      <button
                        key={s}
                        onClick={() => setActiveSub(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          on ? 'bg-white/15 text-white border-white/30' : 'text-white/45 border-white/10 hover:border-white/30 hover:text-white/70'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 단계 선택 */}
              {showStages && (
                <div className="inline-flex bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
                  {stageList.map((s) => {
                    const on = s === activeStage;
                    return (
                      <button
                        key={s}
                        onClick={() => setActiveStage(s)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                          on ? 'bg-[#C8963E] text-[#1e2328]' : 'text-white/50 hover:text-white/80'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              )}

              {!isCurrentYear ? (
                pastFull ? (
                  <PastSplitView comp={comp} data={pastData} stage={activeStage} onTeamClick={handleTeamClick} teamOverride={pastTeamOverride} />
                ) : (
                  <div className="py-16 text-center border-2 border-dashed border-white/10 rounded-3xl">
                    <Hourglass size={28} className="mx-auto text-white/30 mb-3" />
                    <p className="text-white/50 font-bold mb-1">{activeYear} 결과 준비 중</p>
                    <p className="text-white/30 text-sm">이전 연도 대회 결과를 곧 게재합니다.</p>
                  </div>
                )
              ) : isPastSplit ? (
                <PastSplitView comp={comp} data={curSplitData} stage={activeStage} onTeamClick={handleTeamClick} teamOverride={comp.key === 'lpl' && (activeSub === 'Split 1' || activeSub === 'Split 2') ? LPL_PRE_MEITUAN_OVERRIDE : undefined} />
              ) : isContentTbd(comp.key, activeSub) ? (
                <div className="py-20 text-center border-2 border-dashed border-white/10 rounded-3xl">
                  <Hourglass size={32} className="mx-auto text-white/30 mb-4" />
                  <p className="text-white/60 font-black text-lg mb-2">추후 제공 예정</p>
                  <p className="text-white/30 text-sm">해당 대회 정보를 준비 중입니다.</p>
                </div>
              ) : subUpcoming ? (
                <div className="py-16 text-center border-2 border-dashed border-white/10 rounded-3xl">
                  <Hourglass size={28} className="mx-auto text-white/30 mb-3" />
                  <p className="text-white/50 font-bold mb-1">아직 시작하지 않은 대회입니다</p>
                  <p className="text-white/30 text-sm">{activeSub}가 시작되면 순위·예측을 게재합니다.</p>
                </div>
              ) : !comp.ready ? (
                <NotReady comp={comp} />
              ) : comp.status === 'finished' && !SUBTABS[comp.key] && !STAGE_TABS[comp.key] ? (
                <ResultView comp={comp} />
              ) : (
                // 종료 상태여도 세부탭·스테이지(브래킷·참가팀·시뮬 결과)가 있는 대회
                //   (리그·MSI·Worlds 등)는 그대로 표시. finalResult만 있는 대회(FST)만 ResultView.
                <SimulationView comp={comp} sub={activeSub} stage={activeStage} finished={(subStatus || comp.status) === 'finished'} onTeamClick={handleTeamClick} />
              )}
            </>
          )}
        </div>

        {/* GPR 지역 점수 참고 */}
        <section className="mt-8 p-5 rounded-2xl bg-white/5 border border-white/10">
          <h2 className="text-sm font-black text-[#E8C77E] mb-4 uppercase tracking-wider">참고 · 지역별 GPR 점수</h2>
          <div className="flex flex-col gap-2">
            {gpr.regions.map((r) => {
              const max = Math.max(...gpr.regions.map((x) => x.score));
              return (
                <div key={r.key} className="flex items-center gap-3">
                  <span className="w-14 text-sm font-black shrink-0" style={{ color: lighten(r.color) }}>{r.name}</span>
                  <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full flex items-center justify-end pr-2 text-[10px] font-black text-white/90"
                      style={{ width: `${(r.score / max) * 100}%`, backgroundColor: r.color }}>
                      {r.score}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 안내 · 레이팅 출처 (하단) */}
        <div className="mt-10 pt-6 border-t border-white/10">
          <a
            href={sim.source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/40 text-xs hover:text-[#E8C77E] inline-flex items-center gap-1"
          >
            레이팅 출처: lolesports.com Global Power Rankings <ExternalLink size={11} /> · 갱신 {fmtUpdated(sim.updatedAt)}
          </a>
          <p className="text-white/30 text-[11px] mt-2">
            TotalDU는 Riot Games의 서비스가 아닌 개인의 비공식 서비스이며 Riot Games 또는 리그 오브 레전드의 공개 데이터를 활용합니다. 리그 오브 레전드 및 Riot Games는 Riot Games, Inc.의 상표 또는 등록 상표입니다.
            <br />
            League of Legends © Riot Games, Inc.
          </p>
        </div>
      </div>
      {selectedTeam && (
        <TeamPanel
          teamShort={selectedTeam}
          onClose={() => setSelectedTeam(null)}
          onNavigate={() => navigate(`/lol/prediction/team/${selectedTeam}`)}
        />
      )}
    </div>
  );
};

export default PredictionPage;
