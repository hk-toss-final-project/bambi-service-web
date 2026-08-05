import { toEvidenceReasonMessages } from "@/constants/wiki";
import type {
  WikiDocument,
  WikiDocumentDto,
  WikiTag,
  WikiTagDto,
} from "@/types/wiki";

/**
 * Wiki API DTO → 화면 모델 변환 (lib/adapters/card.ts 와 같은 역할).
 *
 * 백엔드가 준 값만 옮긴다. 없는 값을 만들어내지 않고, category/domain 을 추론하지도 않는다.
 * nullable·미보장 필드는 여기서 한 번에 정규화해 화면에 undefined·null·빈 문자열이 그대로 나가지 않게 한다.
 */

/** 제목이 비어 있을 때만 쓰는 대체 문구 — 빈 카드가 렌더되는 것을 막는다. */
const UNTITLED_DOCUMENT = "제목 없는 자료";

/** 빈 문자열·공백뿐인 값은 "없음"(null)으로 정규화한다. */
function toNullableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** 숫자가 아니거나 NaN·Infinity 면 fallback 으로 대체한다. */
function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** 문자열 배열만 남긴다(빈 문자열 제외). 배열이 아니면 빈 배열. */
function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

/**
 * evidence 는 서버가 내부 키를 보장하지 않는 JSON 객체다.
 * 화면이 쓰는 근거 코드 목록(`reasons`)만 방어적으로 좁혀 꺼낸 뒤, 노출 허용 목록에 있는 코드만
 * 문구로 바꾼다(부정 신호·미상 코드는 제외 — constants/wiki.ts).
 * evidence 형태가 다르거나 남는 근거가 없으면 빈 배열이 되고, 카드는 근거 줄을 렌더하지 않는다.
 * 원본 evidence 는 변형하지 않는다 — 여기서 파생 표시값만 만든다.
 */
function toReasonMessages(evidence: unknown): string[] {
  if (typeof evidence !== "object" || evidence === null) return [];
  return toEvidenceReasonMessages(toStringList((evidence as { reasons?: unknown }).reasons));
}

/**
 * 태그 DTO → 화면 모델.
 * tagId(선택 상태·key) 나 tag(표시할 이름) 가 비어 있으면 카드로 만들 수 없으므로 그 항목만 조용히 제외한다.
 */
export function toWikiTags(items: WikiTagDto[]): WikiTag[] {
  const tags: WikiTag[] = [];
  for (const item of items) {
    const tagId = toNullableText(item?.tagId);
    const tag = toNullableText(item?.tag);
    if (tagId === null || tag === null) continue;

    tags.push({
      tagId,
      tag,
      category: toNullableText(item.category),
      score: toFiniteNumber(item.score, 0),
      confidence: toFiniteNumber(item.confidence, 0),
      documentIds: toStringList(item.documentIds),
      reasonMessages: toReasonMessages(item.evidence),
    });
  }
  return tags;
}

/**
 * 문서 DTO → 화면 모델.
 * documentId 가 없으면 태그의 documentIds 와 조인할 수 없으므로 그 항목만 조용히 제외한다.
 * documentKind 는 내부 필드라 옮기지 않는다(UI 판단·노출에 쓰지 않는다).
 */
export function toWikiDocuments(items: WikiDocumentDto[]): WikiDocument[] {
  const documents: WikiDocument[] = [];
  for (const item of items) {
    const documentId = toNullableText(item?.documentId);
    if (documentId === null) continue;

    documents.push({
      documentId,
      title: toNullableText(item.title) ?? UNTITLED_DOCUMENT,
      summary: toNullableText(item.summary),
      domain: toNullableText(item.domain),
      sourceCount: Math.max(0, Math.trunc(toFiniteNumber(item.sourceCount, 0))),
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
    });
  }
  return documents;
}
