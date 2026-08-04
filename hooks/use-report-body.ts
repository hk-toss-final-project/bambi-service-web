"use client";

import { useCallback, useMemo } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData } from "@/hooks/use-async-data";
import {
  fetchReportBody,
  normalizeReportId,
  type ReportBodyResult,
} from "@/lib/repositories/report";
import type { ReportResponse } from "@/types/report";

/**
 * 리포트 본문 데이터 훅 — GET /api/reports/{reportPublicId}.
 *
 * 카드 상세(useCardDetail)가 ready 된 뒤 CardResponse.reportId 로 본문을 잇는 2단계 요청.
 * CardDetailView(카드 ready 시에만 mount)에서 호출되므로 카드 로딩 중에는 요청 자체가 없다.
 *
 * - reportId 정규화(normalizeReportId): undefined(필드 누락)·null·""·공백·비 UUID 는 전부
 *   요청 없이 none 확정이다. 이 값들은 notFound 가 아니다 — 서버에 물어본 적이 없기 때문이다.
 *   card.publicId 를 reportId 대체값으로 쓰지 않는다.
 *   API 에 생성 상태 필드가 없으므로 preparing 같은 상태도 지어내지 않는다.
 * - 인증 확정(guest·authenticated) + 유효 UUID 일 때만 요청, 마운트당 1회 + refetch 뿐.
 *   게스트를 포함하는 이유: 백엔드가 GET /api/reports/* 를 permitAll 로 열었고(#30), 권한은
 *   "내 리포트 or PUBLIC 카드가 참조하는 리포트"(ReportService 실측)라 게스트도 공개 본문을 읽는다.
 *   여기서 게스트를 빼면 카드 상세는 열리는데 본문만 영영 로딩으로 남는다(enabled=false → idle → loading).
 *   Bearer 부착(authed)은 로그인 확정 상태에서만 — 카드 상세(useCardDetail)와 같은 규약.
 *   재조회 트리거는 정규화된 id·authed(fetcher identity) 변경 + refetch 로 한정한다(401·404 자동 재요청 없음).
 *   StrictMode 의 이중 effect 는 useAsyncData 의 abort + (fetcher, reload) 태그 매칭이 정리한다.
 * - 유효 UUID 로 요청한 뒤 받은 404(NOT_FOUND: 부재·비공개 남의 리포트)만 notFound,
 *   그 외 오류는 error.
 */
export type ReportBodyState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; report: ReportResponse }
  | { status: "notFound" }
  | { status: "error" };

export function useReportBody(
  reportId: string | null | undefined,
): ReportBodyState & { refetch: () => void } {
  const { status } = useAuth();
  // 요청 가능한 값인지 판정은 repository 와 같은 함수로 단일화한다(화면·API 계층 판정 불일치 방지).
  const validId = useMemo(() => normalizeReportId(reportId), [reportId]);
  const enabled = (status === "guest" || status === "authenticated") && validId !== null;
  const authed = status === "authenticated";

  const fetcher = useCallback(
    (signal: AbortSignal): Promise<ReportBodyResult> => fetchReportBody(validId, authed, signal),
    [validId, authed],
  );
  const state = useAsyncData<ReportBodyResult>(fetcher, enabled);

  if (validId === null) return { status: "none", refetch: state.refetch };
  if (state.status === "success") {
    if (state.data.status === "ready") {
      return { status: "ready", report: state.data.report, refetch: state.refetch };
    }
    // none 은 위 가드에서 이미 걸러졌지만, repository 방어와 어긋나도 안전하게 none 을 유지한다.
    if (state.data.status === "none") return { status: "none", refetch: state.refetch };
    return { status: "notFound", refetch: state.refetch };
  }
  if (state.status === "error") return { status: "error", refetch: state.refetch };
  return { status: "loading", refetch: state.refetch }; // idle(인증 대기)·loading
}
