"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData } from "@/hooks/use-async-data";
import { fetchUserInterests } from "@/lib/repositories/interests";
import type { InterestDto } from "@/types/interest";

/**
 * [내 관심사] 데이터 훅 — member 전용. GET /api/interests(source=USER)를 소비한다.
 * 온보딩(use-onboarding-interests)과 달리 화면 상주 목록이라 단순 조회+refetch 만 제공한다.
 * 빈 배열은 오류가 아니라 정상(신규 사용자·전부 삭제) — 화면이 Empty 안내를 렌더한다.
 * 추가/삭제는 컴포넌트가 repository(createInterest·deleteInterest)를 직접 호출한 뒤 refetch 한다
 * (서버 확정본만 신뢰 — 낙관적 목록 조작을 하지 않는다).
 */
export type MyInterestsState =
  | { status: "loading" }
  | { status: "success"; data: InterestDto[] }
  | { status: "error" };

export function useMyInterests(): MyInterestsState & { refetch: () => void } {
  const { status } = useAuth();
  const enabled = status === "authenticated";
  const fetcher = useCallback((signal: AbortSignal) => fetchUserInterests(signal), []);
  // 추가·삭제 후 재조회에서 목록이 스켈레톤으로 깜빡이지 않게 이전 데이터를 유지한다(우석 08-11).
  const state = useAsyncData<InterestDto[]>(fetcher, enabled, true);

  if (state.status === "success") return { status: "success", data: state.data, refetch: state.refetch };
  if (state.status === "error") return { status: "error", refetch: state.refetch };
  return { status: "loading", refetch: state.refetch }; // idle · loading → 데이터 로딩
}
