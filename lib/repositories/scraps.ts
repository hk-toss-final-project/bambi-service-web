import { FALLBACK_ERROR_CODE } from "@/constants/errors";
import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/api-client";
import type { ScrapCard, ScrapData } from "@/types/scrap";

/**
 * 스크랩 repository — 화면 훅과 Service API 사이의 단일 seam.
 * 전부 인증 필요(호출부가 authenticated 에서만 부른다).
 * 목록은 "아직 PUBLIC 인 카드만" 온다(비공개 전환/삭제는 백엔드가 자동 숨김) —
 * 빈 배열은 정상이며 훅이 empty 로 정규화한다.
 */

function requireContainer<T>(data: T | null | undefined, path: string): T {
  if (data === null || data === undefined) {
    throw new ApiError(FALLBACK_ERROR_CODE, `missing data container for ${path}`, 200);
  }
  return data;
}

/** 내 스크랩 목록 (스크랩 최신순). */
export async function fetchScraps(signal?: AbortSignal): Promise<ScrapCard[]> {
  const path = "/api/scraps";
  const data = requireContainer(await apiGet<ScrapCard[] | null>(path, { signal }), path);
  if (!Array.isArray(data)) {
    throw new ApiError(FALLBACK_ERROR_CODE, `invalid scraps payload for ${path}`, 200);
  }
  return data;
}

/** 담기 (멱등). */
export function scrapCard(cardPublicId: string): Promise<ScrapData> {
  return apiPost<ScrapData>(`/api/cards/${cardPublicId}/scrap`);
}

/** 담기 해제 (멱등). */
export function unscrapCard(cardPublicId: string): Promise<ScrapData> {
  return apiDelete<ScrapData>(`/api/cards/${cardPublicId}/scrap`);
}
