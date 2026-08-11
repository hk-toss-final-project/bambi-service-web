"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData } from "@/hooks/use-async-data";
import { toPublicFeedCards } from "@/lib/adapters/card";
import {
  MIXED_FEED_LIMIT,
  buildMixedFeed,
  followedAuthorIdsOf,
  pickRecommendedCandidates,
} from "@/lib/feed-mix";
import { fetchPublicFeed } from "@/lib/repositories/feed";
import type { PublicFeedCardVM } from "@/types/feed";

/**
 * 홈 [피드] 데이터 훅 — **하나의 목록**을 만든다. 사용자가 범위를 고르는 내부 탭·chip 은 없다.
 *
 * 게스트: `GET /api/feed/public?following=false` 하나만 조회해 그대로 보여준다.
 *   팔로잉 API 는 호출하지 않는다.
 *
 * 로그인: 두 요청을 **한 fetcher 안에서** 병렬로 보내고 결과를 섞는다.
 *   - `GET /api/feed/public?following=true`  → 팔로잉 카드(서버 최신순 유지)
 *   - `GET /api/feed/public?following=false` → 전체 공개 카드(추천 후보 원천 — 서버가 뷰어의
 *     좋아요·북마크 이력으로 개인화 순위를 계산해 **이미 정렬한 상태로** 내려준다, service-api #86.
 *     각 카드의 `matchedTopics`/`matchedCategories` 도 함께 내려오지만 매칭 여부 판정에만 쓴다)
 *   팔로잉 2 : 추천 1 로 교차 배치하고 최대 20개(MIXED_FEED_LIMIT). 추천 슬롯은 서버가 내려준
 *   추천 목록을 앞에서부터 순서대로 소비한다 — 필터링(팔로잉·본인 제외) 이후 순서를 프론트가
 *   다시 정하지 않는다(`lib/feed-mix.ts` 의 `pickRecommendedCandidates` 참조).
 *
 * **관심사 API 는 더 이상 조회하지 않는다**(service-api #81, 계약 A안 — 2026-08-11 변경).
 * 추천 후보 판정이 프론트의 이름 문자열 비교에서 서버 계산(`matchedTopics`/`matchedCategories`)으로
 * 바뀌면서, 뷰어의 관심사 목록을 프론트가 따로 들고 있을 이유가 없어졌다(판정은
 * `lib/feed-mix.ts` 의 `isRecommendedCandidate` 참조).
 *
 * **순서는 프론트가 만들지 않는다**(service-api #86 — 2026-08-11 변경). 이전에는 응답을 받은
 * 직후 추천 후보를 shuffle 했지만, 서버가 개인화 순위를 응답 순서에 반영하면서 프론트가 다시
 * 섞으면 그 순위가 사라진다. 지금은 `pickRecommendedCandidates` 가 필터링만 하고 `allPublic`
 * 순서를 그대로 보존한다 — 같은 입력이면 항상 같은 결과가 나온다(결정적).
 *
 * **부분 실패 정책**(Promise.allSettled 로 각 요청을 독립 평가):
 *   - 팔로잉 성공 + 전체 공개 실패 → 팔로잉 카드만 표시
 *   - 전체 공개 성공(추천 계산 가능) + 팔로잉 실패 → 추천 카드만 표시
 *   - 둘 다 실패 → throw 해서 error 상태로(mock 으로 보충하지 않는다)
 *   추천 후보 0건(매칭 topic·category 모두 없는 경우)은 실패가 아니다 — 팔로잉만 남고, 전체 공개
 *   카드로 빈자리를 채우지 않는다(추천 규칙 유지, 가짜 추천 금지).
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

export function usePublicFeed(): PublicFeedState & { refetch: () => void } {
  const { status, user } = useAuth();
  const isMember = status === "authenticated";
  const enabled = status === "guest" || isMember;
  // 본인 카드 추천 제외용. 배포 전 응답에는 publicId 가 없을 수 있어 optional → 없으면 제외를 건너뛴다.
  const viewerPublicId = user?.publicId ?? null;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<PublicFeedCardVM[]> => {
      if (!isMember) {
        // 게스트 — 추천/팔로잉 혼합 없음. 실패는 그대로 error 로 전파된다.
        return toPublicFeedCards(await fetchPublicFeed({ following: false, signal }));
      }

      const [followingRes, allPublicRes] = await Promise.allSettled([
        fetchPublicFeed({ following: true, signal }),
        fetchPublicFeed({ following: false, signal }),
      ]);

      // 취소는 오류가 아니다 — useAsyncData 가 무시할 수 있도록 그대로 던진다.
      for (const res of [followingRes, allPublicRes]) {
        if (res.status === "rejected" && signal.aborted) throw res.reason;
      }

      const followingCards =
        followingRes.status === "fulfilled" ? toPublicFeedCards(followingRes.value) : null;
      const allPublic = allPublicRes.status === "fulfilled" ? toPublicFeedCards(allPublicRes.value) : null;

      let recommendedCards: PublicFeedCardVM[] = [];
      if (allPublic !== null) {
        // 필터링(팔로잉·본인 제외, 매칭 여부)만 하고 allPublic 순서(서버 개인화 순위)를 그대로 쓴다.
        recommendedCards = pickRecommendedCandidates({
          allPublic,
          followingCards: followingCards ?? [],
          followedAuthorIds: followedAuthorIdsOf(followingCards ?? []),
          viewerPublicId,
        });
      }

      if (followingCards === null && allPublic === null) {
        // 두 소스 모두 구성 불가 → 사용자에게 오류를 알린다(mock 보충 없음).
        const reason = followingRes.status === "rejected" ? followingRes.reason : undefined;
        throw reason instanceof Error ? reason : new Error("public feed: all sources failed");
      }

      return buildMixedFeed({
        followingCards: followingCards ?? [],
        recommendedCards,
        limit: MIXED_FEED_LIMIT,
      });
    },
    [isMember, viewerPublicId],
  );

  const state = useAsyncData<PublicFeedCardVM[]>(fetcher, enabled);

  if (state.status === "success") {
    return state.data.length > 0
      ? { status: "success", data: state.data, refetch: state.refetch }
      : { status: "empty", refetch: state.refetch };
  }
  if (state.status === "error") return { status: "error", refetch: state.refetch };
  return { status: "loading", refetch: state.refetch }; // idle · loading → 데이터 로딩
}
