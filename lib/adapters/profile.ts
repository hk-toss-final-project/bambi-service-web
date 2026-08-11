import {
  toCardSources,
  toCardTags,
  toPublicFeedAuthor,
  toPublicFeedSocial,
  toScrapped,
} from "@/lib/adapters/card";
import { normalizeText } from "@/lib/normalize";
import { isUuid } from "@/lib/utils";
import type {
  AuthorCardResponse,
  AuthorCardVM,
  FollowUserResponse,
  FollowUserVM,
} from "@/types/profile";

/**
 * 프로필 화면 전용 어댑터 — GET /api/users/{publicId}/cards 응답을 화면 모델로 좁히고,
 * 우측 rail 이 쓰는 집계(주로 다루는 주제)를 순수 함수로 계산한다.
 *
 * 정규화 규칙은 **공개 피드와 같은 함수**를 그대로 쓴다(lib/adapters/card.ts 의 toCardSources ·
 * toCardTags · toScrapped · toPublicFeedAuthor · toPublicFeedSocial). 같은 서버 DTO
 * (`PublicCardResponse`)를 두 화면이 나눠 쓰는데 "값이 없음"의 판정이 화면마다 다르면 곤란하다.
 * 프로필에만 필요한 계산(집계·라벨)은 여기 두고, lib/adapters/card.ts 에는 넣지 않는다.
 */

/** 카드 메타용 전체 시각 — 공개 피드 카드와 같은 형식. */
const CARD_AT_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** rail 요약용 날짜만 — 300px 패널 한 줄에 들어가야 한다(시·분은 카드 메타가 이미 보여준다). */
const CARD_DATE_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatWith(format: Intl.DateTimeFormat, iso: unknown): string {
  if (typeof iso !== "string") return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return ""; // 파싱 실패 시 표시 생략(Invalid Date·현재 시각 fallback 금지)
  return format.format(new Date(ts));
}

/**
 * 카드 1건 변환 — 렌더 불가한 항목은 **null** 을 돌려 호출부가 건너뛰게 한다.
 * 기준은 공개 피드(toPublicFeedCardVM)와 같다:
 * - `publicId` 가 UUID 가 아니면 상세 경로(/report/{publicId})를 만들 수 없다(React key 도 없다).
 * - `title` 이 비어 있으면 카드의 유일한 필수 표시값이 없다("제목 없음" 같은 문구를 만들지 않는다).
 * 나머지는 값이 없으면 그 줄만 생략하고 카드는 살린다.
 */
export function toAuthorCardVM(card: AuthorCardResponse | null | undefined): AuthorCardVM | null {
  if (card === null || typeof card !== "object") return null;

  const publicId = normalizeText(card.publicId);
  if (publicId === null || !isUuid(publicId)) return null;

  const title = normalizeText(card.title);
  if (title === null) return null;

  return {
    publicId,
    title,
    summary: normalizeText(card.summary) ?? "",
    author: toPublicFeedAuthor(card.author),
    // 좋아요와 보관은 **서로 독립적으로** 검증한다 — 한쪽이 깨져도 다른 쪽 액션은 살린다.
    social: toPublicFeedSocial(card),
    scrapped: toScrapped(card.scrapped),
    sources: toCardSources(card.sources),
    tags: toCardTags(card.tags),
    createdAtLabel: formatWith(CARD_AT_FORMAT, card.createdAt),
    createdAtDateLabel: formatWith(CARD_DATE_FORMAT, card.createdAt),
  };
}

/**
 * 카드 배열 변환 — 렌더 불가 항목만 제외하고 나머지는 **서버 순서(createdAt desc) 그대로** 남긴다.
 * 배열 자체가 아니면(계약 위반) 빈 배열이 아니라 throw 한다 → 훅이 error 로 정규화해
 * "아직 공개한 브리핑이 없어요"(Empty)와 "불러오지 못했어요"(Error)가 섞이지 않는다.
 */
export function toAuthorCards(
  cards: readonly (AuthorCardResponse | null | undefined)[] | null | undefined,
): AuthorCardVM[] {
  if (!Array.isArray(cards)) {
    throw new TypeError("author cards: expected an array of cards");
  }
  const result: AuthorCardVM[] = [];
  for (const card of cards) {
    const vm = toAuthorCardVM(card);
    if (vm !== null) result.push(vm);
  }
  return result;
}

