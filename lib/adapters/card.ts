import { normalizeHttpUrl, normalizeText } from "@/lib/normalize";
import type {
  CardResponse,
  CardSocial,
  CardSource,
  CardSourceVM,
  FeedCardVM,
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

export function toFeedCardVM(card: CardResponse): FeedCardVM {
  return {
    publicId: card.publicId,
    title: card.title,
    summary: card.summary,
    whyForYou: card.whyForYou,
    sources: toCardSources(card.sources),
    createdAtLabel: formatCreatedAt(card.createdAt),
  };
}
