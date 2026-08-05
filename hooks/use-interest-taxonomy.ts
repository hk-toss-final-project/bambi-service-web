"use client";

import { useCallback } from "react";

import { useAsyncData } from "@/hooks/use-async-data";
import { fetchInterestTaxonomy } from "@/lib/repositories/interest-taxonomy";
import type { InterestTaxonomyDto } from "@/types/interest";

/**
 * 관심사 taxonomy(대분류·토픽) 조회 훅.
 * 온보딩과 [AI가 이해한 지금의 나]가 같은 분류 체계를 쓰도록 repository seam 을 공유한다.
 * 인증이 필요 없는 공개 데이터라 항상 조회한다(guest 화면에서는 애초에 호출되지 않는다).
 */
export type InterestTaxonomyState =
  | { status: "loading" }
  | { status: "success"; data: InterestTaxonomyDto }
  | { status: "error" };

export function useInterestTaxonomy(): InterestTaxonomyState & { refetch: () => void } {
  const fetcher = useCallback((signal: AbortSignal) => fetchInterestTaxonomy(signal), []);
  const state = useAsyncData<InterestTaxonomyDto>(fetcher, true);

  if (state.status === "success") {
    return { status: "success", data: state.data, refetch: state.refetch };
  }
  if (state.status === "error") return { status: "error", refetch: state.refetch };
  return { status: "loading", refetch: state.refetch };
}
