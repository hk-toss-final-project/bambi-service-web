"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData } from "@/hooks/use-async-data";
import { toPublicFeedCards } from "@/lib/adapters/card";
import { fetchPublicFeed } from "@/lib/repositories/feed";
import type { PublicFeedCardVM } from "@/types/feed";

/**
 * [피드] 탭 데이터 훅 — 공개 피드(GET /api/feed/public). member·guest 가 같은 엔드포인트를 쓴다.
 *
 * - 인증이 확정된 뒤에만(guest·authenticated) 요청한다. 인증 loading/error 중에는 요청하지 않는다
 *   → 인증 loading 과 데이터 loading 을 분리한다(인증 loading 은 상위 HomeSkeleton 담당).
 *   비로그인도 허용되는 엔드포인트인데 인증 확정을 기다리는 이유는 응답의 `liked` 가 조회자
 *   기준이라, 토큰 복원 전에 요청하면 로그인 사용자에게 liked=false 응답을 보여주게 되기 때문이다.
 *   (새로고침 시 enabled 가 false→true 로 바뀌며 확정 후 1회 요청된다. 로그인·가입은 화면 이동으로
 *   remount 되어 다시 요청된다. 같은 화면에 머문 채 토큰만 만료되는 경우에는 이미 받은 `liked`
 *   표시가 갱신되지 않을 수 있다 — 이동·재시도 시 정확해진다.)
 * - DTO → 화면 모델 변환은 어댑터(toPublicFeedCards)가 fetch 경계에서 한 번만 한다.
 *   렌더 불가한 항목은 어댑터가 제외하고, 응답이 배열조차 아니면 throw 해 error 로 떨어진다
 *   → Empty("공개 브리핑이 없어요")와 Error("불러오지 못했어요")가 섞이지 않는다.
 * - loading / success / empty / error 로 정규화하고 refetch 를 제공한다.
 *   AbortError 는 useAsyncData 가 오류로 취급하지 않는다(언마운트·재조회 정리).
 */
export type RecFeedState =
  | { status: "loading" }
  | { status: "success"; data: PublicFeedCardVM[] }
  | { status: "empty" }
  | { status: "error" };

export function useRecFeed(): RecFeedState & { refetch: () => void } {
  const { status } = useAuth();
  const enabled = status === "guest" || status === "authenticated";
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchPublicFeed(signal).then(toPublicFeedCards),
    [],
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
