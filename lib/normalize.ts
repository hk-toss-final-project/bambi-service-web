/**
 * 응답 값 정리 공통 유틸 — 카드 sources · 리포트 citations 가 같은 기준을 쓰도록 한 곳에 둔다.
 *
 * 백엔드는 title·url 을 각각 독립적으로 null 로 줄 수 있고(둘 다 null 인 항목도 실제로 존재),
 * 빈 문자열·공백 문자열도 관측된다. "값이 없음"의 판정을 화면마다 다르게 하지 않기 위해
 * 어댑터들이 이 두 함수만 쓴다. 없는 값을 만들어내지 않는다(가짜 URL·가짜 라벨 금지).
 */

/** 문자열 정리 — 문자열이 아니거나 공백뿐이면 null. */
export function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * 외부 링크로 쓸 수 있는 URL 만 통과시킨다 — http/https 만 허용한다.
 * 스킴이 다르거나(javascript: 등) 파싱이 실패하는 문자열은 링크로 만들지 않는다.
 */
export function normalizeHttpUrl(value: unknown): string | null {
  const text = normalizeText(value);
  if (text === null) return null;
  try {
    const parsed = new URL(text);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? text : null;
  } catch {
    return null; // 상대경로·깨진 문자열 등
  }
}
