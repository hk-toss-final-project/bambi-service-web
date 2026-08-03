/**
 * 프로필 도메인 타입 (07-31 실측 기반).
 * 백엔드: GET /api/users/{publicId}/profile · GET /api/users/{publicId}/cards ·
 *         PUT /api/users/me · POST/DELETE /api/users/{publicId}/follow
 * 공개 프로필·작성자 카드는 비로그인 열람 허용(백엔드 permitAll) — 게스트도 볼 수 있다.
 */

/** GET /api/users/{publicId}/profile 의 data. */
export type Profile = {
  publicId: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  joinedAt: string; // ISO — 화면에는 "가입 YYYY년 M월"로 표기
  followerCount: number;
  followingCount: number;
  following: boolean; // 보고 있는 내가 이 사용자를 팔로우 중인지 (게스트는 항상 false)
  publicCardCount: number;
};

/** 작성자 공개 카드(프로필 브리핑 리스트) — 공개 피드 카드와 같은 모양. */
export type AuthorCard = {
  publicId: string;
  title: string;
  summary: string;
  author: { publicId: string | null; username: string | null; displayName: string | null };
  likeCount: number;
  liked: boolean;
  sources: { title: string | null; url: string | null }[];
  createdAt: string;
};

/** PUT /api/users/me 요청 body — 프로필 편집 모달 3필드. */
export type UpdateProfileRequest = {
  displayName: string;
  username: string | null; // 미변경이면 현재값 그대로 전송(빈값=변경 없음 처리)
  bio: string | null;
};

/** POST/DELETE /api/users/{publicId}/follow 의 data. */
export type FollowData = {
  following: boolean;
  followerCount: number;
};
