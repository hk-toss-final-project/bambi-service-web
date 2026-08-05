/**
 * 관심사 · LLM Wiki 타입 — API DTO 와 화면 모델을 분리한다.
 *
 * 명칭 규약: 데이터 계약은 `tag` / `tagId` 를 쓰고(GET /api/wiki/tags), 화면 문구는 기존대로
 * "관심사"를 유지한다. 컴포넌트·훅 이름(WikiInterests·useWikiInterests)은 UI 섹션 이름이라 그대로 두고,
 * 데이터 필드만 계약 이름으로 맞춘다 — 계약과 다른 `topic` 필드를 새로 정의하지 않는다.
 */

/* ────────────────────────── API DTO (Service API 계약) ────────────────────────── */

/**
 * GET /api/wiki/tags 의 태그 1건.
 * - score: 0~1 (상대 관심 강도).
 * - confidence: 계약에는 있으나 화면에 노출하지 않는다 → 화면 모델로 옮기지 않는다.
 * - category: null 일 수 있다. category 중심 UI 는 만들지 않는다.
 * - evidence: 서버는 Map<String,Object>(JSON 객체)로 중계할 뿐 내부 키를 보장하지 않는다
 *   → 어댑터에서 reasons 만 방어적으로 좁힌다. weight·scored_at 등 나머지 키는 화면에서 쓰지 않는다.
 */
export type WikiTagDto = {
  tag: string;
  tagId: string;
  category: string | null;
  score: number;
  confidence: number;
  documentIds: string[];
  evidence: Record<string, unknown> | null;
};

/**
 * GET /api/wiki/tags 의 data. 최상위 메타(profileId·version·status·calculatedAt)는 화면에서 쓰지 않는다.
 * 활성 Profile 이 없는 사용자는 서버가 { profileId: null, version: 0, status: "empty", tags: [] } 로 정규화한다.
 */
export type WikiTagsData = {
  profileId: string | null;
  version: number;
  status: string | null;
  calculatedAt: string | null;
  tags: WikiTagDto[];
};

/**
 * GET /api/wiki/documents 의 문서 1건.
 * - summary · domain: null 일 수 있다.
 * - documentKind: 응답에 항상 포함되지만 내부용 필드다. 서버가 schema 문서를 이미 제외해 내려주므로
 *   프론트는 UI 판단·노출에 쓰지 않고 화면 모델로도 옮기지 않는다.
 */
export type WikiDocumentDto = {
  documentId: string;
  title: string;
  summary: string | null;
  domain: string | null;
  sourceCount: number;
  updatedAt: string;
  documentKind: string | null;
};

/**
 * GET /api/wiki/documents 의 data.
 * total 은 서버가 schema 제외 후 다시 센 값이지만, 화면은 태그 필터를 거친 개수를 표시하므로 사용하지 않는다.
 */
export type WikiDocumentsData = {
  items: WikiDocumentDto[];
  total: number;
};

/* ────────────────────────── 화면 모델 (View Model) ────────────────────────── */

/**
 * 자동추출 관심 태그 1건 — 화면이 실제로 쓰는 필드만 담는다.
 * - documentIds: Wiki 문서(documentId)와 조인하는 키.
 * - reasonMessages: evidence.reasons 중 노출 허용 코드만 골라 한글 문구로 바꾼 결과(constants/wiki.ts).
 *   부정 신호·미상 코드는 제외되므로 비어 있을 수 있고, 그때는 근거 줄을 렌더하지 않는다.
 * - confidence: 0~1. 목업 정렬(2026-08-05)로 [내 관심사] 카드의 "신뢰도 N%" 표기에 쓴다
 *   (LLM 추론과 일치하는 관심사에만 병기 — 기존 "노출 안 함" 결정을 목업 우선으로 변경).
 */
export type WikiTag = {
  tagId: string;
  tag: string;
  category: string | null;
  score: number;
  confidence: number;
  documentIds: string[];
  reasonMessages: string[];
};

/** Wiki 문서 1건 — 화면 표시용. 빈 문자열은 어댑터에서 null 로 정규화된다. */
export type WikiDocument = {
  documentId: string;
  title: string;
  summary: string | null;
  domain: string | null;
  sourceCount: number;
  updatedAt: string; // ISO-8601 (파싱 실패 시 화면에서 표시를 생략한다)
};
