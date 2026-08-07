"use client";

import { IconAlert } from "@/components/ui/state-icons";
import type { MyReport, TrackableReportType } from "@/types/report";

/**
 * 홈 [내 보고서] "생성 실패(ERROR)" 카드 — 개별 보고서 생성이 실패했을 때만 노출한다.
 *
 * - 데이터는 상위(HomeView)가 useMyReportJobs 로 한 번 조회해 status 별로 나눈 failed 배열을 prop 으로 받는다.
 * - 배치는 PREPARING 슬롯 아래, READY 카드(MemberFeed) 위 — 탭 전체를 오류 화면으로 바꾸지 않는다.
 *   PREPARING·READY 보고서와 함께 존재할 수 있고, 실패 1건 이상일 때만 이 섹션이 렌더된다.
 * - **다시 시도 버튼 없음**(재시도 API 미확정) · 상세 링크 아님(클릭·이동 없음) · 내부 에러코드/stack 미노출.
 * - 과한 빨강·경고 장식 없이 은은하게, 색만으로 의미를 전달하지 않도록 "생성 실패" 텍스트 배지 + 아이콘을 함께 쓴다.
 */
export function FailedReports({ reports }: { reports: MyReport[] }) {
  if (reports.length === 0) return null;

  return (
    <section aria-label="생성에 실패한 보고서" className="mb-4 flex flex-col gap-2.5">
      {reports.map((report) => (
        <ErrorSlot key={report.id} reportType={report.reportType} />
      ))}
    </section>
  );
}

/**
 * 유형별 실패 안내 — heading(무슨 생성이 실패했는지) + subtext(다음에 어떻게 되는지).
 * 재시도 버튼 대신 "다음 브리핑에서 다시 준비" 같은 자연 복구 안내만 둔다(재시도 API 미확정).
 */
const ERROR_COPY: Record<TrackableReportType, { heading: string; subtext: string }> = {
  ON_DEMAND: { heading: "관심 자료 분석을 완료하지 못했어요", subtext: "잠시 후 다시 확인해 주세요." },
  MORNING_BRIEFING: {
    heading: "오늘의 아침 브리핑을 만들지 못했어요",
    subtext: "다음 브리핑에서 다시 준비할게요.",
  },
};

/**
 * 생성 실패 카드 1건 — PREPARING 슬롯과 같은 카드 골격을 쓰되, 회전 Orb 대신 정적 경고 아이콘 + 중립 "생성 실패" 배지.
 * READY 상세 카드처럼 보이지 않도록 링크·버튼을 두지 않고, 가짜 진행률·성공한 듯한 썸네일도 넣지 않는다.
 */
function ErrorSlot({ reportType }: { reportType: TrackableReportType }) {
  const copy = ERROR_COPY[reportType];
  return (
    <article className="rounded-[14px] border border-border bg-card px-[18px] py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
          <IconAlert width={18} height={18} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-muted-foreground">
              생성 실패
            </span>
            <span className="truncate text-[14px] font-bold tracking-[-0.01em] text-foreground">
              {copy.heading}
            </span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.6] text-muted-foreground">{copy.subtext}</p>
        </div>
      </div>
    </article>
  );
}
