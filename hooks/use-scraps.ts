"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData } from "@/hooks/use-async-data";
import { fetchScraps } from "@/lib/repositories/scraps";
import type { ScrapCard } from "@/types/scrap";

/**
 * 내 스크랩 목록 훅 — member 전용. repository seam(fetchScraps)만 소비한다.
 * authenticated 에서만 요청하고 loading / success / empty / error + refetch 로 정규화.
 * 0건(아직 안 담았거나 전부 비공개 전환됨)은 정상 empty 다.
 */
export type ScrapsState =
  | { status: "loading" }
  | { status: "success"; data: ScrapCard[] }
  | { status: "empty" }
  | { status: "error" };

export function useScraps(): ScrapsState & { refetch: () => void } {
  const { status } = useAuth();
  const enabled = status === "authenticated";
  const fetcher = useCallback((signal: AbortSignal) => fetchScraps(signal), []);
  const state = useAsyncData<ScrapCard[]>(fetcher, enabled);

  if (state.status === "success") {
    return state.data.length > 0
      ? { status: "success", data: state.data, refetch: state.refetch }
      : { status: "empty", refetch: state.refetch };
  }
  if (state.status === "error") return { status: "error", refetch: state.refetch };
  return { status: "loading", refetch: state.refetch };
}
