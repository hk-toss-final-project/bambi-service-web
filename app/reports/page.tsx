import type { Metadata } from "next";

import { ReportArchiveScreen } from "@/components/reports/report-archive-screen";

export const metadata: Metadata = {
  title: "AlphaCatcher — 내 보고서 전체 보기",
  description: "완료된 내 보고서를 날짜별로 모아 보고 검색합니다.",
};

/**
 * 내 보고서 전체 보기 — /reports. member 전용. 라우트 가드 없음(토큰은 localStorage) —
 * 인증 분기·접근 제한은 클라이언트 ReportArchiveScreen 이 담당한다(설정·홈과 동일 패턴).
 * 상세는 기존 /report/{publicId} 를 그대로 쓴다.
 */
export default function ReportsPage() {
  return <ReportArchiveScreen />;
}
