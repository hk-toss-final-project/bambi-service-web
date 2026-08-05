"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData } from "@/hooks/use-async-data";
import { toPublicFeedCards } from "@/lib/adapters/card";
import { fetchPublicFeed } from "@/lib/repositories/feed";
import type { PublicFeedCardVM } from "@/types/feed";

/**
 * [피드] 탭 데이터 훅 — 공개 피드(GET /api/feed/public). 범위 하나만 조회한다.
 *
 * - `"recommended"`(기본) = `following=false`. 게스트·로그인 모두 허용.
 *   서버 쿼리는 "PUBLIC 카드 전체 최신순"이며 **개인화 랭킹이 아니다**(추천 점수·사유 없음).
 * - `"following"` = `following=true`. **로그인 필수** — 게스트는 서버가 AUTH_INVALID_TOKEN 을
 *   던지므로 `enabled` 로 아예 요청하지 않는다(확실한 401 을 미리 막는다).
 *
 * 인증이 확정된 뒤에만 요청한다 → 인증 loading 과 데이터 loading 을 분리한다(인증 loading 은
 * 상위 HomeSkeleton 담당). 추천에서도 인증 확정을 기다리는 이유는 응답의 `liked` 가 조회자
 * 기준이라, 토큰 복원 전에 요청하면 로그인 사용자에게 liked=false 응답을 보여주게 되기 때문이다.
 *
 * **범위 전환 시 이전 범위 데이터가 잠깐 보이지 않는다.** fetcher 를 `following` 에 묶어 두면
 * 범위가 바뀌는 순간 fetcher identity 가 바뀌고, useAsyncData 는 settled 결과의 태그가 현재
 * (fetcher, reload)와 다르면 곧바로 loading 을 돌려준다 — 기존 규칙을 그대로 쓴 것이고
 * use-async-data.ts 를 고치거나 StrictMode 를 끄지 않는다.
 *
 * 동시에 두 범위를 요청하지 않는다: 호출부가 활성 범위 하나로만 이 훅을 쓴다.
 *
 * DTO → 화면 모델 변환은 어댑터(toPublicFeedCards)가 fetch 경계에서 한 번만 한다.
 * 렌더 불가한 항목은 어댑터가 제외하고, 응답이 배열조차 아니면 throw 해 error 로 떨어진다
 * → Empty 와 Error 가 섞이지 않는다. AbortError 는 useAsyncData 가 오류로 취급하지 않는다.
 */
export type PublicFeedScope = "recommended" | "following";

export type PublicFeedState =
  | { status: "loading" }
  | { status: "success"; data: PublicFeedCardVM[] }
  | { status: "empty" }
  | { status: "error" };

export function usePublicFeed(
  scope: PublicFeedScope = "recommended",
): PublicFeedState & { refetch: () => void } {
  const { status } = useAuth();
  const following = scope === "following";
  // 팔로잉은 로그인 확정에서만, 추천은 인증 확정(게스트 포함) 후에 요청한다.
  const enabled = following
    ? status === "authenticated"
    : status === "guest" || status === "authenticated";

  const fetcher = useCallback(
    (signal: AbortSignal) => fetchPublicFeed({ following, signal }).then(toPublicFeedCards),
    [following],
  );
  const state = useAsyncData<PublicFeedCardVM[]>(fetcher, enabled);

  if (state.status === "success") {
    return state.data.length > 0
      ? { status: "success", data: state.data, refetch: state.refetch }
      : { status: "empty", refetch: state.refetch };
  }
  if (state.status === "error") return { status: "error", refetch: state.refetch };
  return { status: "loading", refetch: state.refetch }; // idle · loading → 데이터 로딩
}
