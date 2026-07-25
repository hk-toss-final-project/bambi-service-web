/**
 * 인증 만료(같은 탭) 이벤트 (CLAUDE.md §5).
 *
 * 데이터 요청 중 AUTH_INVALID_TOKEN 이 오면 api-client 가 저장 토큰을 제거한 뒤 이 이벤트를 발생시키고,
 * AuthProvider 가 구독해 같은 탭의 인증 상태를 즉시 guest 로 동기화한다.
 * (localStorage 변경만으로는 같은 탭 React 상태가 갱신되지 않으므로 별도 신호가 필요하다.)
 *
 * - 이벤트 이름 리터럴을 여러 파일에 흩뿌리지 않기 위한 최소 모듈 — 이름 + emit/subscribe 만 둔다.
 * - 같은 탭 전용(window CustomEvent). 멀티 탭 storage 동기화는 범위 밖.
 * - 리다이렉트는 하지 않는다(§4·§5). 상태 동기화만 담당한다.
 */
const AUTH_EXPIRED_EVENT = "bambi:auth-expired";

/** 인증 만료를 같은 탭에 알린다(브라우저에서만). */
export function emitAuthExpired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

/** 인증 만료 구독. cleanup 함수를 반환한다(브라우저에서만 등록, SSR 에선 no-op). */
export function onAuthExpired(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
}
