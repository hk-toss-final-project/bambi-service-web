import { toReportCoverImage } from "@/lib/adapters/report";
import { normalizeHttpUrl, normalizeText } from "@/lib/normalize";
import { toReportType } from "@/lib/report-type";
import { isUuid } from "@/lib/utils";
import type {
  CardAuthor,
  CardResponse,
  CardSocial,
  CardSource,
  CardSourceVM,
  FeedCardVM,
  MatchedCategory,
  MatchedTopic,
  PublicFeedAuthorVM,
  PublicFeedCardResponse,
  PublicFeedCardVM,
  PublicFeedSocialVM,
} from "@/types/feed";

/**
 * CardResponse(API DTO) → FeedCardVM(화면 모델) 변환.
 * 백엔드가 준 필드만 옮기고, createdAt(ISO)만 표시용 문자열로 포맷한다.
 * 없는 값(작성자·좋아요·댓글 등)은 만들지 않는다. member 피드는 인증 확정 후 클라이언트에서만
 * 렌더되므로(SSR 없음) 로컬 타임존 포맷의 하이드레이션 불일치 위험은 없다.
 */
const CREATED_AT_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatCreatedAt(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return ""; // 파싱 실패 시 표시 생략(임의 값 생성 금지)
  return CREATED_AT_FORMAT.format(new Date(ts));
}

/**
 * 출처 정규화 — 표시 전에 한 번만 정리한다(문자열·URL 기준은 lib/normalize.ts 공용).
 *
 * - title·url 이 모두 비어 있으면(null·undefined·""·공백) 그 출처는 제외한다.
 *   → 화면에 "[1]" 만 남는 빈 줄이나 문자열 "null" 이 나오지 않는다.
 * - title 만 있으면 링크 없는 텍스트 출처로 남긴다(url=null).
 * - title 이 없고 http/https URL 만 있으면 기존 표시 규칙(title ?? url) 그대로 URL 을 라벨로 쓴다.
 * - http/https 가 아닌 URL 은 외부 링크로 쓰지 않는다(url=null). 라벨로 쓸 title 도 없으면 제외된다.
 *
 * 결과 배열의 length 가 곧 "표시 가능한 출처 건수"다 — 원본 sources.length 를 세지 않는다.
 * 리포트 citations 와 합산하지 않는다(둘은 같은 발행 payload).
 */
export function toCardSources(
  sources: readonly (CardSource | null | undefined)[] | null | undefined,
): CardSourceVM[] {
  if (!Array.isArray(sources)) return [];
  const normalized: CardSourceVM[] = [];
  for (const source of sources) {
    if (source === null || typeof source !== "object") continue;
    const title = normalizeText(source.title);
    const url = normalizeHttpUrl(source.url);
    const label = title ?? url;
    if (label === null) continue; // 표시할 값이 없는 출처는 렌더 대상에서 제외
    normalized.push({ label, url });
  }
  return normalized;
}

/**
 * 카드가 공개(PUBLIC)인지 — 좋아요 UI 노출의 1차 조건.
 *
 * 서버 컬럼이 NOT NULL + CHECK(PRIVATE|PUBLIC) 이라 정상 응답에는 항상 값이 있지만,
 * 소셜 필드 배포 전 응답에는 키 자체가 없을 수 있다. 문자열 일치로만 판정해
 * 값이 없거나 예상 밖이면 "공개 아님"으로 다룬다(비공개 카드에 좋아요를 띄우면 404 를 부른다).
 */
export function isPublicCard(card: CardResponse): boolean {
  return card.visibility === "PUBLIC";
}

/**
 * 조회자가 이 카드의 **소유자**인지 — 공개 범위 변경 UI 노출의 유일한 조건.
 *
 * 판정은 `publicId` 두 개의 정확한 문자열 일치로만 한다. email·displayName·username·내부 순번 id
 * 로 추정하지 않는다(표시 이름은 중복·변경될 수 있고, 내부 id 는 응답에 없다).
 *
 * 두 값 중 하나라도 **UUID 형식이 아니거나 없으면 false** 다:
 * - `viewerPublicId` 없음/형식오류 → 게스트이거나 `publicId` 미배포 응답(User.publicId 는 optional)
 * - `card.author` 없음/형식오류 → 목록·저장·PATCH 응답 경로(author 가 계약상 null)이거나
 *   탈퇴·부재 작성자(AuthorResponse.from(null) — 세 필드 전부 null)
 * 확신할 수 없을 때 소유자로 보지 않는 쪽이 안전하다(변경 버튼을 잘못 띄우면 확실한 404 를 부른다).
 *
 * 대소문자를 접지 않는 이유: 두 값 모두 같은 서버가 같은 형식(소문자 UUID)으로 내려준다.
 * 임의 정규화로 "다른 값을 같다고 보는" 여지를 만들지 않는다.
 */
