import { apiGet } from "@/lib/api-client";
import type { CardResponse, PublicFeedCardResponse } from "@/types/feed";

/**
 * 피드 데이터 repository — 화면 훅과 데이터 소스 사이의 단일 seam.
 *
 * 두 피드 모두 실 API 다(mock 없음):
 *   [내 보고서] GET /api/feed         → CardResponse[]            (인증 필수, 최신순)
 *   [피드]      GET /api/feed/public  → PublicFeedCardResponse[]  (비로그인 허용, 최신순)
 *
 * 두 응답은 **서로 다른 DTO** 다 — 서버가 공개 피드를 PublicCardResponse 로 분리해 두었으므로
 * (내 피드 P0 회귀 차단 목적) 프론트도 타입을 섞지 않는다. 계약 상세는 types/feed.ts 참조.
 */

/**
 * [피드] 탭 — 공개 피드. 두 범위 모두 **같은 엔드포인트·같은 DTO** 이고 `following` 값만 다르다.
 *
 * - `following: false`(추천) — 비로그인 허용. 서버 쿼리는 "PUBLIC 카드 전체 최신순"이다.
 *   **개인화 랭킹이 아니다** — 추천 점수·추천 사유 같은 값은 서버에 없다.
 * - `following: true`(팔로잉) — 로그인 필수. 내가 팔로우한 작성자의 PUBLIC 카드만 최신순.
 *   게스트가 호출하면 서버가 `AUTH_INVALID_TOKEN` 을 던진다(2026-08-05 실측: 배포·로컬 모두 401).
 *   팔로우 0명이거나 대상의 PUBLIC 카드가 0건이면 정상 빈 배열이다.
 *
 * 인증은 추천에서도 의미가 있다: 응답의 `liked` 가 조회자 기준이라 로그인 상태면 Bearer 를
 * 실어야 정확한 값이 온다(2026-08-04 실측: 같은 카드가 토큰 유무로 liked true/false 로 갈림).
 * 공통 client 의 기본값(`auth: true`)이 정확히 그 동작이다 — 저장된 토큰이 있으면 붙이고 없으면
 * 헤더를 생략한다. 그래서 두 범위 모두 `{ auth: false }` 를 주지 않는다(팔로잉은 토큰이 필수이고,
 * 추천은 있으면 쓰고 없으면 게스트로 나간다).
 *
 * `limit` 은 서버 기본값(20)을 그대로 쓴다. 서버가 항상 page 0 만 돌려주고 커서·offset 이 없어
 * "다음 페이지" 개념이 없다 → 여기서도 페이지 파라미터를 만들지 않는다.
 */
export function fetchPublicFeed({
  following = false,
  signal,
}: { following?: boolean; signal?: AbortSignal } = {}): Promise<PublicFeedCardResponse[]> {
  // following=false 도 명시해 보낸다 — 서버 기본값과 같지만 요청만 보고 어느 범위인지 알 수 있다.
  const path = `/api/feed/public?following=${following ? "true" : "false"}`;
  return apiGet<PublicFeedCardResponse[]>(path, { signal });
}

/**
 * [내 보고서] 탭 — 로그인 사용자의 카드 피드. GET /api/feed(인증, 최신순).
 * 빈 배열(신규 계정 등)이면 훅이 empty 로 정규화한다.
 */
export function fetchMemberFeed(signal?: AbortSignal): Promise<CardResponse[]> {
  return apiGet<CardResponse[]>("/api/feed", { signal });
}
