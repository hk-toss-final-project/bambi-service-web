/**
 * 피드·저장 API 계약 타입 (bambi-service-api 실측 · 검증일 2026-07-23).
 *
 *   GET  /api/feed      → ApiResponse<CardResponse[]>            (인증, 최신순, 신규계정은 [])
 *   POST /api/bookmarks → 201 ApiResponse<{ bookmark, card }>   (인증)
 *
 * 원칙: API DTO(CardResponse)와 화면 모델(FeedCardVM)을 분리한다. 백엔드가 주지 않는 값
 * (댓글·태그·saved 등)은 만들지 않는다.
 *
 * 소셜 필드(2026-08-04, service-api PR #35 CardResponse.java·CardService.get 실측):
 * - visibility 는 카드 자체 값이라 모든 경로에서 채워진다(DB NOT NULL + CHECK PRIVATE|PUBLIC).
 * - author·likeCount·liked 는 **단건 상세(GET /api/cards/{publicId})에서만** 채워진다.
 *   목록(GET /api/feed)·저장 응답·PATCH visibility 응답은 CardResponse.from() 경로라 셋 다 null 이다.
 * - 게스트 단건 상세는 liked=false(서버가 viewerId 없음 → false, null 아님).
 */

/**
 * 카드 출처 1건(API DTO) — title·url 이 각각 독립적으로 null 일 수 있고,
 * 실제 응답에는 { "title": null, "url": null } 처럼 둘 다 빈 항목도 존재한다(2026-08-04 실측).
 * 화면에 그대로 넘기지 말고 lib/adapters/card.ts 의 toCardSources 로 정규화한다.
 */
export type CardSource = {
  title: string | null;
  url: string | null;
};

/**
 * 정규화된 출처 1건(화면 모델) — 표시할 값이 하나도 없는 출처는 애초에 만들어지지 않는다.
 * label 은 항상 비어 있지 않고, url 은 http/https 로 실제 이동 가능한 경우에만 채운다.
 */
export type CardSourceVM = {
  label: string;
  url: string | null;
};

/** 카드 공개 범위 — DB CHECK 제약(PRIVATE|PUBLIC)과 1:1. 서버 컬럼이 NOT NULL 이라 항상 값이 있다. */
export type CardVisibility = "PUBLIC" | "PRIVATE";

/**
 * 작성자 요약 — 공개피드 PublicCardResponse.AuthorResponse 와 같은 모양.
 * 서버가 탈퇴/부재 작성자에 대해 세 필드 모두 null 인 객체를 줄 수 있다(AuthorResponse.from(null)).
 */
export type CardAuthor = {
  publicId: string | null;
  username: string | null;
  displayName: string | null;
};

/**
 * 카드 응답 DTO — GET /api/feed 항목이자 GET /api/cards/{publicId}·POST /api/bookmarks 응답의 card.
 * 대외 식별자는 publicId(UUID)만 노출한다(내부 순번 id 없음).
 * reportId 는 2026-08-03 실측 추가(service-api PR #25 — CardResponse.java·FeedService 확인).
 */
export type CardResponse = {
  publicId: string;
  /**
   * 이 카드의 본문(리포트) publicId — GET /api/reports/{reportId} 진입점.
   *
   * 배포된 응답에서 UUID 문자열 · null · (필드 자체 누락으로 인한) undefined 가 모두 올 수 있어
   * optional + nullable 로 둔다. 타입만으로는 배포본을 보장할 수 없으므로 값 판별은
   * lib/repositories/report.ts 의 normalizeReportId(런타임 정규화)로 단일화한다.
   * 리포트가 없는 카드(동기 즉시 카드 등)는 "본문 없음"이며, 그 외 의미를 추측하지 않는다.
   */
  reportId?: string | null;
  title: string;
  summary: string;
  whyForYou: string;
  /** 카드 공개 범위. 모든 응답 경로에서 채워진다(서버 컬럼 NOT NULL). */
  visibility: CardVisibility;
  /** 단건 상세에서만 채워진다. 목록·저장·visibility 변경 응답에서는 null. */
  author: CardAuthor | null;
  /** 단건 상세에서만 채워진다. 목록·저장·visibility 변경 응답에서는 null. */
  likeCount: number | null;
  /** 단건 상세에서만 채워진다(게스트는 false). 목록·저장·visibility 변경 응답에서는 null. */
  liked: boolean | null;
  sources: CardSource[];
  createdAt: string; // ISO-8601 (서버 OffsetDateTime)
};

/**
 * 단건 상세에서 확정된 소셜 값 — 좋아요 UI 가 쓰는 최소 집합.
 * CardResponse 의 nullable 소셜 필드를 런타임 검증(lib/adapters/card.ts 의 toCardSocial)으로
 * 좁힌 결과다. 검증에 실패하면 null 이며, 그때 화면은 좋아요 UI 를 렌더하지 않는다
 * (?? false · ?? 0 같은 기본값으로 계약 누락을 덮지 않는다).
 */
export type CardSocial = {
  author: CardAuthor;
  likeCount: number;
  liked: boolean;
};

/**
 * POST/DELETE /api/cards/{publicId}/like 성공 data (service-api LikeResponse 실측).
 * 요청 body 는 없다. 두 값 모두 서버 확정값 — 프론트가 증감을 계산하지 않는다.
 */
export type LikeData = {
  liked: boolean;
  likeCount: number;
};

/**
 * POST /api/bookmarks 요청 body. url·content 중 최소 하나 필수(서버 검증),
 * title 선택. 서버 길이 제한: url ≤ 2048, title ≤ 500.
 */
export type CreateBookmarkRequest = {
  url?: string;
  title?: string;
  content?: string;
};

/**
 * POST /api/bookmarks 성공(201) data. 이번 범위에서는 card 만 사용하고
 * bookmark 내부 구조는 해석하지 않는다(unknown 유지).
 */
export type BookmarkCreateData = {
  bookmark: unknown;
  card: CardResponse;
};

/**
 * 화면 카드 모델 — DTO에서 화면이 필요한 값만 옮긴 것. 어댑터(lib/adapters/card.ts)가 변환한다.
 * createdAt 은 표시용 문자열(createdAtLabel)로만 가진다.
 */
export type FeedCardVM = {
  publicId: string;
  title: string;
  summary: string;
  whyForYou: string;
  /** 정규화된 출처만 담는다 — 빈 출처는 제외되므로 length 가 곧 표시 가능한 출처 건수다. */
  sources: CardSourceVM[];
  createdAtLabel: string;
};
