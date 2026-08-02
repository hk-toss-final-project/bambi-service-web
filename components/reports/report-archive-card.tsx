"use client";

import Link from "next/link";

import { REPORT_TYPE_LABEL } from "@/lib/mock/report-archive";
import type { ArchiveItem } from "@/types/report-archive";

/**
 * 아카이브 카드 — 목업 library.html `.kb-card` 기반(제목·요약·메타 1줄).
 *
 * 실측 필드(항상): 제목 · 요약 · 출처 개수 · 생성 시각. 제목은 기존 상세(/report/{publicId}) 링크.
 * mock 메타(item.mock 있을 때만): 유형 배지(.kbadge) · 공개 배지 · 태그 · ♡/댓글/조회 통계.
 * 실 API 모드(mock=null)에서는 mock 표시가 전부 빠진 실측 카드로 자연 축소된다(화면 안 깨짐).
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
  const showStats = mock !== null && mock.visibility === "PUBLIC";

  return (
    <article
      className={`rounded-[14px] border border-border bg-card px-[18px] py-[15px] ${
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

      {/* .m — 메타 1줄. 실측(출처·시각)은 항상, 유형·공개·태그·통계는 mock 메타가 있을 때만. */}
      <div
        className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground ${
          isGrid ? "mt-auto pt-2" : "mt-2"
        }`}
      >
        {mock && (
          <>
            {/* .kbadge — 유형 배지(아침 브리핑/온디맨드) */}
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap ${
                mock.reportType === "ON_DEMAND"
                  ? "border-wash-strong bg-wash text-signal-ink"
                  : "border-border bg-background text-ink-mid"
              }`}
            >
              {REPORT_TYPE_LABEL[mock.reportType]}
            </span>
            {/* 공개 배지 — PUBLIC 일 때만(목업 초록 톤) */}
            {mock.visibility === "PUBLIC" && (
              <span className="inline-flex items-center rounded-full border border-[rgba(52,166,106,.3)] bg-[rgba(52,166,106,.08)] px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-ok">
                공개
              </span>
            )}
            {mock.tags.map((tag) => (
              <span key={tag} className="whitespace-nowrap">
                {tag}
              </span>
            ))}
            <span aria-hidden="true">·</span>
          </>
        )}
        <span className="whitespace-nowrap">출처 {item.sources.length}건</span>
        {item.timeLabel && (
          <>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{item.timeLabel}</span>
          </>
        )}
        {showStats && (
          <>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">
              ♡ {mock.likeCount} · 댓글 {mock.commentCount} · 조회 {mock.viewCount}
            </span>
          </>
        )}
      </div>
    </article>
  );
}
