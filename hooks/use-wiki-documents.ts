"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData, type AsyncErrorState } from "@/hooks/use-async-data";
import { fetchWikiDocuments } from "@/lib/repositories/wiki";
import type { WikiDocument } from "@/types/wiki";

/**
 * [내가 저장한 자료](LLM Wiki 문서) 데이터 훅 — member 전용.
 * repository seam(fetchWikiDocuments)만 소비한다. 전체 문서를 받고, 선택된 태그로 좁히는 필터는
 * 화면 계층(lib/wiki.ts filterWikiDocuments)에서 처리한다.
 * items 가 0건인 정상 응답은 오류가 아니라 empty 다.
 */
export type WikiDocumentsState =
  | { status: "loading" }
  | { status: "success"; data: WikiDocument[] }
  | { status: "empty" }
  | AsyncErrorState;

export function useWikiDocuments(): WikiDocumentsState & { refetch: () => void } {
  const { status } = useAuth();
  const enabled = status === "authenticated";
  const fetcher = useCallback((signal: AbortSignal) => fetchWikiDocuments(signal), []);
  const state = useAsyncData<WikiDocument[]>(fetcher, enabled);

  if (state.status === "success") {
    return state.data.length > 0
      ? { status: "success", data: state.data, refetch: state.refetch }
      : { status: "empty", refetch: state.refetch };
  }
  if (state.status === "error") return { status: "error", errorCode: state.errorCode, refetch: state.refetch };
  return { status: "loading", refetch: state.refetch }; // idle · loading → 데이터 로딩
}
