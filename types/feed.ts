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

import type { ReportType } from "@/types/report";

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
  /**
   * 관심사 태그 — service-api #37(`28932d8`)에서 `CardResponse` 에도 추가됐다(2026-08-05 실측).
   * 서버는 `List.copyOf(card.interestTags)` 로 내려주므로 null 이 아니라 빈 배열이다.
   * 이 필드가 없는 배포본에서도 화면이 깨지지 않게 optional 로 두고, 값 판별은 어댑터
   * (`toCardTags`)가 한다 — 가짜 태그를 만들지 않는다.
   */
  tags?: string[] | null;
  /**
   * 보고서 생성 종류(아침 브리핑·온디맨드). **아직 배포되지 않은 필드**라 optional 이다 —
   * 없는 배포본에서도 화면이 깨지지 않게 두고, 값 판별은 `lib/report-type.ts` 가 런타임에서 한다.
   * 제목·공개 여부·작성 시각 같은 다른 값으로 종류를 추론하거나 보정하지 않는다.
   */
  reportType?: ReportType | null;
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
 * createdAt 은 표시용 문자열(createdAtLabel) + 정렬·집계용 ms 두 형태로 가진다.
 */
export type FeedCardVM = {
  publicId: string;
  title: string;
  summary: string;
  whyForYou: string;
  /**
   * 카드 공개 범위 — **서버 값 그대로**다. 정상 응답에서는 항상 PUBLIC|PRIVATE 이지만(컬럼 NOT NULL
   * + CHECK), 계약이 깨진 응답을 임의로 한쪽으로 보정하지 않기 위해 좁히지 않고 담는다.
   * 집계하는 쪽(lib/adapters/home-rail.ts)이 "둘 중 어느 것도 아님"을 별도로 다룬다.
   */
  visibility: CardVisibility;
  /**
   * 정규화된 관심사 태그 — 공백 제거, 대소문자 기준 중복 제거(표기는 첫 유효 값 유지).
   * 카드가 그대로 렌더할 수 있는 형태다. 카테고리·해시태그를 임의로 만들지 않는다.
   */
  tags: string[];
  /**
   * 검증을 통과한 보고서 생성 종류. 서버가 안 주거나(필드 미배포) 계약 밖 값이면 **null** 이고,
   * 그때 화면은 종류 배지를 렌더하지 않는다(`ReportTypeBadge`). 기본값을 채우지 않는다.
   */
  reportType: ReportType | null;
  /** 정규화된 출처만 담는다 — 빈 출처는 제외되므로 length 가 곧 표시 가능한 출처 건수다. */
  sources: CardSourceVM[];
  createdAtLabel: string;
  /** 목록 카드 메타에 쓰는 시각만("오전 7:00"). 유효한 createdAt 일 때만 채우고 실패 시 빈 문자열. */
  createdAtTimeLabel: string;
  /**
   * createdAt(ISO) 파싱 결과(ms). **파싱 실패 시 null** — 대체 날짜를 만들지 않는다.
   * 서버가 최신순으로 주지만 목록 순서에만 의존하지 않고 최신 판정을 실제 값으로 하려고 담는다
   * (/reports 의 ArchiveCard.createdAtMs 와 같은 규율).
   */
  createdAtMs: number | null;
};

/* ─────────────────────────────────────────────────────────────
   공개 피드 — GET /api/feed/public
   (bambi-service-api 실측 · 검증일 2026-08-04: FeedController·FeedService·PublicCardResponse)
   ───────────────────────────────────────────────────────────── */

