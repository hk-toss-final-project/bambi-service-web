"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData, type AsyncErrorState } from "@/hooks/use-async-data";
import { fetchReport, type ReportResult } from "@/lib/repositories/report";

/**
 * 리포트 상세 데이터 훅 — 등록된 id 의 데이터 상태를 관리한다.
 * (미등록 id 의 404 는 서버 app/report/[id]/page.tsx 가 처리하므로 여기서 다루지 않는다.)
 *
 * - 인증 확정(guest·authenticated) 뒤에만 요청한다. 인증 loading/error 중에는 요청하지 않는다.
 *   → ReportScreen 최상위에서 항상 호출하되(조건부 호출 금지) enabled 로 제어한다.
 *     인증 loading 은 상위 ReportSkeleton, 데이터 loading 은 이 훅의 loading 이 담당한다.
 *   loading→guest/authenticated 로 확정되면 enabled 가 true 로 바뀌며 요청이 시작된다.
 * - loading / ready / preparing / error + refetch.
 *
 * 재조회 트리거는 id(fetcher identity) + refetch 로 한정한다. 로그인/로그아웃 시 재-인가를 위한
 * 자동 재조회는 mock 에선 결과가 동일해 무의미하므로 두지 않는다(불필요한 의존성 배제).
 * 실 API 연동 시 인가·재검증 정책에 맞춰 이 의존성을 조정한다(§ repository 교체와 함께).
 */
export type ReportDetailState =
  | { status: "loading" }
  | ReportResult
  | AsyncErrorState;

export function useReportDetail(id: string): ReportDetailState & { refetch: () => void } {
  const { status } = useAuth();
  const enabled = status === "guest" || status === "authenticated";
  const fetcher = useCallback((signal: AbortSignal) => fetchReport(id, signal), [id]);
  const state = useAsyncData<ReportResult>(fetcher, enabled);

  if (state.status === "success") return { ...state.data, refetch: state.refetch };
  if (state.status === "error") return { status: "error", errorCode: state.errorCode, refetch: state.refetch };
  return { status: "loading", refetch: state.refetch }; // idle · loading → 데이터 로딩
}
