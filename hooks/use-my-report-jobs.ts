"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth/use-auth";
import {
  observePendingFailure,
  observePendingSuccess,
  type PendingIdSnapshot,
} from "@/lib/report-pending";
import { fetchPendingReports } from "@/lib/repositories/my-reports";
import type { GenerationPendingDto, MyReport } from "@/types/report";

type PendingRequestState =
  | { status: "loading" }
  | { status: "success"; data: GenerationPendingDto[] }
  | { status: "error" };

/** 홈 [내 보고서] 활성 생성 작업(PENDING/RUNNING/PUBLISHING) 상태. */
export type MyReportJobsState =
  | { status: "loading"; refetch: () => Promise<void> }
  | { status: "error"; refetch: () => Promise<void> }
  | { status: "ready"; preparing: MyReport[]; failed: MyReport[]; refetch: () => Promise<void> };

/**
 * 활성 Pending이 있으면 5초, 없으면 30초 간격으로 polling한다. idle polling은 화면을 연 뒤
 * 서버 스케줄러가 새로 만든 아침 리포트도 발견한다. 성공 응답의 ID가 다음 성공 응답에서
 * 사라지면 종결된 것으로 보고 완료 피드를 한 번 갱신한다. 실패 응답은 빈 목록으로 취급하지 않는다.
 *
 * `/pending`은 종결 상태를 반환하지 않으므로 failed는 별도 종결 API가 연결될 때까지 빈 배열이다.
 */
export function useMyReportJobs(onPendingSettled?: () => void): MyReportJobsState {
  const { status } = useAuth();
  const enabled = status === "authenticated";
  const fetcher = useCallback((signal: AbortSignal) => fetchPendingReports(signal), []);
  const [requestState, setRequestState] = useState<PendingRequestState>({ status: "loading" });
  const requestRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const refetch = useCallback(() => requestRef.current(), []);

  useEffect(() => {
    if (!enabled) {
      requestRef.current = () => Promise.resolve();
      return;
    }

    let effectActive = true;
    let inFlight = false;
    let queued = false;
    let hasSuccessfulResponse = false;
    let lastSuccessfulReports: GenerationPendingDto[] = [];
    let snapshot: PendingIdSnapshot = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    function stopTimer() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function scheduleNext(intervalMs: number | null) {
      stopTimer();
      if (!effectActive || intervalMs === null || document.hidden) return;
      timer = setTimeout(() => {
        timer = null;
        void runFetch();
      }, intervalMs);
    }

    async function runFetch(manual = false): Promise<void> {
      if (!effectActive) return;
      if (manual) stopTimer();
      if (inFlight) {
        queued = true;
        return;
      }

      inFlight = true;
      controller = new AbortController();
      if (!hasSuccessfulResponse) setRequestState({ status: "loading" });

      try {
        const reports = await fetcher(controller.signal);
        if (!effectActive) return;

        const observation = observePendingSuccess(snapshot, reports);
        snapshot = observation.snapshot;
        hasSuccessfulResponse = true;
        lastSuccessfulReports = reports;
        setRequestState({ status: "success", data: reports });
        if (observation.shouldRefreshFeed) onPendingSettled?.();
        scheduleNext(observation.nextIntervalMs);
      } catch {
        if (!effectActive || controller.signal.aborted) return;

        const observation = observePendingFailure(snapshot);
        snapshot = observation.snapshot;
        setRequestState(
          hasSuccessfulResponse
            ? { status: "success", data: lastSuccessfulReports }
            : { status: "error" },
        );
        scheduleNext(observation.nextIntervalMs);
      } finally {
        inFlight = false;
        if (effectActive && queued) {
          queued = false;
          stopTimer();
          void runFetch();
        }
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stopTimer();
        return;
      }
      void runFetch(true);
    }

    requestRef.current = () => runFetch(true);
    void runFetch();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      effectActive = false;
      queued = false;
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      controller?.abort();
      requestRef.current = () => Promise.resolve();
    };
  }, [enabled, fetcher, onPendingSettled]);

  if (!enabled || requestState.status === "loading") return { status: "loading", refetch };
  if (requestState.status === "error") return { status: "error", refetch };

  return {
    status: "ready",
    preparing: requestState.data.map(toPreparingReport),
    failed: [],
    refetch,
  };
}

function toPreparingReport(pending: GenerationPendingDto): MyReport {
  return {
    id: pending.id,
    title: pending.topic?.trim() || "관심사 보고서",
    reportType: pending.reportType,
    status: "PREPARING",
  };
}