/**
 * 공개 피드 카드 응답 DTO — `GET /api/feed/public` 배열 항목.
 *
 * **`CardResponse` 와 다른 별도 DTO다.** 서버가 내 피드용 `CardResponse` 와 의도적으로 분리해
 * 두었으므로(PublicCardResponse — "내 피드용 CardResponse 와 분리해 P0 회귀를 막는다") 여기서도
 * 섞지 않는다. 특히 아래 두 필드가 **없다**:
 * - `reportId` 없음 → 목록에서 본문으로 바로 갈 수 없다. 상세 진입은 `/report/{publicId}`(카드
 *   publicId)이고, 본문(reportId)은 카드 상세 화면이 자기 요청으로 알아낸다.
 * - `visibility` 없음 → 이 엔드포인트는 쿼리 자체가 `visibility = 'PUBLIC'` 이라 전부 공개 카드다
 *   (CardRepository.findPublicFeed). 프론트가 다시 필터링해서 "걸렀다"고 착각하지 않는다.
 *
 * 요청 계약:
 * - 정렬 `createdAt desc`. 쿼리 파라미터 `limit`(기본 20, 서버가 1~50 으로 clamp) · `following`
 *   (기본 false, true 면 로그인 필요 — 게스트는 401). **커서·offset 페이지네이션 없음**(항상 page 0)
 *   → 무한 스크롤·다음 페이지를 만들 수 없다.
 * - 비로그인 허용(SecurityConfig 에서 GET permitAll). 토큰은 optional 이지만 **의미가 있다**:
 *   `liked` 가 조회자 기준이라 로그인 상태면 Bearer 를 실어야 정확한 값이 온다(2026-08-04 실측 확인).
 *
 * nullability (Java 시그니처 기준):
 * - `likeCount: long` · `liked: boolean` 은 primitive → **null 이 오지 않는다**(게스트는 liked=false).
 * - `author` 객체 자체는 항상 있지만 **세 필드가 모두 null 일 수 있다**(AuthorResponse.from(null)).
 *   서버에 "탈퇴 작성자의 PUBLIC 카드가 피드에 남는다"는 TODO 가 있어 실제로 발생 가능한 경로다.
 * - `sources[].title` · `sources[].url` 은 각각 독립적으로 null(둘 다 null 인 항목도 존재).
 * - `whyForYou` 는 계약에 있으나 서버 주석에 폐기 예정(태그로 대체) TODO 가 달려 있다.
 */
export type PublicFeedCardResponse = {
  publicId: string;
  title: string;
  summary: string;
  /** 카드 소유자 관점의 개인 추천 사유. 공개 피드 화면에서는 렌더하지 않는다(어댑터 주석 참조). */
  whyForYou: string;
  /**
   * 관심사 태그 — service-api #37(`28932d8`)에서 추가됐다. 서버는 `List.copyOf(card.interestTags)`
   * 로 내려주므로 **null 이 아니라 빈 배열**이고, 발행 워커(PublishProcessingService)가 agent 발행
   * 태그로 통째 교체한다(태그 없는 카드는 `[]`).
   *
   * **optional 인 이유**: 이 필드가 없는 배포본이 아직 존재한다(2026-08-05 실측: 배포·로컬 응답 모두
   * `tags` 키 없음). 키가 없어도 화면이 깨지지 않게 optional 로 두고, 값 판별은 어댑터가 한다.
   * 화면에 태그를 표시하지는 않는다 — 추천 후보 판정(관심사 일치)에만 쓴다.
   */
  tags?: string[] | null;
  /** 객체는 항상 존재. 단 publicId·username·displayName 이 동시에 null 일 수 있다. */
  author: CardAuthor;
  /** 카드 전체 좋아요 수(조회자 무관). primitive long → null 없음. */
  likeCount: number;
  /** **조회자 기준** 좋아요 여부. primitive boolean → null 없음. 비로그인은 false. */
  liked: boolean;
  sources: CardSource[];
  createdAt: string; // ISO-8601 (서버 OffsetDateTime)
};

/**
 * 정규화된 작성자(화면 모델).
 *
 * `displayName` 과 `username` 을 **합치지 않고 따로** 담는다. 목업(home-feed.html `.pname`)이
 * `표시이름 @핸들` 두 값을 나란히 보여주기 때문이고, 합쳐 두면 화면이 둘을 되살릴 수 없다.
 * 각 값은 서버가 실제로 준 것만 담고 없으면 null 이다 — "익명"·"사용자1" 같은 이름이나 가짜 핸들을
 * 만들지 않는다(서버는 탈퇴/부재 작성자에 대해 세 필드가 전부 null 인 객체를 준다).
 *
 * `@` 는 **여기 담지 않는다.** API 원문을 변조하지 않고, 표기는 화면 단계에서만 붙인다.
 * 둘 다 없으면 화면이 "작성자 정보 없음"으로 렌더한다.
 *
 * `initial` 은 `displayName ?? username` 에서 파생한 첫 글자다 — 이름이 없으면 이니셜도 null
 * (가짜 이니셜 금지).
 */