export function isCardOwner(card: CardResponse, viewerPublicId: string | null): boolean {
  const viewer = normalizeText(viewerPublicId);
  if (viewer === null || !isUuid(viewer)) return false;
  const author = normalizeText(card.author?.publicId);
  if (author === null || !isUuid(author)) return false;
  return viewer === author;
}

/**
 * 단건 상세의 소셜 필드 런타임 검증 — 좋아요 UI 가 쓸 수 있는 값일 때만 좁혀 돌려준다.
 *
 * 다음 경우는 전부 null(= "소셜 값 없음")이다:
 * - 소셜 필드 미배포 응답(키 자체가 없음)
 * - 목록·저장·visibility 변경 응답처럼 계약상 셋 다 null 인 경로
 * - 타입은 맞지만 값이 비정상인 경우(likeCount 가 음수·NaN·비정수 등)
 *
 * null 을 false·0 같은 기본값으로 덮지 않는다. 값이 없으면 화면이 좋아요 UI 를 렌더하지 않는 편이
 * "0개 좋아요, 누른 적 없음"이라고 잘못 단정하는 것보다 안전하다.
 */
export function toCardSocial(card: CardResponse): CardSocial | null {
  const { author, likeCount, liked } = card;
  if (author === null || typeof author !== "object") return null;
  if (typeof liked !== "boolean") return null;
  if (typeof likeCount !== "number" || !Number.isFinite(likeCount)) return null;
  if (!Number.isInteger(likeCount) || likeCount < 0) return null;
  return { author, likeCount, liked };
}

/**
 * 스크랩(보관) 여부 정규화 — 공개 피드와 단건 상세가 **같은 기준**으로 좁힌다.
 *
 * - `true` → 담아둠 · `false` → 담지 않음(둘 다 정상 값이라 그대로 통과)
 * - `null` · `undefined` · 비boolean(문자열 `"true"` 등) → **null = "알 수 없음"**
 *
 * 미상 값을 `false` 로 보정하지 않는 이유는 `toCardSocial`·`toPublicFeedSocial` 과 같다:
 * 필드가 없는 배포본이나 상세 외 경로(목록·저장·PATCH 응답)의 null 을 "담지 않음"이라고 단정하면,
 * 이미 담아둔 카드에 `보관` 버튼을 띄우고 클릭 한 번으로 멀쩡한 상태를 뒤집게 된다.
 * 알 수 없을 때는 화면이 버튼 자체를 렌더하지 않는 편이 안전하다.
 */
