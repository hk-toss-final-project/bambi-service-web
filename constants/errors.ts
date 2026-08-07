/**
 * 공통 에러 코드 → 사용자 문구 매핑 (CLAUDE.md §4, 단일 소스).
 *
 * 코드명은 백엔드 enum(bambi-service-api ErrorCode.java)과 글자 그대로 일치한다.
 * 프론트에서 새 코드를 임의로 만들지 않는다. 미정의/미상 코드는 INTERNAL_ERROR 에 준해 처리한다.
 *
 * `INTEREST_NOT_FOUND` 는 온디맨드 생성 계약으로 **확정됐고 Service 코드 반영을 기다리는** 코드다
 * (2026-08-06 확정). 배포 전까지는 서버가 이 코드를 보내지 않아 매핑이 발동하지 않고, 배포되면
 * 별도 수정 없이 그대로 동작한다 — 임의 창작 코드가 아니다.
 *
 * 문구 원칙: 해요체 · 비난 없음 · (원인 + 다음 행동). 서버 error.message 원문은 노출하지 않는다.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_INVALID_TOKEN: "AUTH_INVALID_TOKEN",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  DUPLICATE_RESOURCE: "DUPLICATE_RESOURCE",
  /**
   * 온디맨드 생성 요청의 topic 이 현재 Service 관심사에 없음(404).
   * 전역 NOT_FOUND 와 **의미가 다르다** — "리소스 부재"가 아니라 "그 사이 관심사가 사라졌으니
   * 다시 고르라"는 복구 가능한 상태다. 그래서 NOT_FOUND 문구를 바꾸지 않고 코드를 따로 둔다.
   */
  INTEREST_NOT_FOUND: "INTEREST_NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** 미정의/미상 코드 처리 기준 (CLAUDE.md §4). */
export const FALLBACK_ERROR_CODE: ErrorCode = ERROR_CODES.INTERNAL_ERROR;

/** 코드 → 사용자 노출 문구 (단일 소스). 페이지마다 문구를 새로 쓰지 않는다. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "입력한 내용을 다시 확인해 주세요.",
  AUTH_INVALID_CREDENTIALS: "이메일 또는 비밀번호가 일치하지 않아요. 다시 확인해 주세요.",
  AUTH_INVALID_TOKEN: "로그인이 만료됐어요. 다시 로그인해 주세요.",
  FORBIDDEN: "이 페이지를 볼 권한이 없어요.",
  NOT_FOUND: "요청한 정보를 찾을 수 없어요. 목록에서 다시 확인해 주세요.",
  DUPLICATE_RESOURCE: "이미 가입된 이메일이에요.",
  INTEREST_NOT_FOUND: "이 관심사는 더 이상 내 관심사에 없어요. 다시 선택해 주세요.",
  INTERNAL_ERROR: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
};

/** 알려진 에러 코드인지 판별. */
export function isErrorCode(code: string): code is ErrorCode {
  return Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code);
}

/** 코드 → 사용자 문구. 미상 코드는 INTERNAL_ERROR 문구로 대체(§4). */
export function resolveErrorMessage(code: string | null | undefined): string {
  if (code && isErrorCode(code)) return ERROR_MESSAGES[code];
  return ERROR_MESSAGES[FALLBACK_ERROR_CODE];
}

/** 토큰 만료·무효 코드 여부. true 면 저장 토큰 제거 + 로그인 이동 대상(§4·§5). */
export function isAuthTokenError(code: string | null | undefined): boolean {
  return code === ERROR_CODES.AUTH_INVALID_TOKEN;
}
