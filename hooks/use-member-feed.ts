"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData, type AsyncErrorState } from "@/hooks/use-async-data";
import { toFeedCardVM } from "@/lib/adapters/card";
import { fetchMemberFeed } from "@/lib/repositories/feed";
import type { FeedCardVM } from "@/types/feed";

/**
 * [내 보고서] 탭(member) 데이터 훅 — GET /api/feed(인증).
 *
 * - authenticated 에서만 요청한다. guest 는 /api/feed 를 호출하지 않고, 인증 loading/error
 *   중에도 요청하지 않는다(usePublicFeed 와 동일한 상태-분리 원칙 — enabled 조건만 다르다).
 * - CardResponse[] → FeedCardVM[] 로 변환한다(어댑터). loading / success / empty / error + refetch 정규화.
 * - refetch 는 상위(HomeView)가 소유해 저장 성공 시 재조회에 재사용한다(§4).
 *
 * 이 목록은 **읽기 전용**이다. 공개 범위는 카드 상세(공유 모달)에서만 바뀌므로 목록이 들고 있는
 * 로컬 mutation override 는 두지 않는다 — 홈으로 돌아오면 이 훅이 서버에서 다시 받은 값이
 * [내 보고서] 카드 배지와 우측 rail 집계의 유일한 원천이다(두 곳이 같은 상태를 공유하므로
 * rail 때문에 `GET /api/feed` 를 다시 부르지 않는다).
 */
export type MemberFeedState =
  | { status: "loading" }
  | { status: "success"; data: FeedCardVM[] }
  | { status: "empty" }
  | AsyncErrorState;

export type MemberFeedApi = MemberFeedState & {
  refetch: () => void;
};

export function useMemberFeed(): MemberFeedApi {
  const { status } = useAuth();
  const enabled = status === "authenticated";
  const fetcher = useCallback(async (signal: AbortSignal): Promise<FeedCardVM[]> => {
    const cards = await fetchMemberFeed(signal);
    return cards.map(toFeedCardVM);
  }, []);
  const state = useAsyncData<FeedCardVM[]>(fetcher, enabled);

  const common = { refetch: state.refetch };

  if (state.status === "error") return { status: "error", errorCode: state.errorCode, ...common };
  if (state.status !== "success") return { status: "loading", ...common }; // idle · loading → 데이터 로딩
  if (state.data.length === 0) return { status: "empty", ...common };
  return { status: "success", data: state.data, ...common };
}
