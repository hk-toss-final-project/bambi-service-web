import { FALLBACK_ERROR_CODE } from "@/constants/errors";
import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/api-client";
import {
  toWikiDocumentDetail,
  toWikiDocuments,
  toWikiGraph,
  toWikiTags,
} from "@/lib/adapters/wiki";
import type {
  WikiDocument,
  WikiDocumentDetail,
  WikiDocumentDetailData,
  WikiDocumentsData,
  WikiBuildStatusData,
  WikiGraph,
  WikiGraphData,
  WikiTag,
  WikiTagsData,
  WikiResetData,
} from "@/types/wiki";

/**
 * 관심사 · LLM Wiki 데이터 repository — 화면 훅과 Service API 사이의 단일 seam.
 *
 * - 모든 엔드포인트는 인증이 필요하다. Bearer 헤더 부착·envelope 해석·401 처리는 공통 api-client 가 한다(§3·§5·§8).
 * - 훅이 authenticated 에서만 호출하므로 여기서 인증 상태를 다시 판단하지 않는다.
 * - 정상 빈 목록(tags·items 0건)은 오류가 아니다 → 그대로 빈 배열을 반환하고 훅이 empty 로 정규화한다.
 *   필수 컨테이너 자체가 빠진 응답만 오류로 승격한다.
 * - 전체 Graph와 문서 상세도 Service API만 호출한다. 브라우저에서 Agent API를 직접 호출하지 않는다.
 */

/** 필수 컨테이너 누락(success:true 인데 data 가 없음 등) — 정상 빈 목록과 구분해 오류로 올린다. */
function requireContainer<T>(data: T | null | undefined, path: string): T {
  if (data === null || data === undefined) {
    throw new ApiError(FALLBACK_ERROR_CODE, `missing data container for ${path}`, 200);
  }
  return data;
}

/** 빌드 상태 응답은 화면 polling 분기를 결정하므로 enum과 필수 필드를 런타임에서 검증한다. */
function requireWikiBuildStatus(data: unknown, path: string): WikiBuildStatusData {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ApiError(FALLBACK_ERROR_CODE, `invalid build status payload for ${path}`, 200);
  }

  const payload = data as Record<string, unknown>;
  const validStatus = ["BUILDING", "FAILED", "IDLE"].includes(String(payload.status));
  const validActiveCount =
    typeof payload.activeCount === "number" &&
    Number.isInteger(payload.activeCount) &&
    payload.activeCount >= 0;
  const validUpdatedAt = payload.updatedAt === null || typeof payload.updatedAt === "string";
  const validErrorCode = payload.errorCode === null || typeof payload.errorCode === "string";
  if (!validStatus || !validActiveCount || !validUpdatedAt || !validErrorCode) {
    throw new ApiError(FALLBACK_ERROR_CODE, `invalid build status payload for ${path}`, 200);
  }

  return payload as WikiBuildStatusData;
}

const WIKI_RESET_COUNT_FIELDS = [
  "resetDocumentCount",
  "resetRelationCount",
  "unsearchableChunkCount",
  "deletedSourceDocumentCount",
  "deletedSourceVersionCount",
  "redactedSourceEventCount",
  "retiredWikiVersionCount",
  "retiredInterestProfileCount",
  "cancelledJobCount",
] as const satisfies readonly (keyof WikiResetData)[];

/** 초기화 성공 응답의 필수 필드와 건수를 런타임에서 검증한다. */
function requireWikiResetData(data: unknown, path: string): WikiResetData {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ApiError(FALLBACK_ERROR_CODE, `invalid reset payload for ${path}`, 200);
  }

  const payload = data as Record<string, unknown>;
  const hasValidCounts = WIKI_RESET_COUNT_FIELDS.every((field) => {
    const value = payload[field];
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
  });
  if (
    typeof payload.userId !== "string" ||
    typeof payload.resetAt !== "string" ||
    typeof payload.requestId !== "string" ||
    !hasValidCounts
  ) {
    throw new ApiError(FALLBACK_ERROR_CODE, `invalid reset payload for ${path}`, 200);
  }

  return payload as WikiResetData;
}

/** 자동추출 관심 태그 목록. 빈 배열이면 훅이 empty 로 정규화한다. */
export async function fetchWikiTags(signal?: AbortSignal): Promise<WikiTag[]> {
  const path = "/api/wiki/tags";
  const data = requireContainer(await apiGet<WikiTagsData | null>(path, { signal }), path);
  if (!Array.isArray(data.tags)) {
    throw new ApiError(FALLBACK_ERROR_CODE, `invalid tags payload for ${path}`, 200);
  }
  return toWikiTags(data.tags);
}

/** 저장 자료 Wiki 문서 전체 목록. 태그 선택에 따른 필터는 화면 계층(lib/wiki.ts)에서 처리한다. */
export async function fetchWikiDocuments(signal?: AbortSignal): Promise<WikiDocument[]> {
  const path = "/api/wiki/documents";
  const data = requireContainer(await apiGet<WikiDocumentsData | null>(path, { signal }), path);
  if (!Array.isArray(data.items)) {
    throw new ApiError(FALLBACK_ERROR_CODE, `invalid documents payload for ${path}`, 200);
  }
  return toWikiDocuments(data.items);
}

/** 인증 사용자의 전체 Entity·Concept Graph를 조회한다. */
export async function fetchWikiGraph(signal?: AbortSignal): Promise<WikiGraph> {
  const path = "/api/wiki/graph";
  const data = requireContainer(await apiGet<WikiGraphData | null>(path, { signal }), path);
  return toWikiGraph(data);
}

/** 사용자별 Wiki 빌드 집계 상태. 브라우저는 Agent Job을 직접 조회하지 않는다. */
export async function fetchWikiBuildStatus(signal?: AbortSignal): Promise<WikiBuildStatusData> {
  const path = "/api/wiki/build-status";
  return requireWikiBuildStatus(await apiGet<unknown>(path, { signal }), path);
}

/** 사용자 원본을 영구 삭제하고 현재 개인 LLM Wiki 상태를 초기화한다. */
export async function resetWiki(signal?: AbortSignal): Promise<WikiResetData> {
  const path = "/api/wiki";
  return requireWikiResetData(await apiDelete<unknown>(path, { signal }), path);
}

export type WikiDocumentDetailResult =
  | { status: "ready"; document: WikiDocumentDetail }
  | { status: "notFound" };

/** Wiki Node 상세를 조회하며 삭제·미소유 문서는 notFound로 정규화한다. */
export async function fetchWikiDocumentDetail(
  documentId: string,
  signal?: AbortSignal,
): Promise<WikiDocumentDetailResult> {
  const path = `/api/wiki/documents/${encodeURIComponent(documentId)}`;
  try {
    const data = requireContainer(
      await apiGet<WikiDocumentDetailData | null>(path, { signal }),
      path,
    );
    const document = toWikiDocumentDetail(data);
    if (document === null) {
      throw new ApiError(FALLBACK_ERROR_CODE, `invalid document payload for ${path}`, 200);
    }
    return { status: "ready", document };
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") return { status: "notFound" };
    throw error;
  }
}

/**
 * 발견 관심사 숨기기 — POST /api/wiki/tags/blocks (service-api #93, V27).
 * 서버가 이름을 정규화해 저장하므로 화면은 표시 이름을 그대로 보낸다. 멱등.
 */
export async function blockWikiTag(name: string, signal?: AbortSignal): Promise<void> {
  await apiPost<null>("/api/wiki/tags/blocks", { name }, { signal });
}
