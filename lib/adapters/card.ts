import { normalizeHttpUrl, normalizeText } from "@/lib/normalize";
import type { CardResponse, CardSource, CardSourceVM, FeedCardVM } from "@/types/feed";

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
