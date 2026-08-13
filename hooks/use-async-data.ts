"use client";

import { useCallback, useEffect, useState } from "react";

import type { ErrorCode } from "@/constants/errors";
import { ApiError } from "@/lib/api-client";

/**
 * 공통 비동기 데이터 프리미티브 — loading / success / error + refetch.
 * 도메인 훅(usePublicFeed·useMemberFeed·useReportDetail 등)이 공유한다.
 *
 * 설계 원칙:
 * - 의존성은 [fetcher, enabled, reload] 만 사용한다. deps 배열 펼치기·exhaustive-deps 비활성화 금지.
 *   도메인 훅이 fetcher 를 useCallback 으로 고정하고, 그 identity 변화가 재조회 트리거가 된다.
 * - enabled=false 면 요청을 시작하지 않는다(인증 확정 전 데이터 요청 방지). 이때 status="idle".
 * - loading 은 "settled 결과의 태그(fetcher·reload)가 현재 값과 일치하는가"로 파생한다.
 *   → effect 본문에서 동기 setState 를 하지 않아 set-state-in-effect 를 피하고,
 *     입력(fetcher·reload)이 바뀌는 순간 즉시 loading 으로 돌아간다(오래된 결과 노출 없음).
 * - 언마운트·경합은 effect 내부 ignore 플래그 + AbortController 로 막는다(늦은/취소된 응답 커밋 차단).
 * - 실패는 `errorCode` 로 **원인을 보존**한다(FE-QA-001). 이전에는 status="error" 만 남겨서
 *   FORBIDDEN·AGENT_UNAVAILABLE·500·네트워크 끊김이 화면에서 전부 같은 문구로 보였다.
 */

/**
 * 실패 상태의 공통 모양 — 도메인 훅이 자기 상태 union 을 만들 때 이 타입을 재사용한다.
 *
 * `errorCode` 가 **optional** 인 건 계약이다: 네트워크 오류(fetch 자체 실패)처럼 서버 응답이
 * 없으면 코드가 존재하지 않는다. 소비 측은 "없을 수 있음"을 전제로 `resolveErrorMessage` 의
 * fallback(§4)에 맡긴다 — 코드가 없다고 별도 문구를 새로 만들지 않는다.
 */
export type AsyncErrorState = { status: "error"; errorCode?: ErrorCode };

export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | AsyncErrorState;

type Settled<T> =
  | { fetcher: unknown; reload: number; status: "success"; data: T }
  | ({ fetcher: unknown; reload: number } & AsyncErrorState);

/**
 * @param keepPreviousData refetch 중에도 직전 성공 데이터를 유지할지 (기본 false).
 *
 * 목록에서 항목을 추가·삭제한 뒤 재조회할 때 기본 동작(loading 복귀)은 섹션이 통째로
 * 스켈레톤으로 바뀌어 **화면이 새로고침된 것처럼 깜빡인다**(2026-08-11 우석 지적, /wiki 삭제).
 * true 면 새 응답이 올 때까지 이전 목록을 그대로 두고 조용히 교체한다.
 *
 * ⚠️ **fetcher 가 바뀐 경우에는 유지하지 않는다** — 다른 대상(다른 사용자·다른 id)의 데이터를
 * 잠시라도 보여주면 안 되기 때문이다. 유지하는 건 같은 fetcher 의 재조회(reload)뿐이다.
 * 기본값이 false 라 기존 호출부 동작은 그대로다(opt-in).
 */
export function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  enabled: boolean,
  keepPreviousData = false,
): AsyncState<T> & { refetch: () => void } {
  const [reload, setReload] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let ignore = false;
    const controller = new AbortController();
    fetcher(controller.signal)
      .then((data) => {
        if (!ignore) setSettled({ fetcher, reload, status: "success", data });
      })
      .catch((error: unknown) => {
        // abort 로 인한 거부는 오류로 취급하지 않는다(언마운트·재조회 정리).
        if (!ignore && !controller.signal.aborted) {
          // ApiError.code 는 공통 client 가 이미 정규화한 값이다(미상 코드 → INTERNAL_ERROR).
          // ApiError 가 아니면(네트워크 단절·JSON 파싱 실패 등) 코드가 없으므로 undefined 로 둔다.
          const errorCode = error instanceof ApiError ? error.code : undefined;
          setSettled({ fetcher, reload, status: "error", errorCode });
        }
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [fetcher, enabled, reload]);

  const refetch = useCallback(() => setReload((n) => n + 1), []);

  if (!enabled) return { status: "idle", refetch };
  // settled 태그가 현재 (fetcher, reload)와 일치할 때만 결과로 확정한다 — 아니면 loading.
  if (settled && settled.fetcher === fetcher && settled.reload === reload) {
    return settled.status === "success"
      ? { status: "success", data: settled.data, refetch }
      : { status: "error", errorCode: settled.errorCode, refetch };
  }
  // 재조회 중(같은 fetcher, reload 만 증가)이고 직전 성공 데이터가 있으면 그대로 보여준다.
  if (keepPreviousData && settled?.status === "success" && settled.fetcher === fetcher) {
    return { status: "success", data: settled.data, refetch };
  }
  return { status: "loading", refetch };
}
