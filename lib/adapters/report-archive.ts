import { REPORT_TYPE_LABEL } from "@/lib/mock/report-archive";
import type { CardResponse } from "@/types/feed";
import type {
  ArchiveCard,
  ArchiveGroup,
  ArchiveItem,
  ArchiveMonthlyCount,
  ArchivePeriod,
  ArchiveSort,
  ArchiveTagFilter,
} from "@/types/report-archive";

/**
 * 내 보고서 전체 보기(/reports) 어댑터 — 전부 순수 함수.
 *
 * - 실데이터 원천은 기존 GET /api/feed(CardResponse) 그대로(fetch 는 hooks/use-report-archive.ts).
 * - 서버 검색·필터·페이지네이션 API 가 없고 목록이 전량 반환됨을 실측 확인했으므로(FeedService:
 *   "P0 피드는 '내 카드 전부'와 동치", LIMIT 없음) 검색·필터·그룹핑·집계는 클라이언트에서 수행한다.
 * - mock 메타(태그·유형 등) 병합은 lib/adapters/report-archive-mock.ts 가 담당하고,
 *   여기 함수들은 mock 유무와 무관하게 동작한다(mock 없으면 해당 조건·표시가 자연히 비활성).
 * - member 전용 화면이 인증 확정 후 클라이언트에서만 렌더되므로(홈 member 피드와 동일)
 *   로컬 타임존 포맷의 하이드레이션 불일치 위험은 없다.
 */

const TIME_FORMAT = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" });

export function toArchiveCard(card: CardResponse): ArchiveCard {
  const ts = Date.parse(card.createdAt);
  const valid = !Number.isNaN(ts);
  return {
    publicId: card.publicId,
    title: card.title,
    summary: card.summary,
    whyForYou: card.whyForYou,
    sources: card.sources ?? [],
    createdAtMs: valid ? ts : null,
    timeLabel: valid ? TIME_FORMAT.format(ts) : "", // 잘못된 날짜는 표시 생략(임의 값 생성 금지)
  };
}

/**
 * 검색 — 대소문자 구분 없이(한글은 그대로), 항목에 실제로 존재하는 값만 대상으로 한다:
 * title · summary · whyForYou · sources[].title · sources[].url
 * + mock 메타가 있으면 tags · category · reportType 표시명("아침 브리핑"/"온디맨드").
 * 검색어가 비어 있으면(trim 후) 전체를 반환한다. API 재호출 없음(순수 필터).
 */
export function searchArchiveItems(items: ArchiveItem[], rawQuery: string): ArchiveItem[] {
  const query = rawQuery.trim().toLowerCase();
  if (query === "") return items;
  return items.filter((item) => {
    const haystack = [
      item.title,
      item.summary,
      item.whyForYou,
      ...item.sources.flatMap((s) => [s.title, s.url]),
      ...(item.mock
        ? [...item.mock.tags, item.mock.category ?? "", REPORT_TYPE_LABEL[item.mock.reportType]]
        : []),
    ];
    return haystack.some((v) => (v ?? "").toLowerCase().includes(query));
  });
}

/** 태그 필터 — mock 메타의 tags 기준 단일 선택. "all" 은 전체(실 API 모드에서는 항상 "all"). */
export function filterArchiveByTag(items: ArchiveItem[], tag: ArchiveTagFilter): ArchiveItem[] {
  if (tag === "all") return items;
  return items.filter((item) => item.mock?.tags.includes(tag) ?? false);
}

/**
 * 기간 필터 — createdAt(로컬) 기준 클라이언트 순수 필터. API 재호출 없음.
 * 날짜 파싱 실패 카드(createdAtMs=null)는 기간 판정이 불가능하므로 "전체"에서만 보인다.
 */
export function filterArchiveByPeriod<T extends { createdAtMs: number | null }>(
  items: T[],
  period: ArchivePeriod,
  now: Date,
): T[] {
  if (period === "all") return items;
  const days = period === "7d" ? 7 : 30;
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return items.filter((c) => c.createdAtMs !== null && c.createdAtMs >= cutoff);
}

/** 정렬 — latest 는 서버 최신순 입력 그대로, oldest 는 createdAt 오름차순(날짜 미상은 마지막). */
export function sortArchive<T extends { createdAtMs: number | null }>(
  items: T[],
  sort: ArchiveSort,
): T[] {
  if (sort === "latest") return items;
  return [...items].sort(
    (a, b) => (a.createdAtMs ?? Number.POSITIVE_INFINITY) - (b.createdAtMs ?? Number.POSITIVE_INFINITY),
  );
}

/** 사용자 로컬 기준 연·월·일 키(그룹 동일성 판단). */
function localDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** 그룹 라벨 — 오늘/어제는 접두사 병기, 같은 해는 "M월 D일", 다른 해는 "YYYY년 M월 D일". */
function dateLabel(ts: number, now: Date): string {
  const d = new Date(ts);
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  const key = localDateKey(ts);
  if (key === localDateKey(now.getTime())) return `오늘 · ${md}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === localDateKey(yesterday.getTime())) return `어제 · ${md}`;
  if (d.getFullYear() !== now.getFullYear()) return `${d.getFullYear()}년 ${md}`;
  return md;
}

/**
 * createdAt 로컬 날짜 기준 그룹핑(보고서는 항상 날짜별로 묶는다 — 묶기 옵션 없음).
 * 입력 순서를 유지하며 등장 순서대로 그룹을 만든다.
 * 파싱 실패 카드는 화면을 깨뜨리지 않도록 마지막 "날짜 정보 없음" 그룹으로 모은다.
 */
export function groupArchiveByDate<T extends { createdAtMs: number | null }>(
  items: T[],
  now: Date,
): ArchiveGroup<T>[] {
  const groups: ArchiveGroup<T>[] = [];
  const byKey = new Map<string, ArchiveGroup<T>>();
  const invalid: T[] = [];

  for (const item of items) {
    if (item.createdAtMs === null) {
      invalid.push(item);
      continue;
    }
    const key = localDateKey(item.createdAtMs);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: dateLabel(item.createdAtMs, now), cards: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.cards.push(item);
  }

  if (invalid.length > 0) {
    groups.push({ key: "unknown-date", label: "날짜 정보 없음", cards: invalid });
  }
  return groups;
}

/**
 * rail "쌓인 기록" — 실측 createdAt 만으로 월별 건수를 집계한다(가짜 수치 금지).
 * 데이터에 존재하는 월 중 최근 maxMonths 개를 최신순으로 반환. 날짜 미상은 집계에서 제외.
 */
export function monthlyArchiveCounts(
  items: { createdAtMs: number | null }[],
  now: Date,
  maxMonths = 4,
): ArchiveMonthlyCount[] {
  const byMonth = new Map<string, { ts: number; count: number }>();
  for (const item of items) {
    if (item.createdAtMs === null) continue;
    const d = new Date(item.createdAtMs);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const entry = byMonth.get(key);
    if (entry) entry.count += 1;
    else byMonth.set(key, { ts: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), count: 1 });
  }
  return [...byMonth.entries()]
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, maxMonths)
    .map(([key, { ts, count }]) => {
      const d = new Date(ts);
      const label =
        d.getFullYear() === now.getFullYear()
          ? `${d.getMonth() + 1}월`
          : `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
      return { key, label, count };
    });
}
