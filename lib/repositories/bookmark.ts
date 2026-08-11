import { apiGet, apiPost } from "@/lib/api-client";
import type { BookmarkCreateData, CreateBookmarkRequest, SavedBookmark } from "@/types/feed";

/**
 * 관심 자료 저장 repository — 단일 seam.
 *
 * POST /api/bookmarks(인증). 성공 시 201 { bookmark, card } 를 반환한다(동기 즉시 카드).
 * url·content 중 최소 하나 필수는 서버가 검증한다(위반 시 VALIDATION_ERROR).
 * 프론트는 card 만 사용하고 bookmark 내부 구조는 해석하지 않는다.
 */
export function createBookmark(req: CreateBookmarkRequest): Promise<BookmarkCreateData> {
  return apiPost<BookmarkCreateData>("/api/bookmarks", req);
}

/**
 * 내가 저장한 관심 자료 원본 목록 — GET /api/bookmarks(인증).
 * 위키 반영(10~30분)과 무관하게 "저장 자체"를 즉시 확인하는 용도(2026-08-11 우석).
 * null data 는 빈 목록으로 정규화한다.
 */
export async function fetchMyBookmarks(signal?: AbortSignal): Promise<SavedBookmark[]> {
  const data = await apiGet<SavedBookmark[] | null>("/api/bookmarks", { signal });
  return data ?? [];
}
