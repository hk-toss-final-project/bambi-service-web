import type { FeedCardVM, MyReportsSummary } from "@/types/feed";

/**
 * 홈 우측 rail 파생 계산 — 입력은 홈이 이미 가진 `FeedCardVM[]`(GET /api/feed 결과) 하나뿐이다.
 * rail 때문에 API 를 다시 부르지 않고, 렌더 중 반복 계산하지 않도록 순수 함수로 한 번에 정리한다.
 */

/** 날짜만 표시하는 포맷 — rail 은 시각까지 필요 없다(카드 본문은 createdAtLabel 로 시각까지 표시). */
const DATE_ONLY_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/**
 * 내 보고서 현황 집계.
 *
 * - 공개/비공개는 **서버 visibility 값만**으로 센다. 둘 중 어느 것도 아닌 항목은 어느 쪽에도
 *   더하지 않고 `unknownVisibility` 로 따로 센다 → 합이 total 과 어긋나도 거짓 수치를 만들지 않는다.
 * - 최근 작성일은 **목록 순서에 의존하지 않고** 유효한 createdAtMs 의 최대값으로 판정한다.
 *   서버가 최신순을 보장하지만(createdAt desc) 그 계약이 바뀌어도 값이 틀리지 않게 한다.
 *   유효한 날짜가 하나도 없으면 null → 화면이 그 줄을 생략한다.
 */
export function toMyReportsSummary(cards: readonly FeedCardVM[]): MyReportsSummary {
  let publicCount = 0;
  let privateCount = 0;
  let unknownVisibility = 0;
  let latestMs: number | null = null;

  for (const card of cards) {
    if (card.visibility === "PUBLIC") publicCount += 1;
    else if (card.visibility === "PRIVATE") privateCount += 1;
    else unknownVisibility += 1;

    if (card.createdAtMs !== null && (latestMs === null || card.createdAtMs > latestMs)) {
      latestMs = card.createdAtMs;
    }
  }

  return {
    total: cards.length,
    publicCount,
    privateCount,
    unknownVisibility,
    latestCreatedLabel: latestMs === null ? null : DATE_ONLY_FORMAT.format(new Date(latestMs)),
  };
}

/**
 * 최근 보고서 N건 — 상세 링크를 안전하게 만들 수 있는 항목만 고른다.
 *
 * 제외 기준(둘 다 대체할 수 없는 값이다):
 * - publicId 가 비어 있음 → `/report/{publicId}` 를 만들 수 없다(죽은 링크·불안정한 key 금지).
 * - title 이 비어 있음 → 링크 텍스트가 없다("제목 없음" 같은 문구를 만들지 않는다).
 *
 * 정렬은 createdAtMs 내림차순이고, 날짜가 없는 항목(null)은 뒤로 보낸다 — 목록 순서에만
 * 기대지 않고 실제 값으로 "최신"을 정한다.
 */
export function pickRecentReports(cards: readonly FeedCardVM[], limit: number): FeedCardVM[] {
  return cards
    .filter((card) => card.publicId.trim() !== "" && card.title.trim() !== "")
    .slice()
    .sort((a, b) => (b.createdAtMs ?? -Infinity) - (a.createdAtMs ?? -Infinity))
    .slice(0, limit);
}
