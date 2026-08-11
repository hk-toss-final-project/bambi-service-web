import type { PublicFeedCardVM } from "@/types/feed";

/**
 * 홈 [피드] 단일 혼합 피드 계산 — **렌더 컴포넌트 밖의 순수 함수 모음**이다.
 *
 * 로그인 사용자의 [피드]는 탭·chip 없이 하나의 목록이고, 그 안에
 *   ① 내가 팔로우한 작성자의 PUBLIC 카드(팔로잉)
 *   ② 서버가 뷰어 기준으로 관심 topic/category 매칭을 표시한, 팔로우하지 않은 다른 작성자의
 *      PUBLIC 카드(추천 — matchedTopics/matchedCategories, service-api #81)
 * 를 팔로잉 2 : 추천 1 비율로 섞는다.
 *
 * 여기 있는 함수는 전부 입력만 보고 결과를 내는 순수 함수다(무작위는 주입받는다) →
 * 단위 테스트가 가능하고, 렌더마다 결과가 흔들리지 않는다.
 */

/** 혼합 결과 최대 개수. 서버 limit(기본 20)과 같은 상한을 최종 목록에도 적용한다. */
export const MIXED_FEED_LIMIT = 20;

/** 팔로잉 2 : 추천 1 — 한 사이클에서 팔로잉을 2개 쓰고 추천을 1개 쓴다. */
const FOLLOWING_PER_CYCLE = 2;
const RECOMMENDED_PER_CYCLE = 1;

/**
 * 추천 후보 판정 — 서버가 뷰어 기준으로 이미 계산해 내려준 매칭 결과만 본다(service-api #81,
 * 계약 A안). **topic 이 하나라도 있으면 추천 후보.** topic 매칭이 없을 때만 category(넓은 매칭,
 * recall 안전망)를 본다. 이름 문자열 비교·프론트 자체 매칭 계산은 하지 않는다.
 * 둘 다 비어 있으면(게스트·비매칭·롤아웃 전 카드·필드 미배포) 후보가 아니다(가짜 추천 금지).
 */
export function isRecommendedCandidate(card: PublicFeedCardVM): boolean {
  if (card.matchedTopics.length > 0) return true;
  return card.matchedCategories.length > 0;
}

/** 1순위 후보 — matchedTopics 매칭이 있는 카드. 추천 슬롯을 채울 때 이 풀을 먼저 쓴다. */
function isPrimaryCandidate(card: PublicFeedCardVM): boolean {
  return card.matchedTopics.length > 0;
}

/** 2순위 후보 — matchedTopics 는 없고 matchedCategories(넓은 매칭)만 있는 카드. 1순위 풀이 부족할 때만 보강한다. */
function isSecondaryCandidate(card: PublicFeedCardVM): boolean {
  return card.matchedTopics.length === 0 && card.matchedCategories.length > 0;
}

/**
 * 추천 후보 선별 — "서버가 매칭했다고 표시한, 내가 팔로우하지 않은 남의 공개 카드"를
 * **1순위(topic 매칭)**와 **2순위(topic 매칭 없이 category 매칭만)** 풀로 나눠 돌려준다.
 * `interleaveFeed` 가 `recommendedCards` 를 앞에서부터 순서대로 소비하므로, 호출부가 1순위 뒤에
 * 2순위를 이어붙이기만 하면 "1순위를 먼저 채우고 부족할 때만 2순위로 보강"이 자연히 성립한다.
 *
 * 두 풀 공통 제외 기준:
 * - 매칭 topic·category 모두 없는 카드(`isPrimaryCandidate`·`isSecondaryCandidate` 모두 false)
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
}): { primary: PublicFeedCardVM[]; secondary: PublicFeedCardVM[] } {
  const followingIds = new Set(followingCards.map((card) => card.publicId));
  const primary: PublicFeedCardVM[] = [];
  const secondary: PublicFeedCardVM[] = [];
  for (const card of allPublic) {
    if (followingIds.has(card.publicId)) continue; // 같은 카드는 팔로잉으로 분류
    const authorId = card.author.publicId;
    if (authorId !== null && followedAuthorIds.has(authorId)) continue; // 팔로우한 작성자
    if (authorId !== null && viewerPublicId !== null && authorId === viewerPublicId) continue; // 본인 카드
    if (isPrimaryCandidate(card)) primary.push(card);
    else if (isSecondaryCandidate(card)) secondary.push(card);
  }
  return { primary, secondary };
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
 * Fisher-Yates shuffle — 입력을 바꾸지 않고 새 배열을 돌려준다.
 * `random` 을 주입받아 테스트에서 결정적으로 검증할 수 있다(기본값은 Math.random).
 *
 * **호출 위치가 중요하다**: API 응답을 받은 시점에 한 번만 부른다. 렌더 중에 부르면 리렌더마다
 * 순서가 바뀐다.
 */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 팔로잉 2 : 추천 1 로 교차 배치 — `[F, F, R, F, F, R, …]`.
 *
 * - 한쪽이 먼저 소진되면 남은 자리는 다른 쪽으로 채운다(팔로잉이 부족하면 추천으로, 추천이
 *   부족하면 팔로잉으로).
 * - `publicId` 기준 중복 제거. 팔로잉을 먼저 넣으므로 양쪽에 있는 카드는 팔로잉으로 남는다.
 * - 결과는 `limit` 개까지.
 *
 * 입력 순서는 그대로 존중한다 — 팔로잉은 서버 최신순, 추천은 호출부가 미리 섞어 넘긴 순서다.
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
 * `recommendedCards` 는 이미 섞인 상태로 받는다(섞는 시점을 훅이 통제해 렌더 중 재섞임을 막는다).
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
