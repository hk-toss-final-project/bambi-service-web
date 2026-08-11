import type { PublicFeedCardVM } from "@/types/feed";

/**
 * 홈 [피드] 단일 혼합 피드 계산 — **렌더 컴포넌트 밖의 순수 함수 모음**이다.
 *
 * 로그인 사용자의 [피드]는 탭·chip 없이 하나의 목록이고, 그 안에
 *   ① 내가 팔로우한 작성자의 PUBLIC 카드(팔로잉)
 *   ② 팔로우하지 않은 다른 작성자의 PUBLIC 카드(관심 topic → category → 최신 탐색 순)
 * 를 팔로잉 2 : 추천 1 비율로 섞는다.
 *
 * 서버는 최신순 후보와 뷰어 기준 matchedTopics/matchedCategories를 내려준다. 프론트는
 * topic 일치 → category 일치 → 일치 없는 최신 공개 카드 순으로 후보를 넓혀 피드가 비지 않게 한다.
 * 각 단계 안에서는 서버 최신순을 유지하고, 이미 본 카드는 후보 뒤로 보낸다. 여기 함수는 모두
 * 입력만 보고 결과를 내는 순수 함수라 단위 테스트가 가능하다.
 */

/** 화면에 한 번에 보여줄 혼합 결과 최대 개수. 조회 후보 풀(50)과는 별개다. */
export const MIXED_FEED_LIMIT = 20;

/** 팔로잉 2 : 추천 1 — 한 사이클에서 팔로잉을 2개 쓰고 추천을 1개 쓴다. */
const FOLLOWING_PER_CYCLE = 2;
const RECOMMENDED_PER_CYCLE = 1;

/**
 * 추천 후보 판정 — 서버가 뷰어 기준으로 이미 계산해 내려준 매칭 결과만 본다(service-api #81).
 * **topic 이 하나라도 있으면 추천 후보.** topic 매칭이 없을 때만 category(넓은 매칭, recall
 * 안전망)를 본다. 이름 문자열 비교·프론트 자체 매칭 계산은 하지 않는다.
 * 둘 다 비어 있으면(게스트·비매칭·롤아웃 전 카드·필드 미배포) 후보가 아니다(가짜 추천 금지).
 *
 * **순서 결정에는 쓰지 않는다** — matchedTopics/matchedCategories는 "후보인가"만 판정하고,
 * topic 매칭 카드를 category 매칭 카드보다 앞세우는 등의 재정렬에는 쓰지 않는다(service-api #86
 * 이후 순위는 서버가 좋아요·북마크 이력으로 계산해 응답 순서 자체에 이미 반영했다).
 */
export function isRecommendedCandidate(card: PublicFeedCardVM): boolean {
  if (card.matchedTopics.length > 0) return true;
  return card.matchedCategories.length > 0;
}

/**
 * 추천 후보 선별 — "서버가 매칭했다고 표시한, 내가 팔로우하지 않은 남의 공개 카드"를
 * **서버가 응답한 순서 그대로** 돌려준다. 필터링(팔로잉·본인 제외, 매칭 여부)만 하고 별도
 * 우선순위로 다시 정렬하지 않는다 — `allPublic`의 상대적 순서가 곧 결과의 상대적 순서다.
 *
 * 제외 기준:
 * - 매칭 topic·category 모두 없는 카드(`isRecommendedCandidate` false)
 * - 이미 팔로우한 작성자의 카드 (그건 팔로잉 몫이다)
 * - 로그인한 본인이 쓴 카드
 * - 이미 팔로잉 목록에 있는 카드(publicId 중복) → 팔로잉 우선 분류
 *
 * 작성자 publicId 가 없는 카드는 **제외하지 않는다** — 팔로우·본인 판정만 불가능할 뿐 매칭이
 * 맞으면 정상 추천 후보다(화면의 중립 작성자 표시 규칙은 그대로 유지된다).
 */
