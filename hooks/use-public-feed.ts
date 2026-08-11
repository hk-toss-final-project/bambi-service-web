"use client";

import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData } from "@/hooks/use-async-data";
import { toPublicFeedCards } from "@/lib/adapters/card";
import {
  MIXED_FEED_LIMIT,
  buildMixedFeed,
  followedAuthorIdsOf,
  pickDiscoveryCandidates,
  prioritizeUnseenCandidates,
} from "@/lib/feed-mix";
import { fetchPublicFeed } from "@/lib/repositories/feed";
import type { PublicFeedCardVM } from "@/types/feed";

/**
 * 홈 [피드] 데이터 훅 — **하나의 목록**을 만든다. 사용자가 범위를 고르는 내부 탭·chip 은 없다.
 *
 * 게스트: `GET /api/feed/public?following=false&limit=50` 하나만 조회한다.
 *   팔로잉 API 는 호출하지 않는다.
 *
 * 로그인: 두 요청을 **한 fetcher 안에서** 병렬로 보내고 결과를 섞는다.
 *   - `GET /api/feed/public?following=true&limit=50`  → 팔로잉 카드
 *   - `GET /api/feed/public?following=false&limit=50` → 최신 공개 카드 후보 + 뷰어 기준 매칭 필드
 *   후보를 topic 일치 → category 일치 → 최신 탐색 fallback 순으로 정리한 뒤,
 *   팔로잉 2 : 탐색 1로 교차 배치하고 최대 20개(MIXED_FEED_LIMIT)만 보여준다.
 *
 * **관심사 API 는 더 이상 조회하지 않는다**(service-api #81, 계약 A안 — 2026-08-11 변경).
 * 추천 후보 판정이 프론트의 이름 문자열 비교에서 서버 계산(`matchedTopics`/`matchedCategories`)으로
 * 바뀌면서, 뷰어의 관심사 목록을 프론트가 따로 들고 있을 이유가 없어졌다(순서 계산은
 * `lib/feed-mix.ts` 의 `pickDiscoveryCandidates` 참조).
 *
 * 보여준 카드 ID는 탭의 sessionStorage에 기억한다. 새로고침·“다른 추천 보기” 시
 * 아직 보지 않은 카드를 먼저 배치하고, 후보를 모두 봤을 때만 기존 카드로 돌아간다.
 *
 * **부분 실패 정책**(Promise.allSettled 로 각 요청을 독립 평가):
 *   - 팔로잉 성공 + 전체 공개 실패 → 팔로잉 카드만 표시
 *   - 전체 공개 성공 + 팔로잉 실패 → 관심사·탐색 카드만 표시
 *   - 둘 다 실패 → throw 해서 error 상태로(mock 으로 보충하지 않는다)
 *   매칭 0건은 실패가 아니다. 이때는 본인·팔로잉을 제외한 최신 공개 카드로 빈자리를 채운다.
 *
 * 인증이 확정된 뒤에만 요청한다 → 인증 loading 과 데이터 loading 을 분리한다(인증 loading 은
 * 상위 HomeSkeleton 담당). 응답의 `liked` 가 조회자 기준이라 토큰 복원 전에 요청하면 로그인
 * 사용자에게 liked=false 를 보여주게 되는 것도 같은 이유로 막는다.
 *
 * DTO → 화면 모델 변환은 어댑터(toPublicFeedCards)가 fetch 경계에서 한 번만 한다. 렌더 불가한
 * 항목은 어댑터가 제외하고, 응답이 배열조차 아니면 throw 된다 → Empty 와 Error 가 섞이지 않는다.
 * AbortError 는 useAsyncData 가 오류로 취급하지 않는다(StrictMode cleanup 그대로 유지).
 */
export type PublicFeedState =
  | { status: "loading" }
  | { status: "success"; data: PublicFeedCardVM[] }
  | { status: "empty" }
  | { status: "error" };

const CANDIDATE_LIMIT = 50;
const SEEN_STORAGE_PREFIX = "alphacatcher:public-feed-seen:v1";
const MAX_STORED_SEEN_IDS = 200;

function seenStorageKey(isMember: boolean, viewerPublicId: string | null): string {
  return `${SEEN_STORAGE_PREFIX}:${isMember ? viewerPublicId ?? "member" : "guest"}`;
}

function readSeenIds(key: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
}

