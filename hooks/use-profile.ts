"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData } from "@/hooks/use-async-data";
import { fetchAuthorCards, fetchProfile } from "@/lib/repositories/profile";
import type { AuthorCard, Profile } from "@/types/profile";

/**
 * 공개 프로필 데이터 훅 — 게스트도 열람 가능(백엔드 permitAll).
 * 인증 확인이 끝난 뒤(loading 이 아닐 때) 요청한다 — 로그인 상태면 Bearer 를 붙여
 * following/liked 가 채워지고, 게스트면 무토큰으로 호출한다.
 * loading / success / error + refetch 로 정규화(프로필은 empty 개념 없음 — 없는 사용자는 error(404)).
 */
export type ProfileState =
  | { status: "loading" }
  | { status: "success"; data: Profile }
  | { status: "error" }; // 없는 사용자(404)도 error — 화면이 "찾을 수 없음" 카피로 안내

export function useProfile(publicId: string): ProfileState & { refetch: () => void } {
  const { status } = useAuth();
  // 공개 데이터라 인증 복원 오류(error)여도 게스트처럼 무토큰으로 열람한다.
  const enabled = status !== "loading";
  const authed = status === "authenticated";
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchProfile(publicId, authed, signal),
    [publicId, authed],
  );
  const state = useAsyncData<Profile>(fetcher, enabled);

  if (state.status === "success") return { status: "success", data: state.data, refetch: state.refetch };
  if (state.status === "error") return { status: "error", refetch: state.refetch };
  return { status: "loading", refetch: state.refetch };
}

/**
 * 작성자 공개 카드(브리핑 리스트) 훅 — 프로필과 동일한 게스트 허용 정책.
 * 0건은 정상(empty) — "아직 공개한 브리핑이 없어요".
 */
export type AuthorCardsState =
  | { status: "loading" }
  | { status: "success"; data: AuthorCard[] }
  | { status: "empty" }
  | { status: "error" };

export function useAuthorCards(publicId: string): AuthorCardsState & { refetch: () => void } {
  const { status } = useAuth();
  const enabled = status !== "loading";
  const authed = status === "authenticated";
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchAuthorCards(publicId, authed, signal),
    [publicId, authed],
  );
  const state = useAsyncData<AuthorCard[]>(fetcher, enabled);

  if (state.status === "success") {
    return state.data.length > 0
      ? { status: "success", data: state.data, refetch: state.refetch }
      : { status: "empty", refetch: state.refetch };
  }
  if (state.status === "error") return { status: "error", refetch: state.refetch };
  return { status: "loading", refetch: state.refetch };
}
