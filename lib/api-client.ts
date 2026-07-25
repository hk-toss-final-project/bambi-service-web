import {
  type ErrorCode,
  FALLBACK_ERROR_CODE,
  isAuthTokenError,
  isErrorCode,
} from "@/constants/errors";
import { emitAuthExpired } from "@/lib/auth-events";
import { clearAccessToken, getAccessToken } from "@/lib/token";
import type { ApiResponse } from "@/types/api";

/**
 * 공통 API client (CLAUDE.md §3·§6·§8).
 *
 * - 모든 Service API 요청은 이 계층을 통과한다. 컴포넌트에서 fetch 직접 호출 금지.
 * - base 는 NEXT_PUBLIC_API_URL(origin). 없거나 비어 있으면 빈 base → `/api/...` 상대경로(same-origin, §6).
 *   `/api` 를 포함한 전체 경로는 호출부가 넘긴다 → 코드상의 경로가 API 명세와 1:1 (예: "/api/auth/login").
 * - 응답은 공통 envelope({success,data,error})로 해석하고, 실패는 ApiError 로 throw 한다.
 */

/**
 * API base(origin) 결정 (§6 same-origin fallback).
 * - 값이 있으면(trim 후 비어 있지 않으면) 그 origin 을 쓰고 끝 슬래시를 제거한다(절대 URL).
 * - 미설정·빈 문자열·공백뿐이면 빈 문자열을 반환한다 → 요청이 `/api/...` 상대경로로 현재 origin(same-origin)에 간다.
 *   운영은 nginx 가 같은 origin 의 `/api/*` 를 service-api 로 전달하는 것을 전제로 한다.
 */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return ""; // 미설정·빈 문자열·공백 → same-origin 상대경로
  return raw.replace(/\/+$/, ""); // 절대 origin, 끝 슬래시 제거(중복 슬래시 방지)
}

/**
 * API 실패를 나타내는 에러. 화면은 code 로 문구를 결정한다(rawMessage 는 로깅 전용).
 * code 는 알려진 ErrorCode 로 정규화되며, 미상 코드는 INTERNAL_ERROR 로 취급한다(§4).
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly rawCode: string;
  readonly status: number;

  constructor(rawCode: string, rawMessage: string, status: number) {
    super(rawMessage);
    this.name = "ApiError";
    this.rawCode = rawCode;
    this.code = isErrorCode(rawCode) ? rawCode : FALLBACK_ERROR_CODE;
    this.status = status;
  }
}

export type RequestOptions = {
  /** 인증 헤더(Bearer) 부착 여부. 기본 true. login/signup 등 공개 요청은 false. */
  auth?: boolean;
  /** 요청 body (JSON 직렬화). */
  body?: unknown;
  method?: string;
  signal?: AbortSignal;
};

/**
 * 저수준 요청. path 는 `/api` 를 포함한 전체 경로(예: "/api/auth/me").
 * 성공 시 data(T)를 반환한다. success:true 여도 data 가 null/빈 배열일 수 있으므로
 * 호출부(화면)에서 Empty 상태를 처리한다(§3·§9).
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, body, method = "GET", signal } = options;
  const url = `${getApiBaseUrl()}${path}`;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (cause) {
    // 네트워크 오류 등 — INTERNAL_ERROR 에 준해 처리(§4). 자동 재시도는 하지 않는다.
    throw new ApiError(FALLBACK_ERROR_CODE, `network error: ${String(cause)}`, 0);
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  // 공통 envelope 미준수/파싱 실패 — INTERNAL_ERROR 처리
  if (!payload || typeof payload.success !== "boolean") {
    throw new ApiError(FALLBACK_ERROR_CODE, `invalid response shape (status ${res.status})`, res.status);
  }

  if (!payload.success) {
    const code = payload.error?.code ?? FALLBACK_ERROR_CODE;
    const message = payload.error?.message ?? "";
    // 토큰 만료·무효(AUTH_INVALID_TOKEN): 저장 토큰을 제거하고 같은 탭에 인증 만료 이벤트를 발생시킨다
    // → AuthProvider 가 상태를 guest 로 동기화한다. 리다이렉트는 상위(라우트 가드/레이아웃)의 책임 →
    // 여기서 네비게이션하지 않아 무한 리다이렉트·재요청을 방지한다(§4·§5).
    // 다른 코드(AUTH_INVALID_CREDENTIALS·FORBIDDEN 등)에는 발생시키지 않는다.
    if (isAuthTokenError(code)) {
      clearAccessToken();
      emitAuthExpired();
    }
    throw new ApiError(code, message, res.status);
  }

  return payload.data as T;
}

/** GET. path 는 `/api` 포함 전체 경로. */
export function apiGet<T>(path: string, options?: Omit<RequestOptions, "body" | "method">): Promise<T> {
  return request<T>(path, { ...options, method: "GET" });
}

/** POST. path 는 `/api` 포함 전체 경로. */
export function apiPost<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "body" | "method">,
): Promise<T> {
  return request<T>(path, { ...options, method: "POST", body });
}
