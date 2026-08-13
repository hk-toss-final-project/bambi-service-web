"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData, type AsyncErrorState } from "@/hooks/use-async-data";
import { fetchInterestTaxonomy } from "@/lib/repositories/interest-taxonomy";
import { fetchUserInterests } from "@/lib/repositories/interests";
import type { InterestDto, InterestTaxonomyDto } from "@/types/interest";

/**
 * 온보딩 관심사 조회 훅 — member 전용. repository seam(fetchUserInterests)만 소비한다.
 *
 * - authenticated 에서만 요청한다(guest 직접 진입 시 개인정보 요청 없음 — 화면 가드가 담당).
 * - loading / ready / error + refetch 로 정규화한다.
 * - **빈 배열은 empty 상태가 아니라 ready 다** — 신규 사용자는 "선택 0개에서 시작"이 정상이고,
 *   조회 실패(error)와는 명확히 구분된다(조회 실패를 선택 0개로 위장하지 않는다).
 * - 재진입 사용자의 기존 USER 관심사는 ready 데이터로 내려가 화면이 미리 선택한다.
 */
export type OnboardingInterestsState =
  | { status: "loading" }
  | { status: "ready"; data: OnboardingInterestData }
  | AsyncErrorState;

export type OnboardingInterestData = {
  interests: InterestDto[];
  taxonomy: InterestTaxonomyDto;
};

export function useOnboardingInterests(): OnboardingInterestsState & { refetch: () => void } {
  const { status } = useAuth();
  const enabled = status === "authenticated";
  const fetcher = useCallback(async (signal: AbortSignal) => {
    const [interests, taxonomy] = await Promise.all([
      fetchUserInterests(signal),
      fetchInterestTaxonomy(signal),
    ]);
    return { interests, taxonomy };
  }, []);
  const state = useAsyncData<OnboardingInterestData>(fetcher, enabled);

  if (state.status === "success") return { status: "ready", data: state.data, refetch: state.refetch };
  if (state.status === "error") return { status: "error", errorCode: state.errorCode, refetch: state.refetch };
  return { status: "loading", refetch: state.refetch }; // idle · loading → 데이터 로딩
}
