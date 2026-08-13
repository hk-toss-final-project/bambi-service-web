"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData, type AsyncErrorState } from "@/hooks/use-async-data";
import { fetchWikiGraph } from "@/lib/repositories/wiki";
import type { WikiGraph } from "@/types/wiki";

/** 로그인 사용자의 전체 LLM Wiki Graph 조회 상태를 제공한다. */
export type WikiGraphState =
  | { status: "loading" }
  | { status: "success"; data: WikiGraph }
  | { status: "empty"; data: WikiGraph }
  | AsyncErrorState;

export function useWikiGraph(): WikiGraphState & { refetch: () => void } {
  const { status } = useAuth();
  const fetcher = useCallback((signal: AbortSignal) => fetchWikiGraph(signal), []);
  const state = useAsyncData<WikiGraph>(fetcher, status === "authenticated");

  if (state.status === "success") {
    return state.data.nodes.length === 0
      ? { status: "empty", data: state.data, refetch: state.refetch }
      : { status: "success", data: state.data, refetch: state.refetch };
  }
  if (state.status === "error") return { status: "error", errorCode: state.errorCode, refetch: state.refetch };
  return { status: "loading", refetch: state.refetch };
}
