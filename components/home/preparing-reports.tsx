"use client";

import { Orb } from "@/components/brand/orb";
import type { MyReport, TrackableReportType } from "@/types/report";

/**
 * 홈 [내 보고서] 최상단 "처리중(PREPARING)" 슬롯 — 보고서 생성이 실제로 시작된 경우에만 노출한다.
 *
 * - 데이터는 상위(HomeView)가 useMyReportJobs 로 한 번 조회해 status 별로 나눈 preparing 배열을 prop 으로 받는다
 *   (ERROR·READY 와 같은 조회를 중복하지 않기 위해 여기서 직접 fetch 하지 않는다).
 * - READY 카드(MemberFeed)·ERROR 카드(FailedReports)보다 항상 위에 온다.
 * - preparing 이 비어 있으면 아무것도 렌더하지 않는다 → 기존 카드 목록·Empty 그대로.
 * - 본문·상세 미연결(클릭·이동 없음), 가짜 진행률·카운트다운 없음. 처리중 여부는 status 로만 파생한다.
 */
export function PreparingReports({ reports }: { reports: MyReport[] }) {
  if (reports.length === 0) return null;

  return (
    <section aria-label="생성 중인 보고서" aria-live="polite" className="mb-4 flex flex-col gap-2.5">
      {reports.map((report) => (
        <PreparingSlot key={report.id} title={report.title} reportType={report.reportType} />
      ))}
    </section>
  );
}

/**
 * 유형별 하단 안내.
 * ⚠ 소요 시간·진행률처럼 **백엔드에 근거가 없는 수치는 쓰지 않는다**(트리거·조회수 노출 금지와 같은 부류).
 *   agent 생성 시간은 파이프라인·모델에 따라 달라지고 service 가 예측값을 내려주지도 않는다.
 */
const TYPE_HINT: Record<TrackableReportType, string> = {
  ON_DEMAND: "분석이 끝나면 여기에 바로 표시돼요",
  MORNING_BRIEFING: "완료 후 내 보고서에서 확인할 수 있어요",
};

/**
 * 처리중 슬롯 1건 — READY 카드와 구분되되 오류/실패처럼 보이지 않게(브랜드 wash 배지 + 은은한 Orb).
 * Orb 회전은 motion-safe(감속 모션 존중), 링크·버튼 없음(상세 이동 없음). 하단 안내는 생성 유형별로 다르다.
 */
function PreparingSlot({ title, reportType }: { title: string; reportType: TrackableReportType }) {
  return (
    <article className="rounded-[14px] border border-border bg-card px-[18px] py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0" aria-hidden="true">
          <Orb size={22} className="motion-safe:animate-spin [animation-duration:3s]" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="shrink-0 rounded-full border border-wash-strong bg-wash px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-signal-ink">
              분석 중
            </span>
            <span className="truncate text-[14px] font-bold tracking-[-0.01em] text-foreground">
              {title}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-mid">보고서를 생성하고 있어요.</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{TYPE_HINT[reportType]}</p>
        </div>
      </div>
    </article>
  );
}
