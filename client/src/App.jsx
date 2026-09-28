// client/src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { Search, Menu, User, LogIn, ChevronRight, ChevronDown, Info, BookOpen, Globe, FileText, Sparkles, Zap, Timer, Gamepad2, Swords, Check } from 'lucide-react';
import TypeChartPage from './pages/TypeChartPage';
import BattleLayout from './pages/BattleLayout';
import PokedexLayout from './pages/PokedexLayout';
import PokedexPage from './pages/PokedexPage';
import PokemonDetailPage from './pages/PokemonDetailPage';
import AbilityListPage from './pages/AbilityListPage';
import AbilityDetailPage from './pages/AbilityDetailPage';
import PredictionPage from './pages/PredictionPage';
import TeamPage from './pages/TeamPage';

const HOST = typeof window !== 'undefined' ? window.location.hostname : '';

// 포켓몬은 아직 beta 단계 → 로컬·downup17(beta)에서만 노출하고
// totaldu(공개)에서는 숨긴다. 정식 공개 시 이 플래그만 풀면 된다.
const IS_BETA = import.meta.env.DEV || /downup17/i.test(HOST);

// 각 환경이 자기 백엔드를 호출하도록 분기한다.
// 로컬 → localhost, downup17(beta) → beta 백엔드, totaldu(공개) → 공개 백엔드
const API_BASE = import.meta.env.DEV
  ? "http://localhost:4000"
  : (/downup17/i.test(HOST)
      ? "https://down-up17-github-io.vercel.app"   // beta 백엔드
      : "https://totaldu-github-io.vercel.app");    // 공개 백엔드

const PartyPage = () => (
  <div className="min-h-screen bg-white p-10 md:p-20">
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="text-[#005596] font-bold mb-4 inline-block hover:underline">← 메인으로 돌아가기</Link>
      <h1 className="text-4xl font-black text-gray-900 mb-8 border-b-4 border-yellow-500 pb-4">추천 파티</h1>
      <div className="p-6 bg-yellow-50 rounded-2xl border border-yellow-100 text-yellow-800 shadow-sm">
        현재 시즌 1위 파티 구성을 확인하세요.
      </div>
    </div>
  </div>
);

const BattlePage = () => (
  <div className="w-full h-full">
    <h1 className="text-2xl font-black text-gray-900 mb-2">배틀 정보</h1>
    <p className="text-gray-400 text-sm mb-8 font-medium">원하는 항목을 선택하세요.</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      <Link
        to="/battle/type-chart"
        className="group flex flex-col justify-between p-8 bg-blue-50 hover:bg-blue-100 rounded-2xl border border-blue-100 transition-all hover:shadow-md"
      >
        <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mb-6">
          <Zap size={24} color="white" />
        </div>
        <div>
          <span className="font-black text-blue-900 text-xl block mb-2">타입 상성표</span>
          <span className="text-blue-600 text-sm font-medium">공격/방어 타입 상성을 한눈에 확인</span>
        </div>
        <ChevronRight className="mt-6 group-hover:translate-x-1 transition-transform text-blue-400" />
      </Link>

      <Link
        to="/battle/attack-order"
        className="group flex flex-col justify-between p-8 bg-teal-50 hover:bg-teal-100 rounded-2xl border border-teal-100 transition-all hover:shadow-md"
      >
        <div className="w-12 h-12 bg-[#0a8d87] rounded-xl flex items-center justify-center mb-6">
          <Timer size={24} color="white" />
        </div>
        <div>
          <span className="font-black text-teal-900 text-xl block mb-2">포켓몬 공격 순서</span>
          <span className="text-teal-600 text-sm font-medium">우선도·스피드·트릭룸 등 행동 순서 규칙</span>
        </div>
        <ChevronRight className="mt-6 group-hover:translate-x-1 transition-transform text-teal-400" />
      </Link>
    </div>
  </div>
);

