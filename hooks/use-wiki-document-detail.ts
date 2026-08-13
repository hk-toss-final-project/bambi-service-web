"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData, type AsyncErrorState } from "@/hooks/use-async-data";
import {
  fetchWikiDocumentDetail,
  type WikiDocumentDetailResult,
} from "@/lib/repositories/wiki";
import type { WikiDocumentDetail } from "@/types/wiki";

/** 선택한 LLM Wiki Node의 Markdown·출처·관계 상세 조회 상태. */
export type WikiDocumentDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; document: WikiDocumentDetail }
  | { status: "notFound" }
  | AsyncErrorState;

export function useWikiDocumentDetail(
  documentId: string | null,
): WikiDocumentDetailState & { refetch: () => void } {
  const { status } = useAuth();
  const fetcher = useCallback(
    (signal: AbortSignal) =>
      documentId === null
        ? Promise.resolve<WikiDocumentDetailResult>({ status: "notFound" })
        : fetchWikiDocumentDetail(documentId, signal),
    [documentId],
  );
  const state = useAsyncData<WikiDocumentDetailResult>(
    fetcher,
    status === "authenticated" && documentId !== null,
  );

  if (documentId === null || state.status === "idle") return { status: "idle", refetch: state.refetch };
  if (state.status === "success") {
    return state.data.status === "ready"
      ? { status: "ready", document: state.data.document, refetch: state.refetch }
      : { status: "notFound", refetch: state.refetch };
  }
  if (state.status === "error") return { status: "error", errorCode: state.errorCode, refetch: state.refetch };
  return { status: "loading", refetch: state.refetch };
}
