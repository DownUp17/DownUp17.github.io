// 팀 이름 → 시즌별(그 당시) 로고·개명 정보. 출처 Leaguepedia(팀 로고 파일 이력·'Team has renamed' 표시).
//   로고 이력은 같은 그림 재업로드를 제거하고, 바뀐 시점을 대회 시즌(연도.스플릿 1~3)으로 묶어 둔다.
import data from '../data/lolTeamEra.json';

// 세부 대회명 → 그 해 스플릿 순서(1: 연초 · 2: 중반 · 3: 하반기/국제전). 모르면 3(그 해 마지막 로고).
export const splitOf = (sub) => {
  if (!sub) return 3;
  if (/LCK CUP|Split 1|Spring|Kickoff|Versus|Lock-?In|Winter|Opening|Etapa 1|Copa/i.test(sub)) return 1;
  if (/Split 2|Summer|Mid|Road to MSI|Closing|Etapa 2|First Stand/i.test(sub)) return 2;
  return 3;
};

const url = (u) => u.replace(/^~/, data.prefix).replace(/\/revision\/(latest|\d+)$/, '/revision/$1/scale-to-width-down/64');

// 그 시즌(연도·스플릿)에 쓰던 로고. latest=false면 현재 로고와 다를 때만 돌려준다(현재 로고는 사이트 자체 이미지 사용).
export const eraLogoByName = (name, year, { split = 3, latest = true } = {}) => {
  const vs = data.logos?.[name?.trim()];
  if (!vs?.length || !year) return null;
  const key = `${year}.${split}`;
  const i = vs.findIndex(([s]) => s <= key); // vs는 최신순
  if (i < 0) return latest ? url(vs[vs.length - 1][1]) : null; // 그 시즌보다 늦게 올라온 로고뿐이면 가장 오래된 것
  if (!latest && i === 0) return null;
  return url(vs[i][1]);
};

// 개명 체인을 끝까지 따라간 최종 팀 이름(같은 구단 판단용). 예: SK Telecom T1 → T1, Liiv SANDBOX → FearX
export const finalTeamName = (name) => {
  let n = name?.trim();
  for (let i = 0; i < 10 && data.renames?.[n]; i++) n = data.renames[n];
  return n;
};