const PRIORITY_TIERS = [
  {
    value: '+6',
    color: '#1D4ED8',
    bg: '#EFF6FF',
    moves: ['포켓몬 교체'],
    note: '기술이 아닌 배틀 행동. 어떤 기술보다 먼저 처리된다.',
  },
  {
    value: '+5.5',
    color: '#7C3AED',
    bg: '#F5F3FF',
    moves: ['메가진화'],
    note: '포켓몬 강화 시스템. 기술 발동 직전, +5 기술보다도 먼저 처리된다.',
  },
  {
    value: '+5',
    color: '#6D28D9',
    bg: '#EDE9FE',
    moves: ['도우미', '힘껏펀치 (집중 이펙트)', '부리캐논 (집중 이펙트)'],
    note: '도우미는 더블배틀 전용. 힘껏펀치·부리캐논은 집중 이펙트만 이 타이밍에 발동하며 실제 공격은 –3.',
  },
  {
    value: '+4',
    color: '#2563EB',
    bg: '#DBEAFE',
    moves: ['방어', '가로채기', '매직코트', '버티기', '킹실드', '니들가드', '토치카', '블로킹', '화염의수호', '판별', '스레드트랩'],
    note: '매직코트를 제외하고 연속 사용 시 실패 확률 상승. 버티기를 제외한 나머지는 방어 계열.',
  },
  {
    value: '+3',
    color: '#0891B2',
    bg: '#CFFAFE',
    moves: ['트릭가드', '퍼스트가드', '와이드가드', '기선제압', '속이기 (첫 턴)', '힐링시프트 (특성)'],
    note: '기선제압은 상대가 선공기를 사용했을 때만 발동. 속이기는 배틀 첫 턴에만 사용 가능.',
  },
  {
    value: '+2',
    color: '#0369A1',
    bg: '#E0F2FE',
    moves: ['신속', '페인트', '날따름', '분노가루', '만나자마자', '사이드체인지'],
    note: '신속은 4세대까지 +1이었으나 5세대부터 +2로 변경.',
  },
  {
    value: '+1',
    color: '#059669',
    bg: '#D1FAE5',
    moves: ['전광석화', '아쿠아제트', '불릿펀치', '얼음뭉치', '마하펀치', '야습', '기습', '진공파', '액셀록', '물수리검', '제트펀치', '그래스슬라이더 (그래스필드)', '질풍날개 (특성)', '짓궂은마음 (특성)'],
    note: '기습·질풍신뢰는 상대가 공격기를 사용했을 때만 발동. 그래스슬라이더는 그래스필드 상태일 때만 +1.',
  },
  {
    value: '0',
    color: '#6B7280',
    bg: '#F3F4F6',
    moves: ['그 외 모든 기술'],
    note: '기본값. 스피드로 순서가 결정된다.',
  },
  {
    value: '–1',
    color: '#D97706',
    bg: '#FEF9C3',
    moves: ['받아던지기'],
    note: '상대보다 늦게 발동.',
  },
  {
    value: '–3',
    color: '#EA580C',
    bg: '#FFEDD5',
    moves: ['힘껏펀치 (공격)', '부리캐논 (공격)'],
    note: '집중 이펙트(+5) 후 실제 공격은 –3에 발동. 집중 중 피격되면 공격이 실패한다.',
  },
  {
    value: '–4',
    color: '#DC2626',
    bg: '#FEE2E2',
    moves: ['눈사태', '리벤지'],
    note: '눈사태는 같은 턴에 피격됐을 경우 위력 2배.',
  },
  {
    value: '–5',
    color: '#BE185D',
    bg: '#FCE7F3',
    moves: ['카운터', '미러코트'],
    note: '물리(카운터)·특수(미러코트) 공격을 받은 후 피해량의 2배 반격. 반드시 상대보다 늦게 발동.',
  },
  {
    value: '–6',
    color: '#9F1239',
    bg: '#FFE4E6',
    moves: ['울부짖기', '날려버리기', '드래곤테일', '배대뒤치기', '순간이동'],
    note: '교체 강제 기술. 8세대(레츠고)부터 순간이동도 트레이너전·대전에서 –6 적용.',
  },
  {
    value: '–7',
    color: '#581C87',
    bg: '#F3E8FF',
    moves: ['트릭룸'],
    note: '전체 우선도 중 가장 낮음. 거의 항상 마지막에 발동하여 안정적으로 필드를 설치 가능.',
  },
];

