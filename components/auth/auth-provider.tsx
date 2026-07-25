"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api-client";
import { getMe, logout } from "@/lib/auth";
import { onAuthExpired } from "@/lib/auth-events";
import { getAccessToken } from "@/lib/token";
import type { User } from "@/types/auth";

import { AuthContext, type AuthContextValue, type AuthStatus } from "./use-auth";

/**
 * 인증 상태 계층 (CLAUDE.md §5·§15).
 *
 * 복구 규칙:
 * 1. 토큰 없음 → getMe() 호출 없이 guest
 * 2. 토큰 있음 → getMe() 호출
 * 3. 성공 → authenticated
 * 4. 401·403 → 토큰 제거 후 guest (403은 공통 client가 제거하지 않으므로 여기서 logout() 호출)
 * 5. 500·네트워크·미상 → error. 토큰은 유지(재시도 가능), 사용자 정보는 노출하지 않는다.
 *
 * 홈 `/`·상세 `/report/[id]`에는 리다이렉트 가드를 두지 않는다. Provider 는 상태만 관리하고
 * 네비게이션하지 않는다(무한 리다이렉트·재요청 방지, §4·§5).
 */
type AuthState = { status: AuthStatus; user: User | null };

export function AuthProvider({ children }: { children: ReactNode }) {
  // 서버·클라이언트 첫 렌더가 동일하도록 loading 으로 시작한다(하이드레이션 불일치 방지).
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  const refreshAuth = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ status: "guest", user: null });
      return;
    }
    setState((prev) => ({ status: "loading", user: prev.user }));
    try {
      const user = await getMe();
      setState({ status: "authenticated", user });
    } catch (err) {
      // 401·403 → 토큰 제거 후 guest. logout()으로 토큰 side-effect 를 lib/auth 에 집중한다(§5).
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        logout();
        setState({ status: "guest", user: null });
        return;
      }
      // 500·네트워크·미상 → error. 토큰 유지(재시도 가능), 사용자 정보는 노출하지 않는다.
      setState({ status: "error", user: null });
    }
  }, []);

  const setAuthenticatedUser = useCallback((user: User) => {
    setState({ status: "authenticated", user });
  }, []);

  const logoutUser = useCallback(() => {
    logout(); // 로컬 토큰 제거 (백엔드 logout API 없음, §15)
    setState({ status: "guest", user: null });
  }, []);

  // 최초 진입·새로고침 시 1회 인증 복구(localStorage 토큰 + 원격 getMe 동기화).
  // 토큰 없으면 getMe 호출 없이 guest 로 즉시 확정 — guest 에게 loading 깜빡임을 만들지 않기 위한
  // 의도된 동기 setState 라서 set-state-in-effect 규칙을 이 지점에 한해 해제한다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshAuth();
  }, [refreshAuth]);

  // 데이터 요청 중 AUTH_INVALID_TOKEN 발생 시(api-client 가 토큰 제거 후 이벤트 발생) 같은 탭 상태를
  // 즉시 guest 로 동기화한다. getMe 재호출·네비게이션 없음 — 화면 분기(guest)로 자연히 전환된다(§5).
  // idempotent: 이미 guest(+user 없음)면 상태를 바꾸지 않아 중복 이벤트·동시 401 에도 반복 렌더가 없다.
  useEffect(() => {
    return onAuthExpired(() => {
      setState((prev) =>
        prev.status === "guest" && prev.user === null ? prev : { status: "guest", user: null },
      );
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      refreshAuth,
      setAuthenticatedUser,
      logoutUser,
    }),
    [state.status, state.user, refreshAuth, setAuthenticatedUser, logoutUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
