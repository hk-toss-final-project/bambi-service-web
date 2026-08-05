/**
 * 관심사 API 타입 — bambi-service-api `interest/` 실측 코드 기준 (확인일 2026-07-30).
 *
 * - `InterestResponse.java` 1:1: taxonomy 선택이면 버전·Category·Topic 안정 ID를 함께 반환한다.
 * - source 는 DB CHECK 제약과 동일한 2종뿐(`InterestSource.java`):
 *   USER = 사용자가 직접 설정 · INFERRED = agent 추론(P1, `/api/interests` 로는 생성되지 않음).
 * - name 은 자유 문자열 1~100자(`InterestRequest` @NotBlank @Size(max=100), V1 스키마 length=100).
 * - 직접 추가한 관심사는 taxonomy 필드가 모두 null이다.
 */
export type InterestSource = "USER" | "INFERRED";

export type InterestDto = {
  id: number;
  name: string;
  source: InterestSource;
  taxonomyVersion: string | null;
  categoryId: string | null;
  topicId: string | null;
  createdAt: string;
};

export type InterestTaxonomyTopic = {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  order: number;
  keywords: string[];
};

export type InterestTaxonomyCategory = {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  emoji: string;
  order: number;
  topics: InterestTaxonomyTopic[];
};

export type InterestTaxonomyDto = {
  version: string;
  sourceHash: string;
  locale: string;
  publishedAt: string;
  categories: InterestTaxonomyCategory[];
};

export type InterestSelection = {
  name: string;
  taxonomyVersion?: string;
  topicId?: string;
};
