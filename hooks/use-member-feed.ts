"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData } from "@/hooks/use-async-data";
import { toFeedCardVM } from "@/lib/adapters/card";
import { fetchMemberFeed } from "@/lib/repositories/feed";
import type { FeedCardVM } from "@/types/feed";

/**
 * [피드] 탭(member) 데이터 훅 — GET /api/feed(인증).
 *
 * - authenticated 에서만 요청한다. guest 는 /api/feed 를 호출하지 않고, 인증 loading/error
 *   중에도 요청하지 않는다(usePublicFeed 와 동일한 상태-분리 원칙 — enabled 조건만 다르다).
 * - CardResponse[] → FeedCardVM[] 로 변환한다(어댑터). loading / success / empty / error + refetch 정규화.
 * - refetch 는 상위(HomeView)가 소유해 저장 성공 시 재조회에 재사용한다(§4).
 */
export type MemberFeedState =
  | { status: "loading" }
  | { status: "success"; data: FeedCardVM[] }
  | { status: "empty" }
  | { status: "error" };

export function useMemberFeed(): MemberFeedState & { refetch: () => void } {
  const { status } = useAuth();
  const enabled = status === "authenticated";
  const fetcher = useCallback(async (signal: AbortSignal): Promise<FeedCardVM[]> => {
    const cards = await fetchMemberFeed(signal);
    return cards.map(toFeedCardVM);
  }, []);
  const state = useAsyncData<FeedCardVM[]>(fetcher, enabled);

  if (state.status === "success") {
    return state.data.length > 0
      ? { status: "success", data: state.data, refetch: state.refetch }
      : { status: "empty", refetch: state.refetch };
  }
  if (state.status === "error") return { status: "error", refetch: state.refetch };
  return { status: "loading", refetch: state.refetch }; // idle · loading → 데이터 로딩
}
