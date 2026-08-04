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
 * [피드] 탭 — 공개 피드. member·guest 가 **같은** 엔드포인트를 쓴다.
 *
 * 인증은 optional 이지만 의미가 있다: 응답의 `liked` 가 조회자 기준이라 로그인 상태면 Bearer 를
 * 실어야 정확한 값이 온다(2026-08-04 실측: 같은 카드가 토큰 유무로 liked true/false 로 갈림).
 * 공통 client 의 기본값(`auth: true`)이 정확히 그 동작이다 — 저장된 토큰이 있으면 붙이고 없으면
 * 헤더를 생략한다. 그래서 `{ auth: false }` 를 주지 않는다.
 *
 * `limit`·`following` 은 서버 기본값(20 · false)을 그대로 쓴다. 서버가 항상 page 0 만 돌려주고
 * 커서·offset 이 없어 "다음 페이지" 개념이 없다 → 여기서도 페이지 파라미터를 만들지 않는다.
 * (`following=true` 는 팔로잉 스코프로 로그인이 필요하며 이번 범위가 아니다.)
 *
 * 빈 배열(공개 카드 없음)이면 훅이 empty 로 정규화한다.
 */
export function fetchPublicFeed(signal?: AbortSignal): Promise<PublicFeedCardResponse[]> {
  return apiGet<PublicFeedCardResponse[]>("/api/feed/public", { signal });
}

/**
 * [내 보고서] 탭 — 로그인 사용자의 카드 피드. GET /api/feed(인증, 최신순).
 * 빈 배열(신규 계정 등)이면 훅이 empty 로 정규화한다.
 */
export function fetchMemberFeed(signal?: AbortSignal): Promise<CardResponse[]> {
  return apiGet<CardResponse[]>("/api/feed", { signal });
}
