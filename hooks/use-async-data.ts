"use client";

import { useCallback, useEffect, useState } from "react";

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
 */
export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error" };

type Settled<T> =
  | { fetcher: unknown; reload: number; status: "success"; data: T }
  | { fetcher: unknown; reload: number; status: "error" };

export function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  enabled: boolean,
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
      .catch(() => {
        // abort 로 인한 거부는 오류로 취급하지 않는다(언마운트·재조회 정리).
        if (!ignore && !controller.signal.aborted) {
          setSettled({ fetcher, reload, status: "error" });
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
      : { status: "error", refetch };
  }
  return { status: "loading", refetch };
}
