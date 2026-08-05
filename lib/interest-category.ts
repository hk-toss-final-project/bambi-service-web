/**
 * 관심사·AI 추론 태그를 taxonomy 대분류(카테고리)로 묶는 규칙.
 *
 * 배경: 관심사 데이터는 세 갈래로 들어오는데 카테고리 정보의 신뢰도가 서로 다르다.
 *   ① 온보딩에서 taxonomy 로 고른 관심사 — `InterestDto.categoryId` 가 정확히 채워져 있다.
 *   ② 직접 입력한 관심사 — taxonomy 필드가 전부 null 이다(자유 문자열).
 *   ③ agent 가 추론한 태그(GET /api/wiki/tags) — `category` 는 agent 가 붙인 자유 문자열이라
 *      taxonomy 의 categoryId 와 무관하다. 신뢰할 수 없으므로 분류 근거로 쓰지 않는다.
 *
 * 그래서 ①만 ID 를 그대로 쓰고, ②③은 **이름을 taxonomy 의 topic name·keywords 와 대조**해 추정한다.
 * 어디에도 걸리지 않으면 버리지 않고 "기타"로 모은다 — 화면에서 사라지는 관심사가 없어야 한다.
 */

import type {
  InterestDto,
  InterestTaxonomyCategory,
  InterestTaxonomyDto,
} from "@/types/interest";
import type { WikiTag } from "@/types/wiki";

/** taxonomy 어디에도 매칭되지 않은 관심사를 모으는 가상 카테고리. taxonomy 의 실제 id 와 겹치지 않는다. */
export const ETC_CATEGORY_ID = "__etc__";

export type CategoryItem = {
  /** React key 겸 선택 상태 식별자. AI 태그는 tagId, 내 관심사는 `interest-{id}`. */
  key: string;
  name: string;
  /** 상대 관심 강도(0~1). 내 관심사만 있고 AI 추론이 없으면 null — 강도 막대를 그리지 않는다. */
  score: number | null;
  /** 사용자가 직접 등록했는지(USER) agent 추론인지(INFERRED). 둘 다면 USER 로 본다. */
  source: "USER" | "INFERRED";
  /**
   * `DELETE /api/interests/{id}` 대상 id. USER 관심사에만 있다.
   * AI 추론 태그(INFERRED)는 agent 소유라 지울 API 가 없으므로 null 이고, 화면도 삭제 버튼을 숨긴다.
   */
  interestId: number | null;
};

export type CategoryGroup = {
  id: string;
  name: string;
  emoji: string;
  items: CategoryItem[];
};

/** 대조용 정규화 — 대소문자·공백·구분점(·, ㆍ, -, /)을 지운다. "AI·머신러닝" 과 "ai 머신러닝" 을 같게 본다. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s·ㆍ\-/_,]/g, "");
}

/**
 * 이름 → taxonomy 카테고리 id 추정.
 *
 * 정확도 순으로 시도하고 먼저 걸리는 것을 쓴다: topic 이름 완전일치 → keyword 완전일치 → 부분 포함.
 * 부분 포함은 오분류가 나기 쉬워 **2글자 이하 후보는 제외**한다("AI" 같은 짧은 키워드가 아무 데나
 * 걸리는 것을 막는다 — 대신 완전일치 단계에서 이미 잡힌다).
 */
function resolveCategoryId(name: string, taxonomy: InterestTaxonomyDto): string | null {
  const target = normalize(name);
  if (!target) return null;

  for (const category of taxonomy.categories) {
    for (const topic of category.topics) {
      if (normalize(topic.name) === target) return category.id;
    }
  }
  for (const category of taxonomy.categories) {
    for (const topic of category.topics) {
      if (topic.keywords.some((keyword) => normalize(keyword) === target)) return category.id;
    }
  }
  for (const category of taxonomy.categories) {
    for (const topic of category.topics) {
      const candidates = [topic.name, ...topic.keywords]
        .map(normalize)
        .filter((candidate) => candidate.length > 2);
      if (candidates.some((candidate) => target.includes(candidate) || candidate.includes(target))) {
        return category.id;
      }
    }
  }
  return null;
}

/**
 * AI 추론 태그와 내 관심사를 하나의 목록으로 합친다.
 * 이름이 같으면 한 줄로 합치고 source 는 USER 를 남긴다 — 직접 등록한 관심사가 AI 추정보다 우선이라는
 * 화면 문구와 같은 규칙이다. score 는 AI 추론값이 있으면 유지한다(강도 막대를 잃지 않게).
 */
function mergeItems(tags: WikiTag[], interests: InterestDto[]): Map<string, CategoryItem & { explicitCategoryId: string | null }> {
  const merged = new Map<string, CategoryItem & { explicitCategoryId: string | null }>();

  for (const tag of tags) {
    merged.set(normalize(tag.tag), {
      key: tag.tagId,
      name: tag.tag,
      score: tag.score,
      source: "INFERRED",
      interestId: null,
      explicitCategoryId: null,
    });
  }
  for (const interest of interests) {
    const id = normalize(interest.name);
    const existing = merged.get(id);
    merged.set(id, {
      key: existing?.key ?? `interest-${interest.id}`,
      name: interest.name,
      score: existing?.score ?? null,
      source: "USER",
      interestId: interest.id,
      explicitCategoryId: interest.categoryId,
    });
  }
  return merged;
}

/**
 * taxonomy 대분류 전체를 골격으로 반환한다. 관심사가 없는 카테고리도 **빈 채로 포함**한다 —
 * 사용자가 "이 서비스가 다루는 범위"를 한눈에 보게 하는 것이 이 화면의 목적이기 때문이다.
 * 정렬은 taxonomy 의 order 를 따르고, "기타"는 내용이 있을 때만 맨 뒤에 붙인다.
 *
 * 각 카테고리 안의 항목은 강도 내림차순(강도 없는 항목은 뒤)으로 정렬한다.
 */
export function groupInterestsByCategory(
  taxonomy: InterestTaxonomyDto,
  tags: WikiTag[],
  interests: InterestDto[],
): CategoryGroup[] {
  const merged = mergeItems(tags, interests);
  const buckets = new Map<string, CategoryItem[]>();

  for (const item of merged.values()) {
    const categoryId =
      item.explicitCategoryId ?? resolveCategoryId(item.name, taxonomy) ?? ETC_CATEGORY_ID;
    const bucket = buckets.get(categoryId);
    const entry: CategoryItem = {
      key: item.key,
      name: item.name,
      score: item.score,
      source: item.source,
      interestId: item.interestId,
    };
    if (bucket) bucket.push(entry);
    else buckets.set(categoryId, [entry]);
  }

  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }

  const ordered = [...taxonomy.categories]
    .sort((a, b) => a.order - b.order)
    .map((category: InterestTaxonomyCategory) => ({
      id: category.id,
      name: category.name,
      emoji: category.emoji,
      items: buckets.get(category.id) ?? [],
    }));

  const etc = buckets.get(ETC_CATEGORY_ID);
  if (etc && etc.length > 0) {
    ordered.push({ id: ETC_CATEGORY_ID, name: "기타", emoji: "🧩", items: etc });
  }
  return ordered;
}