/**
 * 「주로 다루는 주제」 — 조회된 공개 카드의 `tags` 를 많이 나온 순으로 추린다.
 *
 * **이 값은 사용자의 관심사가 아니다.** `/api/interests` 는 본인 것만 주고 타인 프로필에서는
 * 조회할 수 없어, 여기서 세는 것은 "최근 공개 브리핑이 다룬 주제"뿐이다. 화면 문구도 그렇게 쓴다.
 *
 * 표본은 **조회된 카드(서버 limit 상한 50)** 이지 전체 공개 카드가 아니다 — 호출부가 이 사실을
 * 화면에 밝힌다. 개수(count)는 정렬에만 쓰고 화면에 숫자로 내보내지 않는다: 전체 통계가 아닌 값을
 * 통계처럼 보이게 만들지 않는다.
 *
 * 비교 기준은 trim + 소문자이고, **표기는 처음 나온 원문 그대로** 남긴다(대소문자를 임의로
 * 바꾸지 않는다).
 * 동점이면 먼저 나온(= 더 최근 카드의) 태그가 앞선다 — 정렬 결과가 매번 흔들리지 않게 한다.
 */
export function toProfileTopics(cards: readonly AuthorCardVM[], limit: number): string[] {
  if (limit <= 0) return [];
  const counts = new Map<string, { label: string; count: number; firstAt: number }>();
  let order = 0;
  for (const card of cards) {
    for (const tag of card.tags) {
      const key = tag.toLowerCase();
      const seen = counts.get(key);
      if (seen === undefined) {
        counts.set(key, { label: tag, count: 1, firstAt: order++ });
      } else {
        seen.count += 1;
      }
    }
  }
  return [...counts.values()]
    .sort((a, b) => (b.count === a.count ? a.firstAt - b.firstAt : b.count - a.count))
    .slice(0, limit)
    .map((entry) => entry.label);
}

/**
 * 「최근 공개」 — 서버가 최신순(createdAt desc)으로 내려주므로 **첫 카드**의 날짜다.
 * 목록을 다시 정렬하거나 최댓값을 재계산하지 않는다(서버 순서를 그대로 신뢰한다).
 * 첫 카드의 시각을 파싱하지 못했으면 null → 화면이 그 줄을 그리지 않는다.
 */
export function toRecentPublishedLabel(cards: readonly AuthorCardVM[]): string | null {
  const label = cards[0]?.createdAtDateLabel ?? "";
  return label === "" ? null : label;
}

/**
 * 팔로워/팔로잉 목록 1건 변환 — 렌더 불가한 항목은 null 을 돌려 호출부가 건너뛴다.
 *
 * `publicId` 가 UUID 가 아니면 제외한다: 행 클릭이 `/users/{publicId}` 로 가는데 죽은 링크를
 * 만들 수 없고, React key 로 쓸 대체 식별자도 없다(카드 목록과 같은 기준).
 *
 * 이름은 서버가 준 것만 담는다 — 둘 다 없으면(탈퇴 직전 계정 등) "익명"·"사용자1" 같은 이름을
 * 지어내지 않고 null 로 둔다. 이니셜도 실제 이름에서만 뽑는다(`toPublicFeedAuthor` 와 같은 규율).
 *
 * `following` 은 boolean 일 때만 통과시킨다. 아니면 null = "알 수 없음" 이고, 화면이 그 행의
 * 팔로우 버튼을 렌더하지 않는다(`toScrapped` 와 같은 이유 — 모르는 상태를 토글하면 멀쩡한 관계를
 * 뒤집는다).
 */
export function toFollowUserVM(user: FollowUserResponse | null | undefined): FollowUserVM | null {
  if (user === null || typeof user !== "object") return null;

  const publicId = normalizeText(user.publicId);
  if (publicId === null || !isUuid(publicId)) return null;

  const displayName = normalizeText(user.displayName);
  const username = normalizeText(user.username);
  const primaryName = displayName ?? username;

  return {
    publicId,
    displayName,
    username,
    initial: primaryName === null ? null : Array.from(primaryName)[0],
    following: typeof user.following === "boolean" ? user.following : null,
  };
}

/**
 * 목록 배열 변환 — 렌더 불가 항목만 빼고 **서버 순서(username 오름차순) 그대로** 남긴다.
 * 배열이 아니면(계약 위반) throw → 훅이 error 로 정규화해 "아직 팔로워가 없어요"(Empty)와
 * "불러오지 못했어요"(Error)가 섞이지 않는다.
 */
export function toFollowUsers(
  users: readonly (FollowUserResponse | null | undefined)[] | null | undefined,
): FollowUserVM[] {
  if (!Array.isArray(users)) {
    throw new TypeError("follow list: expected an array of users");
  }
  const result: FollowUserVM[] = [];
  for (const user of users) {
    const vm = toFollowUserVM(user);
    if (vm !== null) result.push(vm);
  }
  return result;
}
