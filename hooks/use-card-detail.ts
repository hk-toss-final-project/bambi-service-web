"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData } from "@/hooks/use-async-data";
import { fetchCardDetail, type CardDetailResult } from "@/lib/repositories/report";
import type { CardResponse } from "@/types/feed";

/**
 * 실 카드 상세 데이터 훅 — GET /api/cards/{publicId}.
 *
 * - 인증이 확정된 뒤에만(guest·authenticated) 요청한다. 인증 복원 loading/error 중에는
 *   호출하지 않는다(loading 은 상위가 스켈레톤, error 는 상위가 인증 오류 화면을 담당).
 *   게스트도 요청하는 이유: 백엔드가 GET /api/cards/* 를 permitAll 로 열었고(#30),
 *   권한은 "내 카드 or PUBLIC" 이라 게스트는 PUBLIC 카드를 그대로 열람한다.
 * - Bearer 부착 여부(authed)는 로그인 확정 상태에서만 true — 내 PRIVATE 카드 열람에 필요하다.
 *   게스트는 무토큰으로 나가고, 남의 PRIVATE 는 401 이 아니라 404 로 돌아온다(존재 노출 없음).
 * - loading / ready / notFound / error + refetch 로 정규화한다. empty·preparing 은 없다
 *   (단건은 존재(ready)하거나 없거나(notFound), API 에 상태 필드가 없음).
 * - 재조회 트리거는 publicId·authed 변경 + refetch 로 한정한다(401·404 등에서 자동·무한 재요청 없음).
 */
export type CardDetailState =
  | { status: "loading" }
  | { status: "ready"; card: CardResponse }
  | { status: "notFound" }
  | { status: "error" };

export function useCardDetail(publicId: string): CardDetailState & { refetch: () => void } {
  const { status } = useAuth();
  const enabled = status === "guest" || status === "authenticated";
  const authed = status === "authenticated";
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchCardDetail(publicId, authed, signal),
    [publicId, authed],
  );
  const state = useAsyncData<CardDetailResult>(fetcher, enabled);

  if (state.status === "success") {
    return state.data.status === "ready"
      ? { status: "ready", card: state.data.card, refetch: state.refetch }
      : { status: "notFound", refetch: state.refetch };
  }
  if (state.status === "error") return { status: "error", refetch: state.refetch };
  return { status: "loading", refetch: state.refetch }; // idle · loading → 데이터 로딩
}
