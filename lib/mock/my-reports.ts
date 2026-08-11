import type { MyReport } from "@/types/report";

/**
 * 내 보고서 생성 상태 mock — 홈 [내 보고서] PREPARING(처리중)·ERROR(생성 실패) 검증용(Mock-first).
 *
 * 컴포넌트/훅은 이 파일을 직접 import 하지 않고
 * lib/repositories/my-reports.ts seam을 경유한다.
 *
 * 추후 GET /reports/mine(status 포함) 실 응답으로 교체한다.
 *
 * READY 완료 보고서는 GET /api/feed에서 표시되므로
 * 이 배열에는 PREPARING·ERROR 생성 작업만 담는다.
 */

/**
 * 처리중 슬롯 QA용 샘플 — Service Pending으로 추적 가능한 세 종류를 담는다.
 */
export const QA_PREPARING_SAMPLES: MyReport[] = [
  {
    id: "rep-job-ondemand",
    reportType: "ON_DEMAND",
    title: "개발·프로그래밍",
    status: "PREPARING",
  },
  {
    id: "rep-job-morning",
    reportType: "MORNING_BRIEFING",
    title: "오늘의 아침 브리핑",
    status: "PREPARING",
  },
  {
    id: "rep-job-onboarding",
    reportType: "ONBOARDING",
    title: "첫 리포트",
    status: "PREPARING",
  },
];

/** 생성 실패 카드 QA용 샘플 */
export const QA_ERROR_SAMPLES: MyReport[] = [
  {
    id: "rep-err-ondemand",
    reportType: "ON_DEMAND",
    title: "개발·프로그래밍",
    status: "ERROR",
  },
  {
    id: "rep-err-morning",
    reportType: "MORNING_BRIEFING",
    title: "오늘의 아침 브리핑",
    status: "ERROR",
  },
  {
    id: "rep-err-onboarding",
    reportType: "ONBOARDING",
    title: "첫 리포트",
    status: "ERROR",
  },
];

/**
 * 브라우저 QA가 끝나면 반드시 빈 배열로 원복한다.
 *
 * ERROR만 확인:
 *   [...QA_ERROR_SAMPLES]
 *
 * PREPARING + ERROR 확인:
 *   [...QA_PREPARING_SAMPLES, ...QA_ERROR_SAMPLES]
 *
 * 완전 Empty 확인:
 *   []
 */
export const MOCK_MY_REPORTS: MyReport[] = [];