function rememberSeenIds(key: string, publicIds: readonly string[]): void {
  try {
    const merged = new Set([...readSeenIds(key), ...publicIds]);
    const recent = [...merged].slice(-MAX_STORED_SEEN_IDS);
    window.sessionStorage.setItem(key, JSON.stringify(recent));
  } catch {
    // 저장소 비활성·용량 제한은 피드 조회 실패 사유가 아니다. 현재 응답만 그대로 보여준다.
  }
}

function readRotation(key: string): number {
  try {
    const value = Number(window.sessionStorage.getItem(`${key}:rotation`) ?? "0");
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function advanceRotation(key: string): void {
  try {
    window.sessionStorage.setItem(`${key}:rotation`, String(readRotation(key) + 1));
  } catch {
    // 회차 저장 실패도 피드 조회 실패로 취급하지 않는다.
  }
}

export function usePublicFeed(): PublicFeedState & { refetch: () => void } {
  const { status, user } = useAuth();
  const isMember = status === "authenticated";
  const enabled = status === "guest" || isMember;
  // 본인 카드 추천 제외용. 배포 전 응답에는 publicId 가 없을 수 있어 optional → 없으면 제외를 건너뛴다.
  const viewerPublicId = user?.publicId ?? null;
  const storageKey = seenStorageKey(isMember, viewerPublicId);
  const rememberedResultRef = useRef<PublicFeedCardVM[] | null>(null);

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PublicFeedCardVM[]> => {
      if (!isMember) {
        // 게스트도 50개 후보에서 이미 본 카드를 뒤로 보내고 20개만 보여준다.
        const allPublic = toPublicFeedCards(
          await fetchPublicFeed({ following: false, limit: CANDIDATE_LIMIT, signal }),
        );
        return prioritizeUnseenCandidates(
          allPublic,
          readSeenIds(storageKey),
          readRotation(storageKey),
        ).slice(0, MIXED_FEED_LIMIT);
      }

      const [followingRes, allPublicRes] = await Promise.allSettled([
        fetchPublicFeed({ following: true, limit: CANDIDATE_LIMIT, signal }),
        fetchPublicFeed({ following: false, limit: CANDIDATE_LIMIT, signal }),
      ]);

      // 취소는 오류가 아니다 — useAsyncData 가 무시할 수 있도록 그대로 던진다.
      for (const res of [followingRes, allPublicRes]) {
        if (res.status === "rejected" && signal.aborted) throw res.reason;
      }

      const followingCards =
        followingRes.status === "fulfilled" ? toPublicFeedCards(followingRes.value) : null;
      const allPublic = allPublicRes.status === "fulfilled" ? toPublicFeedCards(allPublicRes.value) : null;

      const seenIds = readSeenIds(storageKey);
      const rotation = readRotation(storageKey);
      let discoveryCards: PublicFeedCardVM[] = [];
      if (allPublic !== null) {
        discoveryCards = prioritizeUnseenCandidates(
          pickDiscoveryCandidates({
            allPublic,
            followingCards: followingCards ?? [],
            followedAuthorIds: followedAuthorIdsOf(followingCards ?? []),
            viewerPublicId,
          }),
          seenIds,
          rotation,
        );
      }

      if (followingCards === null && allPublic === null) {
        // 두 소스 모두 구성 불가 → 사용자에게 오류를 알린다(mock 보충 없음).
        const reason = followingRes.status === "rejected" ? followingRes.reason : undefined;
        throw reason instanceof Error ? reason : new Error("public feed: all sources failed");
      }

      return buildMixedFeed({
        followingCards: prioritizeUnseenCandidates(followingCards ?? [], seenIds, rotation),
        recommendedCards: discoveryCards,
        limit: MIXED_FEED_LIMIT,
      });
    },
    [isMember, storageKey, viewerPublicId],
  );

  const state = useAsyncData<PublicFeedCardVM[]>(fetcher, enabled);
  const committedCards = state.status === "success" ? state.data : null;

  // Abort·StrictMode 재실행이 후보를 먼저 소비하지 않게, 화면에 확정된 결과만 본 카드로 기록한다.
  useEffect(() => {
    if (committedCards === null || committedCards.length === 0) return;
    if (rememberedResultRef.current === committedCards) return;
    rememberedResultRef.current = committedCards;
    rememberSeenIds(storageKey, committedCards.map((card) => card.publicId));
    advanceRotation(storageKey);
  }, [committedCards, storageKey]);

  if (state.status === "success") {
    return state.data.length > 0
      ? { status: "success", data: state.data, refetch: state.refetch }
      : { status: "empty", refetch: state.refetch };
  }
  if (state.status === "error") return { status: "error", refetch: state.refetch };
  return { status: "loading", refetch: state.refetch }; // idle · loading → 데이터 로딩
}
