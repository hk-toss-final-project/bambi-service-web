"use client";

import Link from "next/link";

import { monthlyArchiveCounts, recentlyViewedItems } from "@/lib/adapters/report-archive";
import { REPORT_ARCHIVE_MOCK_ENABLED } from "@/lib/mock/report-archive";
import type { ArchiveItem } from "@/types/report-archive";

/**
 * /reports 우측 rail — 목업 library.html 의 데스크톱 우측 패널 복원. ≤1240px 숨김(다른 rail 과 동일).
 *
 * - 쌓인 기록: **실측 createdAt 집계**(월별 건수, 최근 4개월, 최대 건수 대비 막대) — 고정 수치 없음.
 *   mock 모드에서는 데모 항목이 집계에 포함된다(디자인 검증용). 대량 데이터·페이지네이션 도입 시
 *   서버 월별 집계 API 가 필요하다(최종 보고 명시).
 * - 다시 찾은 보고서: 조회 이력 API 가 없어 **mock 메타(lastViewedAt·viewCount) 전용** —
 *   실 API 모드에서는 렌더하지 않는다. 목업 .rrelated 기준 **최대 2건**(아이콘 박스 28px ·
 *   제목 12.5px/1.4 2줄 제한 · 설명 11px 1줄 · 항목 구분선).
 */
export function ReportArchiveRail({ items }: { items: ArchiveItem[] }) {
  const months = monthlyArchiveCounts(items, new Date());
  const revisited = REPORT_ARCHIVE_MOCK_ENABLED ? recentlyViewedItems(items, 2) : [];
  const maxCount = months.reduce((max, m) => Math.max(max, m.count), 0);

  if (months.length === 0 && revisited.length === 0) return null;

  return (
    <aside className="sticky top-4 flex w-[300px] shrink-0 flex-col gap-3.5 max-[1240px]:hidden">
      {/* 쌓인 기록 — 실측 createdAt 월별 집계 */}
      {months.length > 0 && (
        <section className="rounded-[14px] border border-border bg-card px-4 py-[15px]">
          <h2 className="mb-2.5 text-[13px] font-bold text-foreground">쌓인 기록</h2>
          <ul className="flex flex-col gap-2">
            {months.map((month) => (
              <li key={month.key} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-16 shrink-0 whitespace-nowrap">{month.label}</span>
                <span aria-hidden="true" className="h-2 min-w-0 flex-1 rounded-full bg-background">
                  <span
                    className="block h-full rounded-full bg-primary/70"
                    style={{ width: `${maxCount > 0 ? Math.max(8, Math.round((month.count / maxCount) * 100)) : 0}%` }}
                  />
                </span>
                <span className="w-9 shrink-0 text-right font-semibold whitespace-nowrap text-ink-mid">
                  {month.count}건
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 다시 찾은 보고서 — mock 조회 이력 기반(실 API 모드 미노출) */}
      {revisited.length > 0 && (
        <section className="rounded-[14px] border border-border bg-card px-4 py-[15px]">
          <h2 className="mb-2.5 text-[13px] font-bold text-foreground">다시 찾은 보고서</h2>
          <ul className="flex flex-col">
            {revisited.map((item) => (
              <li
                key={item.publicId}
                className="border-b border-border py-[9px] first:pt-0 last:border-b-0 last:pb-0"
              >
                {/* .rrelated — 행 전체가 상세 링크(아이콘 박스 + 제목 2줄 + 설명 1줄) */}
                <Link
                  href={`/report/${item.publicId}`}
                  className="focus-ring group flex items-start gap-2.5 rounded-[3px]"
                >
                  {/* .rico — 28px 정사각 아이콘 박스 */}
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-[11px] text-muted-foreground"
                  >
                    ◉
                  </span>
                  <span className="min-w-0">
                    {/* .rt — 제목 2줄 제한 */}
                    <span className="line-clamp-2 text-[12.5px] leading-[1.4] font-semibold text-foreground group-hover:text-signal-ink">
                      {item.title}
                    </span>
                    {/* .rm — 설명 1줄(작은 회색) */}
                    <span className="mt-[2px] block truncate text-[11px] text-muted-foreground">
                      저장 후 {item.mock?.viewCount ?? 0}번 다시 열어봤어요
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
