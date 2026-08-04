import { apiDelete, apiPost } from "@/lib/api-client";
import type { LikeData } from "@/types/feed";

/**
 * 카드 좋아요 repository — 화면 훅과 Service API 사이의 단일 seam.
 * (service-api LikeController·LikeService 실측 · 검증일 2026-08-04, PR #14 도입)
 *
 *   POST   /api/cards/{publicId}/like  → ApiResponse<LikeData>
 *   DELETE /api/cards/{publicId}/like  → ApiResponse<LikeData>
 *
 * - 요청 body 가 없다. 대상은 path 의 publicId(UUID) 뿐이다.
 * - 둘 다 인증 필수(SecurityConfig permitAll 은 GET 만) → 호출부가 requireAuth 로 감싸
 *   게스트 클릭이 401 을 만들지 않게 한다.
 * - 응답 { liked, likeCount } 는 서버 확정값이다. 프론트가 증감을 계산하지 않는다.
 * - 멱등: 중복 좋아요는 ON CONFLICT DO NOTHING, 중복 취소는 0건 삭제 — 409 가 오지 않는다.
 * - 좋아요는 PUBLIC 카드에만 가능하다(비공개·부재·형식오류는 존재 노출 없이 404).
 *   취소는 PUBLIC 검사를 하지 않아 소유자가 비공개로 바꾼 뒤에도 성공한다.
 */

/** 좋아요 (멱등). */
export function likeCard(cardPublicId: string): Promise<LikeData> {
  return apiPost<LikeData>(`/api/cards/${cardPublicId}/like`);
}

/** 좋아요 취소 (멱등). */
export function unlikeCard(cardPublicId: string): Promise<LikeData> {
  return apiDelete<LikeData>(`/api/cards/${cardPublicId}/like`);
}
