import type { PublicFeedCardVM } from "@/types/feed";

/**
 * 홈 [피드] 단일 혼합 피드 계산 — **렌더 컴포넌트 밖의 순수 함수 모음**이다.
 *
 * 로그인 사용자의 [피드]는 탭·chip 없이 하나의 목록이고, 그 안에
 *   ① 내가 팔로우한 작성자의 PUBLIC 카드(팔로잉)
 *   ② 내 관심사와 태그가 맞는, 팔로우하지 않은 다른 작성자의 PUBLIC 카드(추천)
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
 * 태그·관심사 비교 키 — 양쪽 trim 후 대소문자 차이를 무시한다.
 * `toLowerCase()` 는 로케일 규칙을 타지 않아 태그 비교에 안전하다(한글은 영향 없음).
 * 빈 문자열은 키로 쓰지 않는다(호출부가 걸러낸다).
 */
export function toTagKey(value: string): string {
  return value.trim().toLowerCase();
}

/** 문자열 배열 → 비교 키 Set. 비문자열·공백뿐인 항목은 버린다. */
export function toTagKeySet(values: readonly unknown[] | null | undefined): Set<string> {
  const keys = new Set<string>();
  if (!Array.isArray(values)) return keys;
  for (const value of values) {
    if (typeof value !== "string") continue;
    const key = toTagKey(value);
    if (key !== "") keys.add(key);
  }
  return keys;
}

/** 카드 태그 중 하나라도 관심사 키에 걸리면 true. 관심사가 비면 항상 false(가짜 추천 금지). */
export function matchesInterests(
  card: PublicFeedCardVM,
  interestKeys: ReadonlySet<string>,
): boolean {
  if (interestKeys.size === 0) return false;
  for (const tag of card.tags) {
    if (interestKeys.has(toTagKey(tag))) return true;
  }
  return false;
}

/**
 * 추천 후보 선별 — "내 관심사와 태그가 맞는, 내가 팔로우하지 않은 남의 공개 카드".
 *
 * 제외 기준:
 * - 태그가 내 USER 관심사와 하나도 안 맞는 카드 (관심사 0건이면 후보도 0건 — 전체 공개 카드로
 *   빈자리를 채우지 않는다. 관심사 기반 추천이라는 제품 규칙을 지키고 가짜 추천을 만들지 않는다.)
 * - 이미 팔로우한 작성자의 카드 (그건 팔로잉 몫이다)
 * - 로그인한 본인이 쓴 카드
 * - 이미 팔로잉 목록에 있는 카드(publicId 중복) → 팔로잉 우선 분류
 *
 * 작성자 publicId 가 없는 카드는 **제외하지 않는다** — 팔로우·본인 판정만 불가능할 뿐 관심사가
 * 맞으면 정상 추천 후보다(화면의 중립 작성자 표시 규칙은 그대로 유지된다).
 */
export function pickRecommendedCandidates({
  allPublic,
  followingCards,
  interestNames,
  followedAuthorIds,
  viewerPublicId,
}: {
  allPublic: readonly PublicFeedCardVM[];
  followingCards: readonly PublicFeedCardVM[];
  interestNames: readonly string[];
  /** 팔로우 중인 작성자 publicId 집합. 보통 followingCards 에서 파생한다. */
  followedAuthorIds: ReadonlySet<string>;
  /** 로그인한 본인 publicId. 알 수 없으면 null(본인 카드 제외를 건너뛴다). */
  viewerPublicId: string | null;
}): PublicFeedCardVM[] {
  const interestKeys = toTagKeySet(interestNames);
  if (interestKeys.size === 0) return [];

  const followingIds = new Set(followingCards.map((card) => card.publicId));
  const result: PublicFeedCardVM[] = [];
  for (const card of allPublic) {
    if (followingIds.has(card.publicId)) continue; // 같은 카드는 팔로잉으로 분류
    const authorId = card.author.publicId;
    if (authorId !== null && followedAuthorIds.has(authorId)) continue; // 팔로우한 작성자
    if (authorId !== null && viewerPublicId !== null && authorId === viewerPublicId) continue; // 본인 카드
    if (!matchesInterests(card, interestKeys)) continue;
    result.push(card);
  }
  return result;
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
