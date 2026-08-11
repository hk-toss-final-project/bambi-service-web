"use client";

import { useCallback } from "react";

import { useAsyncData } from "@/hooks/use-async-data";
import { fetchMyBookmarks } from "@/lib/repositories/bookmark";
import type { SavedBookmark } from "@/types/feed";

const SAVED_AT_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** 최근 몇 건만 — 이 스트립은 "저장 확인"용이지 아카이브가 아니다(전체는 LLM Wiki 문서로). */
const RECENT_LIMIT = 5;

/**
 * 최근 저장한 자료(원본) 스트립 — 2026-08-11 우석 지적으로 신설.
 *
 * 문제: 저장(＋관심 자료) 직후 위키 반영까지 10~30분 동안 화면 어디에도 흔적이 없어
 * "넣었는지 안 넣었는지"를 확인할 수 없었다. 이 스트립은 위키 처리와 무관한
 * **원본 목록(GET /api/bookmarks)** 을 바로 보여줘 그 공백을 메운다.
 *
 * - AddMaterialModal 저장 성공 시 호출부가 refetch 를 불러 **저장 직후 즉시** 여기 나타난다.
 * - status(서버 enum)는 해석하지 않는다 — 미검증 어휘를 배지로 만들지 않는 원칙.
 *   "AI 분석 후 아래에 요약과 함께" 안내문이 처리 중 상태를 대신 설명한다.
 * - empty 는 섹션 자체를 숨긴다(저장 이력이 없으면 확인할 것도 없음 — ScrapRail 자기-null 관례).
 */
export function WikiRecentSaves({ state }: { state: RecentSavesState }) {
  if (state.status === "loading" || state.status === "idle") {
    return null;   // 짧은 목록이라 스켈레톤 없이 조용히 — 본문 스켈레톤은 상위 화면이 담당
  }
  if (state.status === "error") {
    return (
      <section className="mb-4 rounded-[14px] border border-border bg-card px-[18px] py-3.5">
        <span className="text-[12.5px] text-ink-mid">최근 저장한 자료를 불러오지 못했어요. </span>
        <button
          type="button"
          onClick={state.refetch}
          className="focus-ring rounded-[3px] text-[12.5px] font-semibold text-signal-ink"
        >
          다시 시도
        </button>
      </section>
    );
  }
  if (state.data.length === 0) {
    return null;
  }

  const recent = state.data.slice(0, RECENT_LIMIT);
  return (
    <section className="mb-4 rounded-[14px] border border-border bg-card px-[18px] pt-4 pb-3">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-bold text-foreground">최근 저장한 자료</h3>
        <span className="text-[11.5px] text-muted-foreground">
          총 {state.data.length}건 저장됨
        </span>
      </div>
      <p className="mb-2.5 text-[12px] leading-[1.6] text-muted-foreground">
        저장은 완료됐어요. AI 분석이 끝나면 나의 LLM Wiki에 요약과 함께 정리돼요.
      </p>
      <ul>
        {recent.map((item) => (
          <li
            key={item.id}
            className="flex items-baseline gap-3 border-t border-border py-2 first:border-t-0"
          >
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
              {displayName(item)}
            </span>
            <span className="shrink-0 text-[11.5px] text-muted-foreground">
              {formatSavedAt(item.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export type RecentSavesState = ReturnType<typeof useRecentSaves>;

/** 원본 목록 훅 — authenticated 화면(WikiView)에서만 마운트되므로 항상 enabled. */
export function useRecentSaves() {
  const fetcher = useCallback((signal: AbortSignal) => fetchMyBookmarks(signal), []);
  return useAsyncData<SavedBookmark[]>(fetcher, true);
}

/** 표시명 — 제목이 없으면 URL(도메인 우선), 그것도 없으면 본문 저장 안내. */
function displayName(item: SavedBookmark): string {
  if (item.title && item.title.trim() !== "") return item.title.trim();
  if (item.url && item.url.trim() !== "") {
    try {
      return new URL(item.url).hostname;
    } catch {
      return item.url;
    }
  }
  return "본문으로 저장한 자료";
}

function formatSavedAt(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  return SAVED_AT_FORMAT.format(new Date(ts));
}
