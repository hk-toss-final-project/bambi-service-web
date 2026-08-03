/**
 * 인증 도메인 타입 (CLAUDE.md §3 실측 기반).
 * 백엔드: bambi-service-api /api/auth/*
 */

/** 사용자. 로그인/회원가입/`me` 응답에 공통으로 등장한다.
 * publicId·username·bio 는 07-31 백엔드 UserSummary 확장(#24) — 배포 전 응답과의
 * 호환을 위해 optional 로 둔다. publicId 는 내 프로필(/users/{publicId}) 진입에 쓴다. */
export type User = {
  id: number;
  email: string;
  displayName: string;
  roles: string[]; // 예: ["USER"] / ["ADMIN"]
  publicId?: string;
  username?: string | null;
  bio?: string | null;
};

/** POST /api/auth/login 성공 응답의 data. accessToken 은 data.accessToken 위치. */
export type LoginData = {
  accessToken: string;
  tokenType: string; // "Bearer"
  expiresInMinutes: number; // 예: 120 (2시간)
  user: User; // 로그인 응답에 user 동봉 → 직후 /api/auth/me 재호출 불필요
};

/** POST /api/auth/signup 성공 응답의 data. 토큰은 포함되지 않는다(로그인 별도). */
export type SignupData = User;

/** POST /api/auth/login 요청 body. */
export type LoginRequest = {
  email: string;
  password: string;
};

/** POST /api/auth/signup 요청 body. displayName 필수(실측 확정). */
export type SignupRequest = {
  email: string;
  password: string;
  displayName: string;
};