export function pickRecommendedCandidates({
  allPublic,
  followingCards,
  followedAuthorIds,
  viewerPublicId,
}: {
  allPublic: readonly PublicFeedCardVM[];
  followingCards: readonly PublicFeedCardVM[];
  /** 팔로우 중인 작성자 publicId 집합. 보통 followingCards 에서 파생한다. */
  followedAuthorIds: ReadonlySet<string>;
  /** 로그인한 본인 publicId. 알 수 없으면 null(본인 카드 제외를 건너뛴다). */
  viewerPublicId: string | null;
}): PublicFeedCardVM[] {
  const followingIds = new Set(followingCards.map((card) => card.publicId));
  const candidates: PublicFeedCardVM[] = [];
  for (const card of allPublic) {
    if (followingIds.has(card.publicId)) continue; // 같은 카드는 팔로잉으로 분류
    const authorId = card.author.publicId;
    if (authorId !== null && followedAuthorIds.has(authorId)) continue; // 팔로우한 작성자
    if (authorId !== null && viewerPublicId !== null && authorId === viewerPublicId) continue; // 본인 카드
    if (isRecommendedCandidate(card)) candidates.push(card);
  }
  return candidates;
}

/**
 * 피드 탐색 후보 — 팔로잉·본인·중복은 제외하되, 매칭 카드가 부족하면
 * 일치하지 않는 최신 공개 카드까지 후보를 넓힌다. 단계는 다음 순서다.
 *
 * 1. topic 정확 매칭
 * 2. category 매칭(recall 안전망)
 * 3. 매칭은 없지만 새로운 작성자를 발견할 수 있는 최신 공개 카드
 *
 * 각 단계 안에서는 allPublic(서버 최신순) 상대 순서를 유지한다. 3단계를
 * “관심사 추천”으로 표시하지 않고, 목록을 비우지 않는 탐색 fallback으로만 쓴다.
 */
export function pickDiscoveryCandidates({
  allPublic,
  followingCards,
  followedAuthorIds,
  viewerPublicId,
}: {
  allPublic: readonly PublicFeedCardVM[];
  followingCards: readonly PublicFeedCardVM[];
  followedAuthorIds: ReadonlySet<string>;
  viewerPublicId: string | null;
}): PublicFeedCardVM[] {
  const followingIds = new Set(followingCards.map((card) => card.publicId));
  const used = new Set<string>();
  const topicMatched: PublicFeedCardVM[] = [];
  const categoryMatched: PublicFeedCardVM[] = [];
  const recentFallback: PublicFeedCardVM[] = [];

  for (const card of allPublic) {
    if (used.has(card.publicId) || followingIds.has(card.publicId)) continue;
    const authorId = card.author.publicId;
    if (authorId !== null && followedAuthorIds.has(authorId)) continue;
    if (authorId !== null && viewerPublicId !== null && authorId === viewerPublicId) continue;

    used.add(card.publicId);
    if (card.matchedTopics.length > 0) {
      topicMatched.push(card);
    } else if (card.matchedCategories.length > 0) {
      categoryMatched.push(card);
    } else {
      recentFallback.push(card);
    }
  }

  return [...topicMatched, ...categoryMatched, ...recentFallback];
}

/** 아직 보지 않은 카드를 먼저 보이고, 이미 본 카드는 원래 순서를 유지한 채 뒤로 보낸다. */
export function prioritizeUnseenCandidates(
  cards: readonly PublicFeedCardVM[],
  seenIds: ReadonlySet<string>,
  rotation = 0,
): PublicFeedCardVM[] {
  if (seenIds.size === 0) return [...cards];
  const unseen: PublicFeedCardVM[] = [];
  const seen: PublicFeedCardVM[] = [];
  for (const card of cards) {
    (seenIds.has(card.publicId) ? seen : unseen).push(card);
  }
  // 아직 보지 않은 카드가 있으면 그 목록은 최신/매칭 우선 순서를 그대로 유지한다.
  // 후보를 모두 본 뒤에는 공약수 7 간격으로 시작점을 옮겨, 후보가 적어도 매 새로고침에
  // 동일한 첫 카드만 반복되지 않게 한다. 랜덤이 아니라 같은 회차에는 같은 결과가 나온다.
  if (unseen.length > 0) return [...unseen, ...rotateByRound(seen, rotation)];
  return rotateByRound(cards, rotation);
}

