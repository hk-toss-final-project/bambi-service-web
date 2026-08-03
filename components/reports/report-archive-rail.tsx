"use client";

import { monthlyArchiveCounts } from "@/lib/adapters/report-archive";
import type { ArchiveItem } from "@/types/report-archive";

/**
 * /reports 우측 rail — 목업 library.html 의 데스크톱 우측 패널 복원. ≤1240px 숨김(다른 rail 과 동일).
 *
 * - 쌓인 기록: **실측 createdAt 집계**(월별 건수, 최근 4개월, 최대 건수 대비 막대) — 고정 수치 없음.
 *   mock 모드에서는 데모 항목이 집계에 포함된다(디자인 검증용). 대량 데이터·페이지네이션 도입 시
 *   서버 월별 집계 API 가 필요하다(최종 보고 명시).
 * - 목업의 「다시 찾은 보고서」는 구현하지 않는다 — 조회수·조회 이력은 UI 노출 금지 확정 개념(루트 CLAUDE.md).
 */
export function ReportArchiveRail({ items }: { items: ArchiveItem[] }) {
  const months = monthlyArchiveCounts(items, new Date());
  const maxCount = months.reduce((max, m) => Math.max(max, m.count), 0);

  if (months.length === 0) return null;

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

    </aside>
  );
}