const SPEED_MODIFIERS = [
  { category: '상태이상', name: '마비', effect: '스피드 ×0.5', color: '#F59E0B', detail: '6~8세대 이전은 ×0.25 (25% 감소)' },
  { category: '날씨/필드', name: '순풍 (Tailwind)', effect: '스피드 ×2', color: '#3B82F6', detail: '4턴간 자신과 아군 전원에게 적용' },
  { category: '특성', name: '쾌속수영', effect: '비·강우에서 ×2', color: '#0EA5E9', detail: '전기도마뱀·체크', },
  { category: '특성', name: '엽록소', effect: '쨍쨍에서 ×2', color: '#16A34A', detail: '햇빛 날씨 한정' },
  { category: '특성', name: '모래헤치기', effect: '모래바람에서 ×2', color: '#D97706', detail: '쏘콘 계열·고로우크 등' },
  { category: '특성', name: '전기엔진', effect: '전기 기술 피격 시 ×2', color: '#EAB308', detail: '면역이면서 스피드 상승' },
  { category: '특성', name: '스쿠릇트', effect: '전기장에서 ×2', color: '#A855F7', detail: '서지서퍼 포함. 전기장 전용' },
  { category: '특성', name: '갑각의각오', effect: '배틀 중 스피드 1랭크↑', color: '#64748B', detail: '능력치 하강 시 발동' },
  { category: '도구', name: '구애스카프', effect: '스피드 ×1.5', color: '#EF4444', detail: '기술이 1가지로 고정되는 단점' },
  { category: '도구', name: '파워계열 아이템', effect: '스피드 -절반 (EV훈련용)', color: '#6B7280', detail: '배틀 중에도 적용되므로 주의' },
];

