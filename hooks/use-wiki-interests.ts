"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData } from "@/hooks/use-async-data";
import { fetchWikiTags } from "@/lib/repositories/wiki";
import type { WikiTag } from "@/types/wiki";

/**
 * [AI가 이해한 관심사] 데이터 훅 — member 전용.
 * 데이터 계약은 자동추출 관심 태그(GET /api/wiki/tags)이고, 화면 문구만 "관심사"를 유지한다.
 * repository seam(fetchWikiTags)만 소비한다.
 * authenticated 에서만 요청하고, loading / success / empty / error + refetch 로 정규화한다.
 * tags 가 0건인 정상 응답은 오류가 아니라 empty 다.
 * {@code requested=false}이면 개발용 홈 패널이 숨겨진 배포에서 불필요한 조회를 하지 않는다.
 */
export type WikiInterestsState =
  | { status: "loading" }
  | { status: "success"; data: WikiTag[] }
  | { status: "empty" }
  | { status: "error" };

export function useWikiInterests(requested = true): WikiInterestsState & { refetch: () => void } {
  const { status } = useAuth();
  const enabled = requested && status === "authenticated";
  const fetcher = useCallback((signal: AbortSignal) => fetchWikiTags(signal), []);
  // 관심사 추가·삭제 후 재조회에서 발견 목록이 깜빡이지 않게 이전 데이터를 유지한다(우석 08-11).
  const state = useAsyncData<WikiTag[]>(fetcher, enabled, true);

  if (state.status === "success") {
    return state.data.length > 0
      ? { status: "success", data: state.data, refetch: state.refetch }
      : { status: "empty", refetch: state.refetch };
  }
  if (state.status === "error") return { status: "error", refetch: state.refetch };
  return { status: "loading", refetch: state.refetch }; // idle · loading → 데이터 로딩
}