export function toScrapped(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** createdAt(ISO) → ms. 파싱 실패 시 null(대체 값 생성 금지) — 정렬·집계용. */
function parseCreatedAtMs(iso: string): number | null {
  const ts = Date.parse(iso);
  return Number.isNaN(ts) ? null : ts;
}

/** 목록 카드 메타용 시각만("오전 7:00") — 날짜는 상위 날짜 그룹이 이미 보여준다. */
const CREATED_TIME_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatCreatedTime(iso: unknown): string {
  if (typeof iso !== "string") return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return ""; // 파싱 실패 시 표시 생략(Invalid Date·현재 시각 fallback 금지)
  return CREATED_TIME_FORMAT.format(new Date(ts));
}

export function toFeedCardVM(card: CardResponse): FeedCardVM {
  return {
    publicId: card.publicId,
    title: card.title,
    summary: card.summary,
    whyForYou: card.whyForYou,
    // 서버 값 그대로 — 없거나 예상 밖이어도 여기서 PUBLIC/PRIVATE 로 보정하지 않는다.
    visibility: card.visibility,
    tags: toCardTags(card.tags),
    // 미배포 필드 — 없거나 계약 밖 값이면 null(화면은 종류 배지를 생략한다).
    reportType: toReportType(card.reportType),
    sources: toCardSources(card.sources),
    createdAtLabel: formatCreatedAt(card.createdAt),
    createdAtTimeLabel: formatCreatedTime(card.createdAt),
    createdAtMs: typeof card.createdAt === "string" ? parseCreatedAtMs(card.createdAt) : null,
    // 목록 응답에는 2026-08-11 배포 전까지 없던 필드다 — 없으면 null 이고 썸네일 자체가 안 생긴다.
    coverImage: toReportCoverImage(card.coverImage),
  };
}

/* ─────────────────────────────────────────────────────────────
   공개 피드 (GET /api/feed/public) — PublicCardResponse → 화면 모델
   ───────────────────────────────────────────────────────────── */

/**
 * 작성자 정규화 — `displayName` 과 `username` 을 **각각** 담는다(합치지 않는다).
 *
 * 목업(home-feed.html `.pname`)이 `표시이름 @핸들` 두 값을 나란히 보여주기 때문에 화면이 둘을
 * 구분할 수 있어야 한다. 여기서는 공백 정리(normalizeText)만 하고 `@` 는 붙이지 않는다 —
 * API 원문을 변조하지 않고 표기는 화면 단계에서만 만든다.
 *
 * 둘 다 없으면 두 필드와 initial 모두 null 이다. 서버가 탈퇴/부재 작성자에 대해 세 필드가 전부
 * null 인 AuthorResponse 를 주는 경로가 실제로 있고(AuthorResponse.from(null), FeedService 의 탈퇴
 * 작성자 TODO), 그때 "익명"·"사용자" 같은 이름을 만들어내면 존재하지 않는 사람을 화면에 그리는
 * 셈이다. 이니셜도 실제 이름(displayName → username 순)에서만 파생한다 — 이름이 없으면 이니셜도 없다.
 *
 * `publicId` 는 프로필 경로(`/users/{publicId}`)에 그대로 들어가므로 **UUID 형식일 때만** 담는다.
 * 형식이 아니거나 없으면 null → 화면이 링크 없이 텍스트로만 렌더한다(죽은 링크 금지).
 * 판정은 프로필 라우트(app/users/[publicId]/page.tsx)가 쓰는 공용 `isUuid` 와 같은 기준이다.
 */
export function toPublicFeedAuthor(author: CardAuthor | null | undefined): PublicFeedAuthorVM {
  if (author === null || typeof author !== "object") {
    return { publicId: null, displayName: null, username: null, initial: null };
  }
  const displayName = normalizeText(author.displayName);
  const username = normalizeText(author.username);
  const rawId = normalizeText(author.publicId);
  // 이니셜은 화면이 이름 자리에 쓰는 값과 같은 우선순위로 뽑는다(displayName → username).
  const primaryName = displayName ?? username;
  return {
    publicId: rawId !== null && isUuid(rawId) ? rawId : null,
    displayName,
    username,
    initial: primaryName === null ? null : Array.from(primaryName)[0],
  };
}

/**
 * 공개 피드 카드 1건 변환 — 렌더 불가한 항목은 **null** 을 돌려 호출부가 건너뛰게 한다.
 *
 * 건너뛰는 기준(둘 다 임의 기본값으로 메울 수 없는 값이다):
 * - `publicId` 가 UUID 문자열이 아님 → 상세 경로(/report/{publicId})를 만들 수 없다. 공개 피드
 *   카드의 목적이 상세 진입이라 죽은 링크를 만들거나 링크 없는 카드를 남기지 않고 제외한다.
 *   (React key 로도 쓰이므로 대체할 안정적 식별자가 없다.)
 * - `title` 이 비어 있음 → 카드의 유일한 필수 표시값이자 링크 텍스트다. "제목 없음" 같은 문구를
 *   대신 넣지 않는다.
 *
 * 나머지 필드는 값이 없으면 그 줄만 생략하고 카드는 살린다(summary·출처·작성자·작성시각).
 *
 * `whyForYou` 는 **의도적으로 옮기지 않는다.** 계약에는 있지만 카드 소유자 관점으로 쓰인 문장이라
 * ("회원님이 방금 저장한 콘텐츠와 같은 주제를 다루고 있어요") 남의 카드를 보는 조회자에게는 사실이
 * 아니다. 서버도 이 필드를 폐기(관심사 태그로 대체) 예정으로 표시해 두었다. 공개 노출 정책이
 * 확정되면 그때 붙인다 — 추측으로 먼저 노출하지 않는다.
 *
 * 좋아요는 `toPublicFeedSocial` 로 분리해 검증한다 — 값이 온전하지 않으면 카드는 살리고 좋아요
 * 영역만 렌더하지 않는다(0·false 로 보정하지 않는다). 보관(`scrapped`)도 같은 규율이되
 * **별도 필드**라 서로의 검증 결과에 영향을 주지 않는다.
 */
export function toPublicFeedCardVM(
  card: PublicFeedCardResponse | null | undefined,
): PublicFeedCardVM | null {
  if (card === null || typeof card !== "object") return null;

  const publicId = normalizeText(card.publicId);
  if (publicId === null || !isUuid(publicId)) return null;

  const title = normalizeText(card.title);
  if (title === null) return null;

  return {
    publicId,
    title,
    summary: normalizeText(card.summary) ?? "",
    author: toPublicFeedAuthor(card.author),
    social: toPublicFeedSocial(card),
    // 좋아요와 **독립적으로** 검증한다 — 한쪽이 깨져도 다른 쪽 UI 는 살린다.
    scrapped: toScrapped(card.scrapped),
    sources: toCardSources(card.sources),
    createdAtLabel: typeof card.createdAt === "string" ? formatCreatedAt(card.createdAt) : "",
    tags: toCardTags(card.tags),
    matchedTopics: toMatchedTopics(card.matchedTopics),
    matchedCategories: toMatchedCategories(card.matchedCategories),
  };
}

/**
 * 관심사 태그 정규화 — 문자열이 아니거나 공백뿐인 항목을 버리고 trim 한 값만 남긴다.
 * 서버가 `tags` 를 아직 안 내려주는 배포본(키 없음)이나 null 이면 빈 배열이다.
 * 카드의 관심사 메타 표시(첫 태그 + `+N`) 전용이며, 추천 후보 판정에는 쓰이지 않는다
 * (판정은 matchedTopics/matchedCategories — 아래 toMatchedTopics/toMatchedCategories 참조).
 */
export function toCardTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  // 중복 판정은 lib/feed-mix.ts 의 태그 비교와 같은 기준(trim + 소문자)이고,
  // **화면 표기는 첫 유효 값을 그대로** 유지한다(대소문자를 임의로 바꾸지 않는다).
  const seen = new Set<string>();
  for (const tag of tags) {
    const text = normalizeText(tag);
    if (text === null) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

/**
 * 추천 매칭 topic 정규화(`types/feed.ts` MatchedTopic 참조) — 배열이 아니면 빈 배열, 항목별로
 * `topicId`·`name` 이 둘 다 비어있지 않은 문자열일 때만 남긴다. 하나라도 어긋나는 항목은 그 항목만
 * 건너뛴다(카드 전체를 실패로 만들지 않는다 — toPublicFeedCards 와 같은 규율). 필드 자체가 없는
 * 배포본(service-api #81 머지 전 등)에서도 빈 배열이라 화면은 그대로 동작한다.
 */
export function toMatchedTopics(value: unknown): MatchedTopic[] {
  if (!Array.isArray(value)) return [];
  const out: MatchedTopic[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") continue;
    const topicId = normalizeText((entry as { topicId?: unknown }).topicId);
    const name = normalizeText((entry as { name?: unknown }).name);
    if (topicId === null || name === null) continue;
    out.push({ topicId, name });
  }
  return out;
}

/** 추천 후보 판정용(넓은 매칭) category 정규화 — `types/feed.ts` MatchedCategory 참조. */
export function toMatchedCategories(value: unknown): MatchedCategory[] {
  if (!Array.isArray(value)) return [];
  const out: MatchedCategory[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") continue;
    const categoryId = normalizeText((entry as { categoryId?: unknown }).categoryId);
    const name = normalizeText((entry as { name?: unknown }).name);
    if (categoryId === null || name === null) continue;
    out.push({ categoryId, name });
  }
  return out;
}

/**
 * 좋아요 값 런타임 검증 — 서버 primitive(`long`·`boolean`)라 정상 응답에서는 항상 오지만,
 * 배포 차이·비정상 응답을 계약 위반으로 취급하고 **기본값으로 덮지 않는다**.
 *
 * 통과 조건은 둘 다 만족해야 한다:
 * - `likeCount` 가 0 이상의 정확한 정수 (음수·NaN·Infinity·소수 전부 거른다)
 * - `liked` 가 진짜 boolean (`null`·`"false"` 같은 문자열은 거른다)
 *
 * 하나라도 어긋나면 null → 화면이 좋아요 영역을 그리지 않는다. `likeCount: 0`·`liked: false` 는
 * **정상 값이므로 통과**한다(0개·누르지 않음은 사실이며, 검증 실패와 구분된다).
 * 단건 상세의 toCardSocial 과 같은 규율을 공개 피드에도 그대로 적용한 것이다.
 */
export function toPublicFeedSocial(
  card: Pick<PublicFeedCardResponse, "likeCount" | "liked">,
): PublicFeedSocialVM | null {
  const { likeCount, liked } = card;
  if (typeof liked !== "boolean") return null;
  if (typeof likeCount !== "number" || !Number.isInteger(likeCount) || likeCount < 0) return null;
  return { likeCount, liked };
}

/**
 * 공개 피드 배열 변환 — 렌더 불가 항목만 제외하고 나머지는 그대로 살린다.
 *
 * 배열 자체가 아니면(계약 위반) 빈 배열이 아니라 **throw** 한다 → 훅이 error 상태로 정규화해
 * "공개 브리핑이 없어요"(Empty)와 "불러오지 못했어요"(Error)가 섞이지 않는다.
 * 일부 항목만 잘못된 경우는 전체를 실패로 만들지 않는다(멀쩡한 카드는 보여준다).
 */
export function toPublicFeedCards(
  cards: readonly (PublicFeedCardResponse | null | undefined)[] | null | undefined,
): PublicFeedCardVM[] {
  if (!Array.isArray(cards)) {
    throw new TypeError("public feed: expected an array of cards");
  }
  const result: PublicFeedCardVM[] = [];
  for (const card of cards) {
    const vm = toPublicFeedCardVM(card);
    if (vm !== null) result.push(vm);
  }
  return result;
}