const AttackOrderPage = () => (
  <div className="w-full max-w-3xl flex flex-col gap-10">

    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-1">포켓몬 공격 순서</h1>
      <p className="text-gray-400 text-sm font-medium">배틀에서 누가 먼저 행동하는지 결정하는 규칙</p>
    </div>

    {/* 결정 흐름 */}
    <section className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
      <h2 className="text-base font-black text-blue-900 mb-4">공격 순서 결정 흐름</h2>
      <div className="flex flex-col gap-3">
        {[
          { step: '1', title: '우선도 비교', desc: '우선도(Priority) 수치가 높은 기술이 먼저 발동됩니다. 우선도가 다르면 스피드는 무관합니다.' },
          { step: '2', title: '스피드 비교', desc: '우선도가 같을 때, 스피드 실수치가 높은 포켓몬이 먼저 행동합니다.' },
          { step: '3', title: '동속도 처리', desc: '스피드 실수치가 완전히 같으면 50% 확률로 무작위 결정됩니다 (스피드 동점).' },
        ].map(item => (
          <div key={item.step} className="flex items-start gap-3">
            <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">{item.step}</span>
            <div>
              <span className="font-bold text-blue-900 text-sm">{item.title}</span>
              <p className="text-blue-700 text-sm mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* 우선도 표 */}
    <section>
      <h2 className="text-lg font-black text-gray-900 mb-1">우선도 (Priority)</h2>
      <p className="text-sm text-gray-400 mb-4">수치가 높을수록 스피드와 무관하게 먼저 발동합니다. 같은 우선도끼리는 스피드로 결정.</p>
      <div className="flex flex-col gap-2">
        {PRIORITY_TIERS.map(tier => (
          <div key={tier.value}
            className="flex items-start gap-3 p-3 rounded-xl border"
            style={{ backgroundColor: tier.bg, borderColor: tier.color + '33' }}
          >
            <span
              className="text-sm font-black shrink-0 w-8 text-center"
              style={{ color: tier.color }}
            >{tier.value}</span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1 mb-1">
                {tier.moves.map(m => (
                  <span key={m}
                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: tier.color }}
                  >{m}</span>
                ))}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{tier.note}</p>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* 스피드 계산 */}
    <section>
      <h2 className="text-lg font-black text-gray-900 mb-1">스피드 실수치 계산</h2>
      <p className="text-sm text-gray-400 mb-4">배틀에서 비교되는 값은 종족값이 아닌 <strong className="text-gray-600">실수치</strong>입니다.</p>
      <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 font-mono text-sm text-center mb-4">
        <span className="text-gray-500">실수치 = </span>
        <span className="text-[#005596] font-black">⌊(종족값×2 + 개체값 + ⌊노력치÷4⌋) × 레벨÷100 + 5⌋</span>
        <span className="text-gray-500"> × 성격보정</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        {[
          { label: '느긋·얌전 등', effect: '×0.9', color:'#EF4444' },
          { label: '성격 보정 없음', effect: '×1.0', color:'#6B7280' },
          { label: '쾌활·명랑 등', effect: '×1.1', color:'#16A34A' },
        ].map(n => (
          <div key={n.label} className="p-3 rounded-xl bg-white border text-center">
            <p className="text-xs text-gray-400 mb-1">{n.label}</p>
            <p className="font-black text-lg" style={{ color: n.color }}>{n.effect}</p>
          </div>
        ))}
      </div>
    </section>

    {/* 스피드 수정 요인 */}
    <section>
      <h2 className="text-lg font-black text-gray-900 mb-1">스피드 수정 요인</h2>
      <p className="text-sm text-gray-400 mb-4">실수치에 추가로 곱해지는 배율 요인들입니다. 중복 적용 가능.</p>
      {['상태이상', '날씨/필드', '특성', '도구'].map(cat => {
        const items = SPEED_MODIFIERS.filter(m => m.category === cat);
        return (
          <div key={cat} className="mb-4">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{cat}</p>
            <div className="flex flex-col gap-2">
              {items.map(item => (
                <div key={item.name} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100">
                  <span className="text-xs font-black px-2 py-1 rounded-lg text-white shrink-0"
                    style={{ backgroundColor: item.color }}>
                    {item.effect}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{item.name}</p>
                    {item.detail && <p className="text-xs text-gray-400 mt-0.5">{item.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>

    {/* 트릭룸 */}
    <section className="p-6 bg-purple-50 rounded-2xl border border-purple-100">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🔮</span>
        <h2 className="text-base font-black text-purple-900">트릭룸 (Trick Room)</h2>
      </div>
      <div className="flex flex-col gap-2 text-sm text-purple-800">
        <p>스피드 순서를 <strong>역전</strong>시키는 필드 기술입니다. 5턴간 지속되며, 우선도 <strong>–7</strong>로 모든 기술 중 가장 낮아 거의 항상 마지막에 발동합니다.</p>
        <ul className="list-disc list-inside space-y-1 text-purple-700">
          <li>트릭룸 중에는 <strong>스피드가 낮은 포켓몬이 먼저</strong> 행동합니다.</li>
          <li>우선도 자체는 여전히 적용됩니다. (+1 선제기는 트릭룸 안에서도 먼저 발동)</li>
          <li>트릭룸 상태에서 다시 트릭룸을 사용하면 즉시 해제됩니다.</li>
          <li>구애스카프·순풍 등 스피드 상승 요인이 오히려 불리해질 수 있습니다.</li>
        </ul>
      </div>
    </section>

    {/* 스피드 동점 */}
    <section className="p-5 bg-gray-50 rounded-2xl border border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🎲</span>
        <h2 className="text-base font-black text-gray-800">스피드 동점 (Speed Tie)</h2>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">
        두 포켓몬의 스피드 실수치가 완전히 동일하면 <strong>50% 확률</strong>로 행동 순서가 무작위 결정됩니다.
        같은 종·같은 레벨·같은 스피드 조정 환경에서 발생하며, 더블배틀에서는 각 포켓몬 간 독립적으로 판정합니다.
      </p>
    </section>

  </div>
);

const CommunityPage = () => (
  <div className="min-h-screen bg-white p-10 md:p-20">
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="text-[#005596] font-bold mb-4 inline-block hover:underline">← 메인으로 돌아가기</Link>
      <h1 className="text-4xl font-black text-gray-900 mb-8 border-b-4 border-green-500 pb-4">커뮤니티</h1>
      <div className="text-gray-600 font-medium">자유로운 토론 게시판입니다.</div>
    </div>
  </div>
);

const MainHome = ({ articles, searchQuery, setSearchQuery }) => (
  <>
    <section className="relative w-full bg-gradient-to-br from-[#0a8d87] via-[#15b291] to-[#005596] min-h-[calc(100vh-80px)] px-4 overflow-hidden flex items-center">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-300 rounded-full blur-3xl"></div>
      </div>
      <div className="relative max-w-4xl mx-auto text-center w-full">
        <h2 className="text-4xl md:text-5xl font-black text-white mb-4 drop-shadow-md">무엇을 도와드릴까요?</h2>
        <p className="text-white/80 text-lg mb-12 font-medium">데이터 기반의 프라이빗 위키 시스템</p>
        <div className="relative group max-w-3xl mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative flex items-center bg-white rounded-[1.8rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="pl-8 text-gray-400"><Search size={24} strokeWidth={3} /></div>
            <input
              type="text"
              className="w-full py-6 px-6 text-xl text-gray-800 placeholder-gray-400 outline-none font-medium"
              placeholder="포켓몬, 파티, 배틀 전략 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="mr-3 bg-[#005596] hover:bg-[#003d6d] text-white px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg flex items-center gap-2">
              검색 <ChevronRight size={18} />
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {['#실전_샘플', '#타입_상성', '#시즌24_랭킹', '#초보자_가이드'].map(tag => (
              <span key={tag} className="px-5 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-sm font-semibold cursor-pointer hover:bg-white/20 transition-colors">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>

    <main className="max-w-7xl mx-auto px-4 py-16">
      <div className="flex items-center justify-between mb-10">
        <h3 className="text-3xl font-black text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0a8d87] rounded-xl flex items-center justify-center">
            <FileText color="white" size={20} />
          </div>
          최근 등록된 정보
        </h3>
        <button className="text-[#005596] font-bold flex items-center gap-1 hover:underline">
          전체보기 <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.length > 0 ? (
          articles.map(art => (
            <div key={art.id} className="group p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer">
              <div className="mb-4 text-[#0a8d87] group-hover:scale-110 transition-transform">
                <Sparkles size={24} />
              </div>
              <h4 className="font-black text-xl text-gray-900 mb-3 group-hover:text-[#005596] transition-colors">{art.title}</h4>
              <p className="text-gray-500 leading-relaxed line-clamp-2">{art.content}</p>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center text-gray-400 font-medium border-2 border-dashed rounded-3xl">
            데이터를 불러오는 중이거나 등록된 정보가 없습니다.
          </div>
        )}
      </div>
    </main>
  </>
);

const ALL_SPORTS = [
  { key: 'pokemon', label: '포켓몬', icon: Swords, color: '#005596', beta: true },
  { key: 'lol', label: 'LoL Esports', icon: Gamepad2, color: '#C8963E' },
];
// beta 환경이 아니면 beta 종목(포켓몬)을 제외한다.
const SPORTS = ALL_SPORTS.filter(s => IS_BETA || !s.beta);

// 종목 전환 시 이동할 기본 페이지
const SPORT_HOME = { pokemon: '/', lol: '/lol/prediction' };

const SportSwitcher = ({ sport, setSport }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const current = SPORTS.find(s => s.key === sport) || SPORTS[0];
  const Icon = current.icon;

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all text-sm font-bold text-gray-700"
        style={{ color: current.color }}
      >
        <Icon size={16} />
        <span>{current.label}</span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-48 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden z-50 py-1.5">
          {SPORTS.map(s => {
            const SIcon = s.icon;
            const active = s.key === sport;
            return (
              <button
                key={s.key}
                onClick={() => { setSport(s.key); setOpen(false); navigate(SPORT_HOME[s.key] || '/'); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold transition-colors ${active ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                style={{ color: s.color }}
              >
                <SIcon size={17} />
                <span className="flex-1 text-left">{s.label}</span>
                {active && <Check size={16} className="text-gray-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [articles, setArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sport, setSport] = useState(() => {
    if (!IS_BETA) return 'lol';                       // 공개 환경은 LoL 고정
    return localStorage.getItem('sport') || 'pokemon';
  });

  useEffect(() => {
    localStorage.setItem('sport', sport);
  }, [sport]);

  useEffect(() => {
    fetch(`${API_BASE}/api/articles`)
      .then(res => res.json())
      .then(data => setArticles(data))
      .catch(err => console.error("API 연결 실패:", err));
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-sans">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 h-20 flex items-center sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 w-full flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-2xl font-black text-[#005596] flex items-center gap-2">
                <span className="bg-[#005596] text-white px-3 py-1 rounded-xl text-sm tracking-widest uppercase">Total</span>
                <span>DU</span>
              </Link>
              {SPORTS.length > 1 && <SportSwitcher sport={sport} setSport={setSport} />}
            </div>
            <nav className="hidden lg:flex items-center space-x-10 font-bold text-gray-600">
              {sport === 'pokemon' ? (
                <>
                  <Link to="/pokedex" className="hover:text-[#005596] transition-colors">포켓몬 도감</Link>
                  <Link to="/party" className="hover:text-[#005596] transition-colors">추천 파티</Link>
                  <Link to="/battle" className="hover:text-[#005596] transition-colors">배틀 정보</Link>
                  <Link to="/community" className="hover:text-[#005596] transition-colors">커뮤니티</Link>
                </>
              ) : (
                <Link to="/lol/prediction" className="hover:text-[#C8963E] transition-colors">승부예측</Link>
              )}
            </nav>
            <div className="flex items-center gap-3">
              {IS_BETA && (
                <button className="hidden sm:flex items-center gap-2 text-sm font-bold text-gray-700 bg-gray-50 px-5 py-2.5 rounded-full border border-gray-200 hover:bg-gray-100 transition-all">
                  <LogIn size={16} /> 로그인
                </button>
              )}
              <button className="lg:hidden p-2 text-gray-600"><Menu size={28} /></button>
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={sport === 'pokemon'
            ? <MainHome articles={articles} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
            : <Navigate to="/lol/prediction" replace />} />

          {/* 포켓몬 라우트는 beta 환경에서만 등록 (totaldu에서는 비노출) */}
          {IS_BETA && (
            <>
              {/* ✅ PokedexLayout 중첩 라우트 */}
              <Route path="/pokedex" element={<PokedexLayout />}>
                <Route index element={<PokedexPage />} />
                <Route path="abilities" element={<AbilityListPage />} />
                <Route path="ability/:name" element={<AbilityDetailPage />} />
                <Route path=":id" element={<PokemonDetailPage />} />
              </Route>

              <Route path="/party" element={<PartyPage />} />

              <Route path="/battle" element={<BattleLayout />}>
                <Route index element={<BattlePage />} />
                <Route path="type-chart" element={<TypeChartPage />} />
                <Route path="attack-order" element={<AttackOrderPage />} />
              </Route>

              <Route path="/community" element={<CommunityPage />} />
            </>
          )}

          <Route path="/lol/prediction/team/:teamShort" element={<TeamPage />} />
          <Route path="/lol/prediction" element={<PredictionPage />} />
          <Route path="/lol/prediction/:tab" element={<PredictionPage />} />
        </Routes>

        <footer className="relative z-10 mt-auto py-12 bg-white text-center border-t border-gray-100">
          <div className="flex items-center justify-center gap-6 mb-4">
            <span className="flex items-center gap-1.5 text-gray-400 text-xs">
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.364l-6.545-4.636v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.273l6.545-4.636 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
              </svg>
              totaldu17@gmail.com
            </span>
            <a href="https://x.com/down_up17" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors text-xs">
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              down_up17
            </a>
            <a href="https://instagram.com/total_du" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors text-xs">
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
              </svg>
              total_du
            </a>
          </div>
          <p className="text-gray-400 text-sm font-medium">2026 TotalDU</p>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