export type PublicFeedAuthorVM = {
  /**
   * 프로필 경로(`/users/{publicId}`)에 쓸 수 있는 UUID. 형식이 아니거나 없으면 null →
   * 화면이 링크를 만들지 않고 텍스트로만 렌더한다(죽은 링크 금지).
   */
  publicId: string | null;
  /** 서버 `displayName` 원문(공백 정리만). 없으면 null. */
  displayName: string | null;
  /** 서버 `username` 원문(공백 정리만, `@` 없음). 없으면 null. */
  username: string | null;
  initial: string | null;
};

/**
 * 검증을 통과한 공개 피드 좋아요 값 — 둘 다 **서버 확정값**이다.
 * 검증에 실패하면 이 객체를 만들지 않고 null 로 둔다(단건 상세의 CardSocial 과 같은 규율):
 * `0`·`false` 를 채워 넣으면 계약이 깨진 응답을 "좋아요 0개, 누른 적 없음"이라고 단정하게 된다.
 */
export type PublicFeedSocialVM = {
  likeCount: number;
  liked: boolean;
};

/**
 * 공개 피드 카드 화면 모델 — 실제로 렌더할 값만.
 * DTO 의 `whyForYou` 는 여기에 없다(공개 피드 미노출 결정 — lib/adapters/card.ts 참조).
 */
export type PublicFeedCardVM = {
  publicId: string;
  title: string;
  summary: string;
  author: PublicFeedAuthorVM;
  /**
   * 좋아요 값 — 검증을 통과했을 때만 채워진다. null 이면 화면이 **좋아요 영역 자체를 렌더하지
   * 않는다**(이번 범위에서는 읽기 전용 표시이고, 토글은 카드 상세에만 연결돼 있다).
   * 카드의 나머지(제목·요약·작성자·출처)는 social 이 null 이어도 그대로 렌더한다.
   */
  social: PublicFeedSocialVM | null;
  /** 정규화된 출처만 담는다 — 빈 출처는 제외되므로 length 가 곧 표시 가능한 출처 건수다. */
  sources: CardSourceVM[];
  /** 파싱 실패 시 빈 문자열(임의 날짜 생성 금지) — 화면은 빈 값이면 줄을 생략한다. */
  createdAtLabel: string;
  /**
   * 정규화된 관심사 태그(공백 제거·빈 값 제외). 두 곳에서 쓴다:
   * 추천 후보 판정(내 관심사와 하나 이상 일치)과, 카드의 관심사 메타 표시(첫 태그 + `+N`).
   * 서버가 tags 를 안 주는 배포본에서는 빈 배열이고, 그때 화면은 관심사 줄을 렌더하지 않는다.
   */
  tags: string[];
};

/* ─────────────────────────────────────────────────────────────
   홈 우측 rail — [내 보고서](GET /api/feed) 파생 집계
   ───────────────────────────────────────────────────────────── */

/**
 * 내 보고서 현황 — `FeedCardVM[]`(= GET /api/feed 결과) 하나만 보고 계산한 값.
 * 별도 API 호출·별도 DTO 없이 홈이 이미 가진 목록에서만 파생한다(중복 조회 금지).
 *
 * `unknownVisibility` 가 있는 이유: 공개/비공개는 서버 `visibility` 값으로만 세고, 둘 중 어느
 * 것에도 해당하지 않는 항목을 임의로 한쪽에 더하지 않는다. 그래서 계약이 깨진 응답에서는
 * `publicCount + privateCount < total` 이 될 수 있고, 그 차이를 조용히 숨기지 않고 이 필드로 드러낸다
 * (화면은 0 보다 클 때만 한 줄을 덧붙인다 — 정상 응답에서는 항상 0 이라 보이지 않는다).
 */
export type MyReportsSummary = {
  total: number;
  publicCount: number;
  privateCount: number;
  /** PUBLIC·PRIVATE 어느 쪽도 아닌 항목 수. 정상 응답에서는 0. */
  unknownVisibility: number;
  /**
   * 가장 최근 보고서의 작성일 표시 문자열. 유효한 날짜가 하나도 없으면 null →
   * 화면이 그 줄을 생략한다(임의 날짜 생성 금지).
   */
  latestCreatedLabel: string | null;
};