function rotateByRound(cards: readonly PublicFeedCardVM[], rotation: number): PublicFeedCardVM[] {
  if (cards.length <= 1) return [...cards];
  const safeRound = Number.isFinite(rotation) ? Math.max(0, Math.trunc(rotation)) : 0;
  const offset = (safeRound * 7) % cards.length;
  if (offset === 0) return [...cards];
  return [...cards.slice(offset), ...cards.slice(0, offset)];
}

/** 팔로잉 카드에서 팔로우 중인 작성자 publicId 집합을 만든다(팔로잉 목록 = 팔로우한 작성자의 카드). */
export function followedAuthorIdsOf(
  followingCards: readonly PublicFeedCardVM[],
): Set<string> {
  const ids = new Set<string>();
  for (const card of followingCards) {
    if (card.author.publicId !== null) ids.add(card.author.publicId);
  }
  return ids;
}

/**
 * 팔로잉 2 : 추천 1 로 교차 배치 — `[F, F, R, F, F, R, …]`.
 *
 * - 한쪽이 먼저 소진되면 남은 자리는 다른 쪽으로 채운다(팔로잉이 부족하면 추천으로, 추천이
 *   부족하면 팔로잉으로).
 * - `publicId` 기준 중복 제거. 팔로잉을 먼저 넣으므로 양쪽에 있는 카드는 팔로잉으로 남는다.
 * - 결과는 `limit` 개까지.
 *
 * 입력 순서를 그대로 존중한다. 팔로잉은 최신/미열람 우선 순서, 탐색 후보는
 * topic → category → 최신 fallback 순서로 이미 정리되어 들어온다. 이 함수는 교차 배치만 한다.
 */
export function interleaveFeed({
  followingCards,
  recommendedCards,
  limit = MIXED_FEED_LIMIT,
}: {
  followingCards: readonly PublicFeedCardVM[];
  recommendedCards: readonly PublicFeedCardVM[];
  limit?: number;
}): PublicFeedCardVM[] {
  const out: PublicFeedCardVM[] = [];
  const used = new Set<string>();
  let f = 0;
  let r = 0;

  const push = (card: PublicFeedCardVM): boolean => {
    if (used.has(card.publicId)) return false;
    used.add(card.publicId);
    out.push(card);
    return true;
  };

  while (out.length < limit && (f < followingCards.length || r < recommendedCards.length)) {
    const before = out.length;

    for (let i = 0; i < FOLLOWING_PER_CYCLE && out.length < limit; i += 1) {
      while (f < followingCards.length && !push(followingCards[f++])) {
        /* 중복은 건너뛰고 다음 팔로잉 카드로 */
      }
    }
    for (let i = 0; i < RECOMMENDED_PER_CYCLE && out.length < limit; i += 1) {
      while (r < recommendedCards.length && !push(recommendedCards[r++])) {
        /* 중복(팔로잉과 겹침 등)은 건너뛴다 */
      }
    }

    // 한 사이클에서 아무것도 못 넣었으면 양쪽 모두 소진·중복뿐이므로 무한 루프를 끊는다.
    if (out.length === before) break;
  }

  return out;
}

/**
 * 최종 혼합 — 호출부(훅)가 응답을 받은 직후 한 번 부른다.
 *
 * `recommendedCards` 는 서버 응답 순서 그대로 받는다(프론트는 섞거나 재정렬하지 않는다).
 * 팔로잉만 있거나 추천만 있는 경우도 그대로 처리된다 — 한쪽이 빈 배열이면 다른 쪽으로 전부 채운다.
 */
export function buildMixedFeed({
  followingCards,
  recommendedCards,
  limit = MIXED_FEED_LIMIT,
}: {
  followingCards: readonly PublicFeedCardVM[];
  recommendedCards: readonly PublicFeedCardVM[];
  limit?: number;
}): PublicFeedCardVM[] {
  return interleaveFeed({ followingCards, recommendedCards, limit });
}
