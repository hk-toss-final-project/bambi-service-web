"use client";

import { useCallback } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData, type AsyncErrorState } from "@/hooks/use-async-data";
import { toArchiveCard } from "@/lib/adapters/report-archive";
import { toArchiveItems } from "@/lib/adapters/report-archive-mock";
import { fetchMemberFeed } from "@/lib/repositories/feed";
import type { ArchiveItem } from "@/types/report-archive";

/**
 * 내 보고서 전체 보기(/reports) 데이터 훅 — 기존 repository seam(fetchMemberFeed = GET /api/feed)을
 * 재사용한다(중복 repository 없음). 실측: 이 API 는 인증 사용자 본인의 카드 **전량**을 최신순으로
 * 반환한다(서버 LIMIT·페이지네이션 없음) → "전체 보기" 명칭이 성립한다.
 *
 * - authenticated 에서만 요청한다(guest 직접 진입 시 API 미호출 — 화면 가드가 안내 담당).
 * - 요청은 마운트당 1회 + refetch 뿐이다. 검색은 순수 필터라 이 훅을 다시 부르지 않는다.
 * - **빈 배열은 error 가 아니라 ready([]) 다** — 화면이 "전체 Empty"와 "검색 결과 없음"을 구분한다.
 */
export type ReportArchiveState =
  | { status: "loading" }
  | { status: "ready"; data: ArchiveItem[] }
  | AsyncErrorState;

export function useReportArchive(): ReportArchiveState & { refetch: () => void } {
  const { status } = useAuth();
  const enabled = status === "authenticated";
  const fetcher = useCallback(async (signal: AbortSignal): Promise<ArchiveItem[]> => {
    const cards = await fetchMemberFeed(signal);
    // 실데이터 → 화면 모델. mock 메타 병합·데모 항목 추가는 mock seam 한 곳에서만 일어난다.
    return toArchiveItems(cards.map(toArchiveCard));
  }, []);
  const state = useAsyncData<ArchiveItem[]>(fetcher, enabled);

  if (state.status === "success") return { status: "ready", data: state.data, refetch: state.refetch };
  if (state.status === "error") return { status: "error", errorCode: state.errorCode, refetch: state.refetch };
  return { status: "loading", refetch: state.refetch }; // idle · loading → 데이터 로딩
}
