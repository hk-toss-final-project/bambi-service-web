import { FALLBACK_ERROR_CODE } from "@/constants/errors";
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client";
import type { AuthorCard, FollowData, Profile, UpdateProfileRequest } from "@/types/profile";
import type { User } from "@/types/auth";

/**
 * 프로필 repository — 화면 훅과 Service API 사이의 단일 seam.
 *
 * - 공개 프로필·작성자 카드는 백엔드 permitAll(GET) — 게스트 열람 허용이라 auth:false 로 호출한다
 *   (토큰이 있으면 following/liked 를 채우고 싶으므로, 로그인 상태에서는 기본(auth:true)으로 호출).
 * - 팔로우/편집은 인증 필수 — 호출부(화면)가 requireAuth 로 감싼다.
 * - 정상 빈 목록(공개 카드 0건)은 오류가 아니다 → 빈 배열 반환, 훅이 empty 로 정규화.
 */

function requireContainer<T>(data: T | null | undefined, path: string): T {
  if (data === null || data === undefined) {
    throw new ApiError(FALLBACK_ERROR_CODE, `missing data container for ${path}`, 200);
  }
  return data;
}

/** 공개 프로필. authed=false(게스트)면 Bearer 없이 호출한다(401 인터셉트 회피). */
export async function fetchProfile(
  publicId: string,
  authed: boolean,
  signal?: AbortSignal,
): Promise<Profile> {
  const path = `/api/users/${publicId}/profile`;
  return requireContainer(await apiGet<Profile | null>(path, { signal, auth: authed }), path);
}

/** 작성자의 공개 카드 목록(프로필 브리핑 리스트). 빈 배열이면 훅이 empty 로 정규화한다. */
export async function fetchAuthorCards(
  publicId: string,
  authed: boolean,
  signal?: AbortSignal,
): Promise<AuthorCard[]> {
  const path = `/api/users/${publicId}/cards`;
  const data = requireContainer(
    await apiGet<AuthorCard[] | null>(path, { signal, auth: authed }),
    path,
  );
  if (!Array.isArray(data)) {
    throw new ApiError(FALLBACK_ERROR_CODE, `invalid cards payload for ${path}`, 200);
  }
  return data;
}

/** 프로필 편집 — 성공 시 갱신된 사용자 요약(User 모양)을 돌려준다. */
export function updateMyProfile(req: UpdateProfileRequest): Promise<User> {
  return apiPut<User>("/api/users/me", req);
}

/** 팔로우 (멱등). */
export function followUser(publicId: string): Promise<FollowData> {
  return apiPost<FollowData>(`/api/users/${publicId}/follow`);
}

/** 언팔로우 (멱등). */
export function unfollowUser(publicId: string): Promise<FollowData> {
  return apiDelete<FollowData>(`/api/users/${publicId}/follow`);
}
