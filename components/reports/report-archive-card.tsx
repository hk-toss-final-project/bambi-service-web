"use client";

import Link from "next/link";

import { ReportTypeBadge } from "@/components/report/report-type-badge";
import type { ArchiveItem } from "@/types/report-archive";

/**
 * 아카이브 카드 — 목업 library.html `.kb-card` 기반(제목·요약·메타 1줄).
 *
 * 실측 필드(항상): 제목 · 요약 · 생성 시각 · 유형 배지(reportType — 서버가 줄 때만).
 * mock 메타(item.mock 있을 때만): 공개 배지(PUBLIC) · **대표 태그 1개**.
 * 출처 건수·♡/댓글/조회 통계는 정보 밀도를 줄이기 위해 카드에서 렌더하지 않는다(2026-08-03 QA) —
 * 데이터·타입은 그대로 유지하며 검색 대상(sources 등)도 바꾸지 않는다.
 * 실 API 모드(mock=null)에서는 생성 시각만 남은 실측 카드로 자연 축소된다(화면 안 깨짐).
 *
 * view="grid": 카드 높이가 지나치게 달라지지 않도록 제목도 2줄로 제한하고 메타를 하단 고정한다.
 */
export function ReportArchiveCard({
  item,
  view = "list",
}: {
  item: ArchiveItem;
  view?: "list" | "grid";
}) {
  const isGrid = view === "grid";
  const mock = item.mock;
  // 대표 태그 — 배열이 여러 개여도 첫 번째 1개만 노출한다.
  const firstTag = mock !== null && mock.tags.length > 0 ? mock.tags[0] : null;

  return (
    <article
      className={`rounded-[14px] border border-border bg-card px-5 py-4 ${
        isGrid ? "flex h-full min-w-0 flex-col" : "mb-2.5"
      }`}
    >
      {/* .krow1 .t */}
      <h3
        className={`text-[15px] leading-[1.45] font-bold tracking-[-0.01em] text-foreground ${
          isGrid ? "line-clamp-2" : ""
        }`}
      >
        <Link
          href={`/report/${item.publicId}`}
          className="focus-ring rounded-[3px] hover:text-signal-ink"
        >
          {item.title}
        </Link>
      </h3>

      {/* .s — 요약(2줄 클램프) */}
      {item.summary && (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.65] text-ink-mid">{item.summary}</p>
      )}

      {/* .m — 메타 1줄: [유형] [공개] #대표태그 · 시각. 배지·태그는 mock 메타가 있을 때만, 시각은 실측.
          모든 항목을 h-[22px] inline-flex items-center 로 통일해(행은 leading-none) 배지와 일반
          텍스트의 수직 중앙을 맞춘다. 태그·구분점·시각은 한 그룹(whitespace-nowrap)으로 묶어
          줄바꿈 시 `·` 가 다음 줄 첫머리에 단독으로 떨어지지 않는다. 표시할 것이 없으면 행 생략. */}
      {(mock !== null || item.reportType !== null || item.timeLabel !== "") && (
        <div
          className={`flex flex-wrap items-center gap-x-[7px] gap-y-1 text-xs leading-none text-muted-foreground ${
            isGrid ? "mt-auto pt-2.5" : "mt-[9px]"
          }`}
        >
          {/* 유형 배지 — **실 응답 필드**라 mock 유무와 무관하게 렌더한다(값 없으면 스스로 사라진다). */}
          <ReportTypeBadge reportType={item.reportType} size="archive" />
          {/* 공개 배지 — mock 메타가 있고 PUBLIC 일 때만(목업 초록 톤) */}
          {mock?.visibility === "PUBLIC" && (
            <span className="inline-flex h-[22px] items-center rounded-full border border-[rgba(52,166,106,.3)] bg-[rgba(52,166,106,.08)] px-2 text-[10.5px] font-semibold whitespace-nowrap text-ok">
              공개
            </span>
          )}
          {(firstTag || item.timeLabel) && (
            <span className="inline-flex h-[22px] items-center gap-x-[7px] whitespace-nowrap">
              {firstTag && <span>{firstTag}</span>}
              {firstTag && item.timeLabel && <span aria-hidden="true">·</span>}
              {item.timeLabel && <span>{item.timeLabel}</span>}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
